#!/usr/bin/env bash
set -euo pipefail

root=""
repo="$(git rev-parse --show-toplevel)"

usage() {
  cat <<'USAGE'
Usage: scripts/audit-hava81-standalone-checkouts.sh --root=DIR

Read-only audit for direct child directories named hava81-* that are standalone
Git clones rather than linked worktrees of the current repository. A checkout is
reported SAFE_TO_ARCHIVE only when it is clean, has the same origin as the
canonical repository, and every commit at its local branch tips plus HEAD is
already represented by canonical origin/main or an origin/* remote ref.

This command never deletes files, changes refs, fetches remotes, or edits Git
configuration. DIRTY, FOREIGN_ORIGIN, UNREPRESENTED and NEEDS_REVIEW results must
be preserved for manual inspection.
USAGE
}

for arg in "$@"; do
  case "$arg" in
    --root=*) root="${arg#*=}" ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $arg" >&2; usage >&2; exit 2 ;;
  esac
done

[[ -n "$root" && -d "$root" ]] || { echo "--root must name an existing directory" >&2; exit 2; }
root="$(realpath "$root")"
[[ "$root" != "/" ]] || { echo "refusing to scan filesystem root" >&2; exit 2; }

git rev-parse --verify origin/main >/dev/null

normalize_origin() {
  local value="$1"
  value="${value%/}"
  value="${value%.git}"
  case "$value" in
    git@github.com:*) value="https://github.com/${value#git@github.com:}" ;;
  esac
  printf '%s\n' "$value"
}

canonical_origin="$(normalize_origin "$(git remote get-url origin)")"

represented_in_canonical() {
  local sha="$1"
  git cat-file -e "${sha}^{commit}" 2>/dev/null || return 1
  if git merge-base --is-ancestor "$sha" origin/main 2>/dev/null; then
    return 0
  fi
  [[ -n "$(git for-each-ref --points-at "$sha" --format='%(refname)' refs/remotes/origin 2>/dev/null)" ]]
}

registered_file="$(mktemp)"
trap 'rm -f "$registered_file"' EXIT
git worktree list --porcelain | awk '/^worktree / {sub(/^worktree /, ""); print}' > "$registered_file"

safe_count=0
safe_bytes=0
review_count=0

while IFS= read -r -d '' candidate; do
  candidate="$(realpath "$candidate")"
  grep -Fxq "$candidate" "$registered_file" && continue

  size="$(du -sb "$candidate" 2>/dev/null | awk '{print $1}' || true)"
  [[ "$size" =~ ^[0-9]+$ ]] || size=0

  if [[ ! -d "$candidate/.git" ]]; then
    printf 'NEEDS_REVIEW\t%s\t%s\tnot-standalone-git-clone\n' "$size" "$candidate"
    review_count=$((review_count + 1))
    continue
  fi

  git_cmd=(git -c "safe.directory=$candidate" -C "$candidate")
  if ! candidate_origin="$("${git_cmd[@]}" remote get-url origin 2>/dev/null)"; then
    printf 'NEEDS_REVIEW\t%s\t%s\tmissing-origin\n' "$size" "$candidate"
    review_count=$((review_count + 1))
    continue
  fi

  if [[ "$(normalize_origin "$candidate_origin")" != "$canonical_origin" ]]; then
    printf 'FOREIGN_ORIGIN\t%s\t%s\n' "$size" "$candidate"
    review_count=$((review_count + 1))
    continue
  fi

  if ! status="$("${git_cmd[@]}" status --porcelain --untracked-files=all 2>/dev/null)"; then
    printf 'NEEDS_REVIEW\t%s\t%s\tstatus-failed\n' "$size" "$candidate"
    review_count=$((review_count + 1))
    continue
  fi
  if [[ -n "$status" ]]; then
    printf 'DIRTY\t%s\t%s\n' "$size" "$candidate"
    review_count=$((review_count + 1))
    continue
  fi

  mapfile -t commits < <(
    {
      "${git_cmd[@]}" rev-parse HEAD 2>/dev/null || true
      "${git_cmd[@]}" for-each-ref --format='%(objectname)' refs/heads 2>/dev/null || true
    } | awk 'NF' | sort -u
  )
  if (( ${#commits[@]} == 0 )); then
    printf 'NEEDS_REVIEW\t%s\t%s\tno-commit-tips\n' "$size" "$candidate"
    review_count=$((review_count + 1))
    continue
  fi

  missing=0
  for sha in "${commits[@]}"; do
    if ! represented_in_canonical "$sha"; then
      missing=$((missing + 1))
    fi
  done

  if (( missing > 0 )); then
    printf 'UNREPRESENTED\t%s\t%s\t%d-commit-tips\n' "$size" "$candidate" "$missing"
    review_count=$((review_count + 1))
    continue
  fi

  printf 'SAFE_TO_ARCHIVE\t%s\t%s\n' "$size" "$candidate"
  safe_count=$((safe_count + 1))
  safe_bytes=$((safe_bytes + size))
done < <(find "$root" -mindepth 1 -maxdepth 1 -type d -name 'hava81-*' -print0 2>/dev/null)

printf 'Audit: %d clean fully represented standalone checkouts (%d bytes); %d require preservation/review. No files were changed.\n' "$safe_count" "$safe_bytes" "$review_count"
