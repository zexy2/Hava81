#!/usr/bin/env bash
set -euo pipefail

repo="${1:-.}"
if [[ ! -d "$repo" ]]; then
  echo "repository path does not exist: $repo" >&2
  exit 2
fi

repo="$(cd "$repo" && git rev-parse --show-toplevel)"
git_dir="$(git -C "$repo" rev-parse --absolute-git-dir)"
common_dir="$(git -C "$repo" rev-parse --path-format=absolute --git-common-dir)"

problems=()
check_dir() {
  local path="$1"
  [[ -d "$path" ]] || return 0
  if [[ ! -w "$path" || ! -x "$path" ]]; then
    problems+=("$path")
  fi
}

# Git writes new loose objects through the two-character fan-out directories.
# One root-owned 0755 fan-out directory is enough to make an otherwise normal
# fetch fail for the repository owner, so inspect every existing directory.
check_dir "$common_dir/objects"
while IFS= read -r -d '' path; do
  check_dir "$path"
done < <(find "$common_dir/objects" -xdev -type d -print0 2>/dev/null || true)

# Fetch/worktree operations also mutate these shared metadata directories.
for path in "$common_dir/refs" "$common_dir/logs" "$common_dir/worktrees"; do
  check_dir "$path"
done

if ((${#problems[@]} > 0)); then
  echo "Git metadata is not writable by uid $(id -u); refusing repository mutation." >&2
  printf 'NOT_WRITABLE\t%s\n' "${problems[@]:0:20}" >&2
  if ((${#problems[@]} > 20)); then
    echo "... and $((${#problems[@]} - 20)) more non-writable directories" >&2
  fi
  exit 1
fi

printf 'git metadata writability: PASS repo=%s git_dir=%s\n' "$repo" "$git_dir"
