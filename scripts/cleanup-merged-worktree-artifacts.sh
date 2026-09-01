#!/usr/bin/env bash
set -euo pipefail

apply=false
remove_worktrees=false
repo="$(git rev-parse --show-toplevel)"
current="$repo"
primary="$(git worktree list --porcelain | awk '/^worktree / && !seen {sub(/^worktree /, ""); print; seen=1}')"

usage() {
  cat <<'USAGE'
Usage: scripts/cleanup-merged-worktree-artifacts.sh [--apply] [--remove-worktrees]

Dry-run by default. Scans linked Hava81 worktrees and considers only worktrees
that are clean and whose HEAD is already an ancestor of origin/main. It removes
only rebuildable validation artifacts; source files, branches, Git metadata,
Docker resources and the current/primary worktrees are never removed. With
--remove-worktrees, an eligible linked checkout itself is also removed while its
branch/ref is preserved.
USAGE
}

for arg in "$@"; do
  case "$arg" in
    --apply) apply=true ;;
    --remove-worktrees) remove_worktrees=true ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $arg" >&2; usage >&2; exit 2 ;;
  esac
done

git rev-parse --verify origin/main >/dev/null

artifacts=(
  node_modules
  dist
  coverage
  test-results
  playwright-report
  apps/api/node_modules
  apps/api/dist
  apps/api/coverage
)

candidate_count=0
candidate_bytes=0
removed_count=0
removed_bytes=0
worktree_count=0
worktree_bytes=0
removed_worktree_count=0

while IFS= read -r wt; do
  [[ -n "$wt" ]] || continue
  [[ -d "$wt" ]] || continue
  [[ "$(realpath "$wt")" != "$(realpath "$current")" ]] || continue
  [[ "$(realpath "$wt")" != "$(realpath "$primary")" ]] || continue

  if [[ -n "$(git -C "$wt" status --porcelain --untracked-files=all 2>/dev/null)" ]]; then
    continue
  fi

  head="$(git -C "$wt" rev-parse HEAD 2>/dev/null || true)"
  [[ -n "$head" ]] || continue
  if ! git merge-base --is-ancestor "$head" origin/main; then
    cherry="$(git cherry origin/main "$head" 2>/dev/null || true)"
    [[ -n "$cherry" ]] || continue
    if grep -q '^+' <<<"$cherry"; then
      continue
    fi
  fi

  wt_bytes="$(du -sb "$wt" 2>/dev/null | awk '{print $1}')"
  [[ "$wt_bytes" =~ ^[0-9]+$ ]] || wt_bytes=0
  if [[ "$remove_worktrees" == true ]]; then
    worktree_count=$((worktree_count + 1))
    worktree_bytes=$((worktree_bytes + wt_bytes))
    printf '%s\t%s\t%s\n' "$([[ "$apply" == true ]] && echo REMOVE_WORKTREE || echo WOULD_REMOVE_WORKTREE)" "$wt_bytes" "$wt"
  fi

  for rel in "${artifacts[@]}"; do
    target="$wt/$rel"
    [[ -d "$target" && ! -L "$target" ]] || continue
    bytes="$(du -sb "$target" 2>/dev/null | awk '{print $1}')"
    [[ "$bytes" =~ ^[0-9]+$ ]] || bytes=0
    candidate_count=$((candidate_count + 1))
    candidate_bytes=$((candidate_bytes + bytes))
    printf '%s\t%s\t%s\n' "$([[ "$apply" == true ]] && echo REMOVE || echo WOULD_REMOVE)" "$bytes" "$target"
    if [[ "$apply" == true ]]; then
      rm -rf --one-file-system "$target"
      removed_count=$((removed_count + 1))
      removed_bytes=$((removed_bytes + bytes))
    fi
  done

  if [[ "$remove_worktrees" == true && "$apply" == true ]]; then
    git worktree remove "$wt"
    removed_worktree_count=$((removed_worktree_count + 1))
  fi
done < <(git worktree list --porcelain | awk '/^worktree / {sub(/^worktree /, ""); print}')

if [[ "$remove_worktrees" == true ]]; then
  if [[ "$apply" == true ]]; then
    printf 'Removed %d clean merged linked worktrees; their branch refs were preserved.\n' "$removed_worktree_count"
  else
    printf 'Dry run: %d clean merged linked worktrees (%d bytes) are eligible for checkout removal.\n' "$worktree_count" "$worktree_bytes"
  fi
fi

if [[ "$apply" == true ]]; then
  printf 'Removed %d rebuildable artifact directories (%d bytes).\n' "$removed_count" "$removed_bytes"
else
  printf 'Dry run: %d rebuildable artifact directories (%d bytes) are eligible. Re-run with --apply to remove only these artifacts.\n' "$candidate_count" "$candidate_bytes"
fi
