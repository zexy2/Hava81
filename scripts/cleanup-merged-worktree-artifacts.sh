#!/usr/bin/env bash
set -euo pipefail

apply=false
audit=false
remove_worktrees=false
stale_clean_hours=""
repo="$(git rev-parse --show-toplevel)"
current="$repo"
primary="$(git worktree list --porcelain | awk '/^worktree / && !seen {sub(/^worktree /, ""); print; seen=1}')"

usage() {
  cat <<'USAGE'
Usage: scripts/cleanup-merged-worktree-artifacts.sh [--apply] [--audit] [--remove-worktrees] [--stale-clean-hours=N]

Dry-run by default. Scans linked Hava81 worktrees and considers only worktrees
that are clean and whose HEAD is already an ancestor of origin/main. It removes
only rebuildable validation artifacts; source files, branches, Git metadata,
Docker resources and the current/primary worktrees are never removed. With
--remove-worktrees, an eligible linked checkout itself is also removed while its
branch/ref is preserved. With --stale-clean-hours=N, clean attached linked
checkouts older than N hours may also be removed even when their branch is not
merged, but only when the local branch ref still points exactly at that HEAD.
Detached, dirty, recent, current, primary and process-in-use worktrees remain
excluded. Process use is detected from open files/cwd under the checkout before
any artifact or worktree removal. With --audit, the command remains read-only and reports aggregate exclusion counts so ownership/status failures are visible during disk incidents.
USAGE
}

for arg in "$@"; do
  case "$arg" in
    --apply) apply=true ;;
    --audit) audit=true ;;
    --remove-worktrees) remove_worktrees=true ;;
    --stale-clean-hours=*) stale_clean_hours="${arg#*=}" ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $arg" >&2; usage >&2; exit 2 ;;
  esac
done
if [[ "$apply" == true && "$audit" == true ]]; then
  echo "--audit is read-only and cannot be combined with --apply" >&2
  exit 2
fi


if [[ -n "$stale_clean_hours" ]]; then
  if [[ ! "$stale_clean_hours" =~ ^[0-9]+$ || "$stale_clean_hours" -lt 1 ]]; then
    echo "--stale-clean-hours must be an integer >= 1" >&2
    exit 2
  fi
  remove_worktrees=true
fi

git rev-parse --verify origin/main >/dev/null

# Git metadata must be mutated by the repository owner. Running an apply pass as
# another user (most commonly root via sudo) can leave refs/reflogs/worktree
# metadata owned by that user and break later fetch/commit operations. Dry-run
# and audit modes remain available from any readable identity.
if [[ "$apply" == true ]]; then
  git_dir="$(git rev-parse --absolute-git-dir)"
  git_owner_uid="$(stat -c %u "$git_dir" 2>/dev/null || true)"
  current_uid="$(id -u)"
  if [[ ! "$git_owner_uid" =~ ^[0-9]+$ ]]; then
    echo "cannot determine Git metadata owner; refusing apply" >&2
    exit 2
  fi
  if [[ "$current_uid" != "$git_owner_uid" ]]; then
    echo "refusing apply as uid $current_uid; Git metadata is owned by uid $git_owner_uid" >&2
    echo "run the cleanup as the repository owner so refs/reflogs remain writable" >&2
    exit 2
  fi

  metadata_audit="$repo/scripts/audit-git-metadata-writability.sh"
  if [[ ! -x "$metadata_audit" ]]; then
    echo "Git metadata writability audit is unavailable; refusing apply" >&2
    exit 2
  fi
  if ! "$metadata_audit" "$repo" >/dev/null; then
    echo "Git metadata is not fully writable; refusing cleanup before any mutation" >&2
    exit 2
  fi
fi

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
skipped_artifact_count=0
removable_worktree_count=0
removable_worktree_bytes=0
unwritable_worktree_count=0
unwritable_worktree_bytes=0
removed_worktree_count=0
skipped_worktree_count=0
removable_stale_worktree_count=0
removable_stale_worktree_bytes=0
audit_scanned_count=0
audit_dirty_count=0
audit_status_unreadable_count=0
audit_missing_count=0
audit_in_use_count=0

worktree_is_in_use() {
  local target="$1" cwd_snapshot
  cwd_snapshot="$(ls -l /proc/[0-9]*/cwd 2>/dev/null || true)"
  if awk -v target="$target" '{ marker=index($0, " -> "); if (marker) { path=substr($0, marker+4); if (path == target || index(path, target "/") == 1) found=1 } } END { exit found ? 0 : 1 }' <<<"$cwd_snapshot"; then
    return 0
  fi
  ps -eo args= 2>/dev/null | grep -F -- "$target" | grep -qv -F -- "grep -F -- $target"
}
tree_is_removable() {
  local target="$1"
  local parent
  parent="$(dirname "$target")"
  [[ -w "$parent" && -x "$parent" ]] || return 1
  if find "$target" -type d \( ! -writable -o ! -executable \) -print -quit 2>/dev/null | grep -q .; then
    return 1
  fi
  return 0
}

while IFS= read -r wt; do
  [[ -n "$wt" ]] || continue
  if [[ ! -d "$wt" ]]; then
    audit_missing_count=$((audit_missing_count + 1))
    continue
  fi
  [[ "$(realpath "$wt")" != "$(realpath "$current")" ]] || continue
  [[ "$(realpath "$wt")" != "$(realpath "$primary")" ]] || continue

  audit_scanned_count=$((audit_scanned_count + 1))
  status_output=""
  if ! status_output="$(git -c safe.directory="$wt" -C "$wt" status --porcelain --untracked-files=all 2>/dev/null)"; then
    audit_status_unreadable_count=$((audit_status_unreadable_count + 1))
    continue
  fi
  if [[ -n "$status_output" ]]; then
    audit_dirty_count=$((audit_dirty_count + 1))
    continue
  fi

  if worktree_is_in_use "$wt"; then
    audit_in_use_count=$((audit_in_use_count + 1))
    continue
  fi

  head="$(git -c safe.directory="$wt" -C "$wt" rev-parse HEAD 2>/dev/null || true)"
  [[ -n "$head" ]] || continue

  merged=true
  if ! git merge-base --is-ancestor "$head" origin/main; then
    cherry="$(git cherry origin/main "$head" 2>/dev/null || true)"
    if [[ -z "$cherry" ]] || grep -q '^+' <<<"$cherry"; then
      merged=false
    fi
  fi

  stale_clean=false
  if [[ "$merged" != true && -n "$stale_clean_hours" ]]; then
    branch_ref="$(git -c safe.directory="$wt" -C "$wt" symbolic-ref -q HEAD 2>/dev/null || true)"
    branch_head=""
    if [[ -n "$branch_ref" ]]; then
      branch_head="$(git rev-parse --verify "$branch_ref" 2>/dev/null || true)"
    fi
    if [[ -n "$branch_ref" && "$branch_head" == "$head" ]]; then
      modified_epoch="$(stat -c %Y "$wt" 2>/dev/null || true)"
      now_epoch="$(date +%s)"
      if [[ "$modified_epoch" =~ ^[0-9]+$ && "$now_epoch" =~ ^[0-9]+$ ]]; then
        age_seconds=$((now_epoch - modified_epoch))
        required_seconds=$((stale_clean_hours * 3600))
        if (( age_seconds >= required_seconds )); then
          stale_clean=true
        fi
      fi
    fi
  fi

  if [[ "$merged" != true && "$stale_clean" != true ]]; then
    continue
  fi

  wt_bytes="$(du -sb "$wt" 2>/dev/null | awk '{print $1}')"
  [[ "$wt_bytes" =~ ^[0-9]+$ ]] || wt_bytes=0
  if [[ "$remove_worktrees" == true ]]; then
    if tree_is_removable "$wt"; then
      removable_worktree_count=$((removable_worktree_count + 1))
      removable_worktree_bytes=$((removable_worktree_bytes + wt_bytes))
      if [[ "$stale_clean" == true ]]; then
        removable_stale_worktree_count=$((removable_stale_worktree_count + 1))
        removable_stale_worktree_bytes=$((removable_stale_worktree_bytes + wt_bytes))
      fi
      printf '%s\t%s\t%s\n' "$([[ "$apply" == true ]] && echo REMOVE_WORKTREE || echo WOULD_REMOVE_WORKTREE)" "$wt_bytes" "$wt"
    else
      unwritable_worktree_count=$((unwritable_worktree_count + 1))
      unwritable_worktree_bytes=$((unwritable_worktree_bytes + wt_bytes))
      printf '%s\t%s\t%s\n' "$([[ "$apply" == true ]] && echo SKIP_UNWRITABLE_WORKTREE || echo WOULD_SKIP_UNWRITABLE_WORKTREE)" "$wt_bytes" "$wt"
    fi
  fi

  for rel in "${artifacts[@]}"; do
    target="$wt/$rel"
    [[ -d "$target" && ! -L "$target" ]] || continue
    bytes="$(du -sb "$target" 2>/dev/null | awk '{print $1}')"
    [[ "$bytes" =~ ^[0-9]+$ ]] || bytes=0
    candidate_count=$((candidate_count + 1))
    candidate_bytes=$((candidate_bytes + bytes))
    if ! tree_is_removable "$target"; then
      printf '%s\t%s\t%s\n' "$([[ "$apply" == true ]] && echo SKIP_UNWRITABLE_ARTIFACT || echo WOULD_SKIP_UNWRITABLE_ARTIFACT)" "$bytes" "$target"
      if [[ "$apply" == true ]]; then
        skipped_artifact_count=$((skipped_artifact_count + 1))
      fi
      continue
    fi
    printf '%s\t%s\t%s\n' "$([[ "$apply" == true ]] && echo REMOVE || echo WOULD_REMOVE)" "$bytes" "$target"
    if [[ "$apply" == true ]]; then
      if rm -rf --one-file-system "$target"; then
        removed_count=$((removed_count + 1))
        removed_bytes=$((removed_bytes + bytes))
      else
        printf 'SKIP_ARTIFACT_REMOVE_FAILED\t%s\t%s\n' "$bytes" "$target" >&2
        skipped_artifact_count=$((skipped_artifact_count + 1))
      fi
    fi
  done

  if [[ "$remove_worktrees" == true && "$apply" == true ]]; then
    if ! tree_is_removable "$wt"; then
      skipped_worktree_count=$((skipped_worktree_count + 1))
      continue
    fi
    if git worktree remove "$wt"; then
      removed_worktree_count=$((removed_worktree_count + 1))
    else
      printf 'SKIP_WORKTREE_REMOVE_FAILED\t%s\t%s\n' "$wt_bytes" "$wt" >&2
      skipped_worktree_count=$((skipped_worktree_count + 1))
    fi
  fi
done < <(git worktree list --porcelain | awk '/^worktree / {sub(/^worktree /, ""); print}')

if [[ "$audit" == true ]]; then
  printf "Audit: scanned=%d dirty=%d in_use=%d status_unreadable=%d missing=%d. No files, refs, or worktrees were changed.\n" "$audit_scanned_count" "$audit_dirty_count" "$audit_in_use_count" "$audit_status_unreadable_count" "$audit_missing_count"
fi

if [[ "$remove_worktrees" == true ]]; then
  if [[ "$apply" == true ]]; then
    printf 'Removed %d eligible clean linked worktrees; skipped %d unwritable/failed removals; branch refs were preserved.\n' "$removed_worktree_count" "$skipped_worktree_count"
  else
    printf 'Dry run: %d clean linked worktrees (%d bytes) can be removed now; %d (%d bytes) are currently unwritable; %d removable worktrees (%d bytes) qualify only via the stale-clean guard.\n' "$removable_worktree_count" "$removable_worktree_bytes" "$unwritable_worktree_count" "$unwritable_worktree_bytes" "$removable_stale_worktree_count" "$removable_stale_worktree_bytes"
  fi
fi

if [[ "$apply" == true ]]; then
  printf 'Removed %d rebuildable artifact directories (%d bytes); skipped %d unwritable/failed removals.\n' "$removed_count" "$removed_bytes" "$skipped_artifact_count"
else
  printf 'Dry run: %d rebuildable artifact directories (%d bytes) are eligible. Re-run with --apply to remove only these artifacts.\n' "$candidate_count" "$candidate_bytes"
fi