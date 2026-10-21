#!/usr/bin/env bash
# CI entry point for the Oracle API blue/green deploy (GitHub Actions
# .github/workflows/deploy-api.yml). Runs as the SSH user (ubuntu), never as root.
#
# Usage:  deploy/oracle/ci-deploy-api.sh <40-hex commit sha>
#
#   1. fast-forwards this checkout's `main` to <sha> (which must be on origin/main),
#   2. runs deploy-api-blue-green.sh via sudo in image-pull mode with
#      HAVA81_API_IMAGE=<image repo>:<sha> and HAVA81_API_REVISION=<sha>, so the
#      candidate must report that revision on /api/v1/health/ready before any
#      traffic moves.
#
# stdin (optional, ignored on a TTY): one line with a ghcr.io token (CI pipes the
# job's short-lived GITHUB_TOKEN). It is written to a private temporary Docker
# config used only for this pull and deleted on exit. A public package needs none.
#
# SSH forced command: an authorized_keys entry may pin this script with
#   command="/home/ubuntu/hava81-prod-20261021/deploy/oracle/ci-deploy-api.sh",restrict ssh-ed25519 ...
# The SHA is then taken from the last word of SSH_ORIGINAL_COMMAND, so the key
# can do nothing except deploy a commit that is already on origin/main.
#
# Environment overrides:
#   HAVA81_API_IMAGE_REPO      default ghcr.io/zexy2/hava81-api
#   HAVA81_API_OPERATION_LOCK  default /var/lib/hava81/api-operation.lock
#   HAVA81_DEPLOY_BRANCH       default main
#
# Output contract: prints "HAVA81_DEPLOY_RESULT=deployed" on success, or
# "HAVA81_DEPLOY_RESULT=superseded" (exit 0) when a newer main revision is already
# checked out, so CI can skip the revision check instead of failing.
#
# The whole body lives in main() and is invoked on the last line so bash parses
# it completely before `git merge` rewrites this very file.
set -euo pipefail

main() {
  local script_dir repo_root
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  repo_root="$(cd "$script_dir/../.." && pwd)"

  local image_repo="${HAVA81_API_IMAGE_REPO:-ghcr.io/zexy2/hava81-api}"
  local lock_file="${HAVA81_API_OPERATION_LOCK:-/var/lib/hava81/api-operation.lock}"
  local branch="${HAVA81_DEPLOY_BRANCH:-main}"

  local sha="${1:-}"
  if [[ -n "${SSH_ORIGINAL_COMMAND:-}" ]]; then
    local -a words
    read -r -a words <<<"$SSH_ORIGINAL_COMMAND"
    sha="${words[${#words[@]}-1]:-}"
  fi
  if [[ ! "$sha" =~ ^[0-9a-f]{40}$ ]]; then
    echo "usage: $0 <40-hex commit sha> (got: ${sha:-empty})" >&2
    return 2
  fi
  if [[ ! "$image_repo" =~ ^[a-z0-9.-]+(:[0-9]+)?/[a-z0-9._/-]+$ ]]; then
    echo "invalid HAVA81_API_IMAGE_REPO: $image_repo" >&2
    return 2
  fi

  local token=""
  if [[ ! -t 0 ]]; then
    IFS= read -r -t 10 token || true
  fi

  git_repo() {
    git -c "safe.directory=$repo_root" -C "$repo_root" "$@"
  }

  echo "[ci-deploy] repo=$repo_root branch=$branch sha=$sha image=$image_repo:$sha"

  # Best-effort: do not touch the checkout while another deploy/rollback runs
  # from it. The authoritative lock is still taken by deploy-api-blue-green.sh.
  if [[ -r "$lock_file" ]]; then
    local lock_rc=0
    flock -n "$lock_file" true 2>/dev/null || lock_rc=$?
    if [[ "$lock_rc" == "1" ]]; then
      echo "[ci-deploy] another API operation holds $lock_file; refusing to update the checkout" >&2
      return 1
    fi
  fi

  local current_branch
  current_branch="$(git_repo symbolic-ref --quiet --short HEAD || true)"
  if [[ "$current_branch" != "$branch" ]]; then
    echo "[ci-deploy] checkout is on '${current_branch:-detached HEAD}', expected '$branch'; refusing" >&2
    return 1
  fi
  if [[ -n "$(git_repo status --porcelain --untracked-files=no)" ]]; then
    echo "[ci-deploy] checkout has uncommitted tracked changes; refusing" >&2
    git_repo status --short --untracked-files=no >&2 || true
    return 1
  fi

  git_repo fetch --quiet origin "$branch"
  if ! git_repo merge-base --is-ancestor "$sha" "origin/$branch"; then
    echo "[ci-deploy] $sha is not on origin/$branch; refusing" >&2
    return 1
  fi

  local head
  head="$(git_repo rev-parse HEAD)"
  if [[ "$head" != "$sha" ]]; then
    if git_repo merge-base --is-ancestor "$head" "$sha"; then
      git_repo merge --quiet --ff-only "$sha"
    elif git_repo merge-base --is-ancestor "$sha" "$head"; then
      echo "[ci-deploy] checkout already at newer $head; $sha is superseded, nothing deployed"
      echo "HAVA81_DEPLOY_RESULT=superseded"
      return 0
    else
      echo "[ci-deploy] local $branch ($head) diverged from $sha; refusing" >&2
      return 1
    fi
  fi
  echo "[ci-deploy] checkout at $(git_repo rev-parse --short HEAD)"

  local docker_config=""
  if [[ -n "$token" ]]; then
    docker_config="$(mktemp -d /tmp/hava81-ghcr.XXXXXX)"
    chmod 700 "$docker_config"
    # shellcheck disable=SC2064
    trap "rm -rf '$docker_config'" EXIT
    local auth
    auth="$(printf 'github-actions:%s' "$token" | base64 | tr -d '\n')"
    (umask 077 && printf '{"auths":{"%s":{"auth":"%s"}}}\n' "${image_repo%%/*}" "$auth" >"$docker_config/config.json")
    token=""
  fi

  local -a deploy_env=(
    "HAVA81_API_OPERATION_LOCK=$lock_file"
    "HAVA81_API_IMAGE=$image_repo:$sha"
    "HAVA81_API_REVISION=$sha"
  )
  if [[ -n "$docker_config" ]]; then
    deploy_env+=("DOCKER_CONFIG=$docker_config")
  fi

  local deploy_script="$repo_root/deploy/oracle/deploy-api-blue-green.sh"
  local rc=0
  # HAVA81_CI_DEPLOY_NO_SUDO=1 is a test hook (scripts/test-api-ci-deploy-entry.sh):
  # it only drops privileges, it can never add them.
  if [[ "$(id -u)" == "0" || "${HAVA81_CI_DEPLOY_NO_SUDO:-0}" == "1" ]]; then
    env "${deploy_env[@]}" "$deploy_script" || rc=$?
  else
    # Needs passwordless sudo that may set these variables (Oracle's default
    # "ubuntu ALL=(ALL) NOPASSWD:ALL", or a NOPASSWD:SETENV rule for the script).
    sudo -n "${deploy_env[@]}" "$deploy_script" || rc=$?
  fi
  if [[ "$rc" != "0" ]]; then
    echo "[ci-deploy] deploy-api-blue-green.sh failed with exit code $rc" >&2
    return "$rc"
  fi
  echo "HAVA81_DEPLOY_RESULT=deployed"
}

main "$@"; exit $?
