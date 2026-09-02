#!/usr/bin/env bash
set -euo pipefail

apply=false
root=""
older_than_minutes=""

usage() {
  cat <<'USAGE'
Usage: scripts/cleanup-hava81-browser-temp.sh --root=DIR --older-than-minutes=N [--apply]

Dry-run by default. Scans only direct child directories under an explicit Chromium
temporary root and allows Hava81-owned profile names only:
- hava81-*
- h81deploycheck
- h81meta
- h81text

A candidate is eligible only when it is a real directory (not a symlink), no file
or directory inside it was modified within the requested age window, and no running
process command line references the exact candidate path. With --apply every safety
condition is rechecked immediately before removal. No browser profile outside the
Hava81 allowlist is ever considered.
USAGE
}

for arg in "$@"; do
  case "$arg" in
    --apply) apply=true ;;
    --root=*) root="${arg#*=}" ;;
    --older-than-minutes=*) older_than_minutes="${arg#*=}" ;;
    -h|--help) usage; exit 0 ;;
    *) echo "unknown argument: $arg" >&2; usage >&2; exit 2 ;;
  esac
done

[[ -n "$root" && -d "$root" ]] || { echo "--root must name an existing directory" >&2; exit 2; }
if [[ ! "$older_than_minutes" =~ ^[0-9]+$ || "$older_than_minutes" -lt 1 ]]; then
  echo "--older-than-minutes must be an integer >= 1" >&2
  exit 2
fi
root="$(realpath "$root")"
[[ "$root" != "/" ]] || { echo "refusing to scan filesystem root" >&2; exit 2; }

name_is_allowed() {
  local name="$1"
  case "$name" in
    hava81-*|h81deploycheck|h81meta|h81text) return 0 ;;
    *) return 1 ;;
  esac
}

path_is_in_use() {
  local candidate="$1" proc cmdline
  for proc in /proc/[0-9]*; do
    [[ -r "$proc/cmdline" ]] || continue
    cmdline="$(tr '\0' ' ' < "$proc/cmdline" 2>/dev/null || true)"
    [[ -n "$cmdline" ]] || continue
    if [[ "$cmdline" == *"$candidate"* ]]; then
      return 0
    fi
  done
  return 1
}

path_is_old_enough() {
  local candidate="$1"
  # Any recently changed file or directory makes the entire profile ineligible.
  [[ -z "$(find "$candidate" -xdev -mmin "-$older_than_minutes" -print -quit 2>/dev/null)" ]]
}

candidate_is_eligible() {
  local candidate="$1" name
  [[ -d "$candidate" && ! -L "$candidate" ]] || return 1
  [[ "$(dirname "$candidate")" == "$root" ]] || return 1
  name="$(basename "$candidate")"
  name_is_allowed "$name" || return 1
  path_is_old_enough "$candidate" || return 1
  path_is_in_use "$candidate" && return 1
  return 0
}

candidate_count=0
candidate_bytes=0
removed_count=0
removed_bytes=0
skipped_apply_count=0

while IFS= read -r -d '' candidate; do
  name_is_allowed "$(basename "$candidate")" || continue
  candidate_is_eligible "$candidate" || continue

  size="$(du -sb "$candidate" 2>/dev/null | awk '{print $1}' || true)"
  [[ "$size" =~ ^[0-9]+$ ]] || size=0
  candidate_count=$((candidate_count + 1))
  candidate_bytes=$((candidate_bytes + size))

  if [[ "$apply" == false ]]; then
    printf 'WOULD_REMOVE_BROWSER_TEMP\t%s\t%s\n' "$size" "$candidate"
    continue
  fi

  if ! candidate_is_eligible "$candidate"; then
    skipped_apply_count=$((skipped_apply_count + 1))
    printf 'SKIP_CHANGED_BROWSER_TEMP\t%s\n' "$candidate"
    continue
  fi

  rm -rf --one-file-system -- "$candidate"
  removed_count=$((removed_count + 1))
  removed_bytes=$((removed_bytes + size))
  printf 'REMOVED_BROWSER_TEMP\t%s\t%s\n' "$size" "$candidate"
done < <(find "$root" -mindepth 1 -maxdepth 1 -type d -print0 2>/dev/null)

if [[ "$apply" == false ]]; then
  printf 'Dry run: %d inactive Hava81 browser temp directories (%d bytes) are eligible.\n' "$candidate_count" "$candidate_bytes"
else
  printf 'Apply: removed %d Hava81 browser temp directories (%d bytes); skipped %d changed candidates.\n' "$removed_count" "$removed_bytes" "$skipped_apply_count"
fi
