#!/usr/bin/env bash
set -euo pipefail

apply=false
audit=false
parent=""
older_than_hours=""
repo="$(git rev-parse --show-toplevel)"
origin_url="$(git config --get remote.origin.url)"
archive_prefix="refs/archive/hava81-standalone"

usage() {
  cat <<'USAGE'
Usage: scripts/cleanup-stale-standalone-checkouts.sh --parent=DIR --older-than-hours=N [--apply] [--audit]

Dry-run by default. Scans only direct child directories named `hava81-*` under
an explicit parent and considers standalone Git clones only (`.git` must be a
directory, never a linked-worktree pointer). A checkout is eligible only when:
- `git status --porcelain --untracked-files=all` succeeds and is empty;
- its origin URL exactly matches this repository's origin;
- HEAD is attached to a branch and is already represented by origin/main;
- the checkout is at least N hours old; and
- no running process command line references the checkout path.

With --apply, the exact HEAD is first preserved under
refs/archive/hava81-standalone/<branch>, then every eligibility condition is
rechecked immediately before the standalone directory is removed. Existing
archive refs must already point at the same commit or the candidate is skipped.

`--audit` is read-only and reports how many matching directories are standalone
clones, linked worktrees, or directories without Git metadata, plus aggregate
standalone exclusion reasons (registered, dirty, origin mismatch, detached, unrepresented,
recent, in-use, unreadable, or archive conflict). It does not widen cleanup
eligibility, print candidate file contents, or mutate refs/checkouts.
USAGE
}

for arg in "$@"; do
  case "$arg" in
    --apply) apply=true ;;
    --audit) audit=true ;;
    --parent=*) parent="${arg#*=}" ;;
    --older-than-hours=*) older_than_hours="${arg#*=}" ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown argument: $arg" >&2; usage >&2; exit 2 ;;
  esac
done

if [[ "$apply" == true && "$audit" == true ]]; then
  echo "--audit is read-only and cannot be combined with --apply" >&2
  exit 2
fi

[[ -n "$parent" && -d "$parent" ]] || { echo "--parent must name an existing directory" >&2; exit 2; }
if [[ ! "$older_than_hours" =~ ^[0-9]+$ || "$older_than_hours" -lt 1 ]]; then
  echo "--older-than-hours must be an integer >= 1" >&2
  exit 2
fi
[[ -n "$origin_url" ]] || { echo "repository origin URL is unavailable" >&2; exit 2; }

git rev-parse --verify origin/main >/dev/null

registered_file="$(mktemp)"
trap 'rm -f "$registered_file"' EXIT
git worktree list --porcelain | awk '/^worktree / {sub(/^worktree /, ""); print}' | while IFS= read -r path; do
  realpath "$path"
done > "$registered_file"

path_is_registered() {
  local candidate="$1"
  grep -Fxq "$(realpath "$candidate")" "$registered_file"
}

path_is_in_use() {
  local candidate="$1"
  ps -eo args= 2>/dev/null | grep -F -- "$candidate" | grep -qv -F -- "grep -F -- $candidate"
}

audit_reason_for_standalone() {
  local candidate="$1"
  local status_output head branch remote modified_epoch now_epoch age_seconds required_seconds archive_ref cherry

  if [[ "$(realpath "$candidate")" == "$(realpath "$repo")" ]] || path_is_registered "$candidate"; then
    printf 'registered\n'
    return
  fi

  status_output=""
  if ! status_output="$(git -c safe.directory="$candidate" -C "$candidate" status --porcelain --untracked-files=all 2>/dev/null)"; then
    printf 'status_unreadable\n'
    return
  fi
  if [[ -n "$status_output" ]]; then
    printf 'dirty\n'
    return
  fi

  remote="$(git -c safe.directory="$candidate" -C "$candidate" config --get remote.origin.url 2>/dev/null || true)"
  if [[ "$remote" != "$origin_url" ]]; then
    printf 'origin_mismatch\n'
    return
  fi

  head="$(git -c safe.directory="$candidate" -C "$candidate" rev-parse --verify HEAD 2>/dev/null || true)"
  branch="$(git -c safe.directory="$candidate" -C "$candidate" symbolic-ref -q --short HEAD 2>/dev/null || true)"
  if [[ -z "$head" || -z "$branch" ]]; then
    printf 'detached\n'
    return
  fi

  if ! git cat-file -e "$head^{commit}" 2>/dev/null; then
    printf 'unrepresented\n'
    return
  fi
  if ! git merge-base --is-ancestor "$head" origin/main; then
    cherry="$(git cherry origin/main "$head" 2>/dev/null || true)"
    if [[ -z "$cherry" ]] || grep -q '^+' <<<"$cherry"; then
      printf 'unrepresented\n'
      return
    fi
  fi

  modified_epoch="$(stat -c %Y "$candidate" 2>/dev/null || true)"
  now_epoch="$(date +%s)"
  if [[ ! "$modified_epoch" =~ ^[0-9]+$ || ! "$now_epoch" =~ ^[0-9]+$ ]]; then
    printf 'age_unreadable\n'
    return
  fi
  age_seconds=$((now_epoch - modified_epoch))
  required_seconds=$((older_than_hours * 3600))
  if (( age_seconds < required_seconds )); then
    printf 'recent\n'
    return
  fi

  if path_is_in_use "$candidate"; then
    printf 'in_use\n'
    return
  fi

  archive_ref="$archive_prefix/$branch"
  if ! git check-ref-format "$archive_ref" >/dev/null 2>&1; then
    printf 'archive_conflict\n'
    return
  fi
  if git show-ref --verify --quiet "$archive_ref" && [[ "$(git rev-parse "$archive_ref")" != "$head" ]]; then
    printf 'archive_conflict\n'
    return
  fi

  printf 'eligible\n'
}

candidate_is_eligible() {
  local candidate="$1"
  local status_output head branch remote modified_epoch now_epoch age_seconds required_seconds archive_ref

  [[ -d "$candidate" && ! -L "$candidate" ]] || return 1
  [[ -d "$candidate/.git" && ! -L "$candidate/.git" ]] || return 1
  [[ "$(realpath "$candidate")" != "$(realpath "$repo")" ]] || return 1
  path_is_registered "$candidate" && return 1

  status_output=""
  if ! status_output="$(git -c safe.directory="$candidate" -C "$candidate" status --porcelain --untracked-files=all 2>/dev/null)"; then
    return 1
  fi
  [[ -z "$status_output" ]] || return 1

  remote="$(git -c safe.directory="$candidate" -C "$candidate" config --get remote.origin.url 2>/dev/null || true)"
  [[ "$remote" == "$origin_url" ]] || return 1

  head="$(git -c safe.directory="$candidate" -C "$candidate" rev-parse --verify HEAD 2>/dev/null || true)"
  branch="$(git -c safe.directory="$candidate" -C "$candidate" symbolic-ref -q --short HEAD 2>/dev/null || true)"
  [[ -n "$head" && -n "$branch" ]] || return 1

  git cat-file -e "$head^{commit}" 2>/dev/null || return 1
  if ! git merge-base --is-ancestor "$head" origin/main; then
    local cherry
    cherry="$(git cherry origin/main "$head" 2>/dev/null || true)"
    [[ -n "$cherry" ]] || return 1
    grep -q '^+' <<<"$cherry" && return 1
  fi

  modified_epoch="$(stat -c %Y "$candidate" 2>/dev/null || true)"
  now_epoch="$(date +%s)"
  [[ "$modified_epoch" =~ ^[0-9]+$ && "$now_epoch" =~ ^[0-9]+$ ]] || return 1
  age_seconds=$((now_epoch - modified_epoch))
  required_seconds=$((older_than_hours * 3600))
  (( age_seconds >= required_seconds )) || return 1

  path_is_in_use "$candidate" && return 1

  archive_ref="$archive_prefix/$branch"
  git check-ref-format "$archive_ref" >/dev/null 2>&1 || return 1
  if git show-ref --verify --quiet "$archive_ref"; then
    [[ "$(git rev-parse "$archive_ref")" == "$head" ]] || return 1
  fi

  printf '%s\t%s\t%s\t%s\n' "$head" "$branch" "$archive_ref" "$age_seconds"
}

candidate_count=0
candidate_bytes=0
removed_count=0
removed_bytes=0
skipped_apply_count=0
scanned_count=0
standalone_count=0
linked_count=0
without_git_count=0
audit_eligible_count=0
audit_registered_count=0
audit_dirty_count=0
audit_origin_mismatch_count=0
audit_detached_count=0
audit_unrepresented_count=0
audit_recent_count=0
audit_in_use_count=0
audit_unreadable_count=0
audit_archive_conflict_count=0

while IFS= read -r -d '' candidate; do
  scanned_count=$((scanned_count + 1))
  if [[ -d "$candidate/.git" && ! -L "$candidate/.git" ]]; then
    standalone_count=$((standalone_count + 1))
  elif [[ -f "$candidate/.git" && ! -L "$candidate/.git" ]]; then
    linked_count=$((linked_count + 1))
  else
    without_git_count=$((without_git_count + 1))
  fi

  if [[ "$audit" == true && -d "$candidate/.git" && ! -L "$candidate/.git" ]]; then
    audit_reason="$(audit_reason_for_standalone "$candidate")"
    case "$audit_reason" in
      eligible) audit_eligible_count=$((audit_eligible_count + 1)) ;;
      registered) audit_registered_count=$((audit_registered_count + 1)) ;;
      dirty) audit_dirty_count=$((audit_dirty_count + 1)) ;;
      origin_mismatch) audit_origin_mismatch_count=$((audit_origin_mismatch_count + 1)) ;;
      detached) audit_detached_count=$((audit_detached_count + 1)) ;;
      unrepresented) audit_unrepresented_count=$((audit_unrepresented_count + 1)) ;;
      recent) audit_recent_count=$((audit_recent_count + 1)) ;;
      in_use) audit_in_use_count=$((audit_in_use_count + 1)) ;;
      status_unreadable|age_unreadable) audit_unreadable_count=$((audit_unreadable_count + 1)) ;;
      archive_conflict) audit_archive_conflict_count=$((audit_archive_conflict_count + 1)) ;;
    esac
  fi

  eligibility="$(candidate_is_eligible "$candidate" || true)"
  [[ -n "$eligibility" ]] || continue
  IFS=$'\t' read -r head branch archive_ref age_seconds <<<"$eligibility"
  bytes="$(du -sb "$candidate" 2>/dev/null | awk '{print $1}')"
  [[ "$bytes" =~ ^[0-9]+$ ]] || bytes=0
  candidate_count=$((candidate_count + 1))
  candidate_bytes=$((candidate_bytes + bytes))

  if [[ "$apply" != true ]]; then
    printf 'WOULD_ARCHIVE_REMOVE\t%s\t%s\t%s\t%s\n' "$bytes" "$head" "$archive_ref" "$candidate"
    continue
  fi

  # Re-evaluate immediately before mutation; never act on stale eligibility.
  refreshed="$(candidate_is_eligible "$candidate" || true)"
  if [[ "$refreshed" != "$eligibility" ]]; then
    printf 'SKIP_CHANGED\t%s\n' "$candidate" >&2
    skipped_apply_count=$((skipped_apply_count + 1))
    continue
  fi

  if ! git show-ref --verify --quiet "$archive_ref"; then
    git update-ref "$archive_ref" "$head"
  fi
  if [[ "$(git rev-parse "$archive_ref")" != "$head" ]]; then
    printf 'SKIP_ARCHIVE_REF_MISMATCH\t%s\n' "$candidate" >&2
    skipped_apply_count=$((skipped_apply_count + 1))
    continue
  fi

  if rm -rf --one-file-system "$candidate" && [[ ! -e "$candidate" ]]; then
    printf 'ARCHIVED_REMOVED\t%s\t%s\t%s\t%s\n' "$bytes" "$head" "$archive_ref" "$candidate"
    removed_count=$((removed_count + 1))
    removed_bytes=$((removed_bytes + bytes))
  else
    printf 'SKIP_REMOVE_FAILED\t%s\n' "$candidate" >&2
    skipped_apply_count=$((skipped_apply_count + 1))
  fi
done < <(find "$parent" -mindepth 1 -maxdepth 1 -type d -name 'hava81-*' -print0)

if [[ "$apply" == true ]]; then
  printf 'Removed %d stale standalone Hava81 checkouts (%d bytes); exact HEAD archive refs were preserved; skipped %d changed/failed candidates.\n' "$removed_count" "$removed_bytes" "$skipped_apply_count"
else
  printf 'Dry run: %d stale standalone Hava81 checkouts (%d bytes) are eligible; no files or refs were changed.\n' "$candidate_count" "$candidate_bytes"
fi

if [[ "$audit" == true ]]; then
  printf 'Audit: scanned=%d standalone_clones=%d linked_worktrees=%d without_git_metadata=%d.\n' "$scanned_count" "$standalone_count" "$linked_count" "$without_git_count"
  printf 'Audit reasons: eligible=%d registered=%d dirty=%d origin_mismatch=%d detached=%d unrepresented=%d recent=%d in_use=%d unreadable=%d archive_conflict=%d.\n' \
    "$audit_eligible_count" "$audit_registered_count" "$audit_dirty_count" "$audit_origin_mismatch_count" "$audit_detached_count" \
    "$audit_unrepresented_count" "$audit_recent_count" "$audit_in_use_count" "$audit_unreadable_count" \
    "$audit_archive_conflict_count"
fi
