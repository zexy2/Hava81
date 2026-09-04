#!/usr/bin/env bash
set -euo pipefail

root=""
apply=0
min_loose_kib=1024

usage() {
  cat <<'USAGE'
Usage: scripts/compact-hava81-git-objects.sh --root=DIR [--apply] [--min-loose-kib=N]

Dry-run by default. Scans direct child directories named hava81-* that are standalone
Git repositories with the same origin as the current canonical Hava81 repository.
Repositories with at least N KiB of loose Git objects are reported for compaction.

With --apply, runs plain `git gc` in each eligible repository. This repacks reachable
objects using Git's normal retention policy; it does not delete working-tree files,
branches, tags, or force an immediate prune of recent unreachable objects. Linked
worktrees, foreign origins, unreadable repositories and non-Git directories are skipped.
USAGE
}

for arg in "$@"; do
  case "$arg" in
    --root=*) root="${arg#*=}" ;;
    --apply) apply=1 ;;
    --min-loose-kib=*) min_loose_kib="${arg#*=}" ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $arg" >&2; usage >&2; exit 2 ;;
  esac
done

[[ -n "$root" && -d "$root" ]] || { echo "--root must name an existing directory" >&2; exit 2; }
[[ "$min_loose_kib" =~ ^[0-9]+$ ]] || { echo "--min-loose-kib must be a non-negative integer" >&2; exit 2; }
root="$(realpath "$root")"
[[ "$root" != "/" ]] || { echo "refusing to scan filesystem root" >&2; exit 2; }

repo="$(git rev-parse --show-toplevel)"
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

eligible=0
eligible_kib=0
compacted=0
failed=0

while IFS= read -r -d '' candidate; do
  candidate="$(realpath "$candidate")"
  [[ -d "$candidate/.git" ]] || continue

  git_cmd=(git -c "safe.directory=$candidate" -C "$candidate")
  candidate_origin="$("${git_cmd[@]}" remote get-url origin 2>/dev/null || true)"
  [[ -n "$candidate_origin" ]] || continue
  [[ "$(normalize_origin "$candidate_origin")" == "$canonical_origin" ]] || continue

  loose_kib="$("${git_cmd[@]}" count-objects -v 2>/dev/null | awk '/^size:/{print $2; exit}' || true)"
  [[ "$loose_kib" =~ ^[0-9]+$ ]] || continue
  (( loose_kib >= min_loose_kib )) || continue

  eligible=$((eligible + 1))
  eligible_kib=$((eligible_kib + loose_kib))
  if (( apply )); then
    if "${git_cmd[@]}" gc; then
      printf 'COMPACTED\t%s\t%s\n' "$loose_kib" "$candidate"
      compacted=$((compacted + 1))
    else
      printf 'COMPACT_FAILED\t%s\t%s\n' "$loose_kib" "$candidate" >&2
      failed=$((failed + 1))
    fi
  else
    printf 'WOULD_COMPACT\t%s\t%s\n' "$loose_kib" "$candidate"
  fi
done < <(find "$root" -mindepth 1 -maxdepth 1 -type d -name 'hava81-*' -print0)

if (( apply )); then
  printf 'Compaction: eligible=%d loose_kib=%d compacted=%d failed=%d. Working-tree files and refs were preserved.\n' "$eligible" "$eligible_kib" "$compacted" "$failed"
  (( failed == 0 ))
else
  printf 'Dry run: %d same-origin standalone Hava81 repositories (%d loose KiB) are eligible. Re-run with --apply to compact Git objects only.\n' "$eligible" "$eligible_kib"
fi
