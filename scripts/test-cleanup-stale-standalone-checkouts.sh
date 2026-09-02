#!/usr/bin/env bash
set -euo pipefail

project_root="$(git rev-parse --show-toplevel)"
cleanup_script="$project_root/scripts/cleanup-stale-standalone-checkouts.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

bare="$tmp/origin.git"
primary="$tmp/primary"
parent="$tmp/checkouts"
mkdir -p "$parent"
git init --bare "$bare" >/dev/null
git init -b main "$primary" >/dev/null
git -C "$primary" config user.name 'Hava81 standalone cleanup test'
git -C "$primary" config user.email 'cleanup-test@example.invalid'
printf 'base\n' > "$primary/base.txt"
git -C "$primary" add base.txt
git -C "$primary" commit -m base >/dev/null
git -C "$primary" remote add origin "$bare"
git -C "$primary" push -u origin main >/dev/null
git -C "$bare" symbolic-ref HEAD refs/heads/main

# Advance main so an older clean clone is unquestionably represented.
printf 'main\n' > "$primary/main.txt"
git -C "$primary" add main.txt
git -C "$primary" commit -m main >/dev/null
git -C "$primary" push origin main >/dev/null

git clone "$bare" "$parent/hava81-safe" >/dev/null 2>&1
git -C "$parent/hava81-safe" config user.name test
git -C "$parent/hava81-safe" config user.email test@example.invalid
git -C "$parent/hava81-safe" switch -c archive-me >/dev/null
touch -d '3 days ago' "$parent/hava81-safe"
safe_head="$(git -C "$parent/hava81-safe" rev-parse HEAD)"

# A unique clean commit must never be treated as represented.
git clone "$bare" "$parent/hava81-unmerged" >/dev/null 2>&1
git -C "$parent/hava81-unmerged" config user.name test
git -C "$parent/hava81-unmerged" config user.email test@example.invalid
git -C "$parent/hava81-unmerged" switch -c keep-unmerged >/dev/null
printf 'unique\n' > "$parent/hava81-unmerged/unique.txt"
git -C "$parent/hava81-unmerged" add unique.txt
git -C "$parent/hava81-unmerged" commit -m unique >/dev/null
touch -d '3 days ago' "$parent/hava81-unmerged"

# Dirty, detached, recent, wrong-origin and linked worktree cases are excluded.
git clone "$bare" "$parent/hava81-dirty" >/dev/null 2>&1
printf 'dirty\n' > "$parent/hava81-dirty/dirty.txt"
touch -d '3 days ago' "$parent/hava81-dirty"

git clone "$bare" "$parent/hava81-detached" >/dev/null 2>&1
git -C "$parent/hava81-detached" switch --detach >/dev/null
touch -d '3 days ago' "$parent/hava81-detached"

git clone "$bare" "$parent/hava81-recent" >/dev/null 2>&1

git init -b main "$parent/hava81-wrong-origin" >/dev/null
git -C "$parent/hava81-wrong-origin" config user.name test
git -C "$parent/hava81-wrong-origin" config user.email test@example.invalid
printf 'other\n' > "$parent/hava81-wrong-origin/other.txt"
git -C "$parent/hava81-wrong-origin" add other.txt
git -C "$parent/hava81-wrong-origin" commit -m other >/dev/null
git -C "$parent/hava81-wrong-origin" remote add origin "$tmp/other.git"
touch -d '3 days ago' "$parent/hava81-wrong-origin"

git -C "$primary" worktree add -b linked-old "$parent/hava81-linked" HEAD >/dev/null
touch -d '3 days ago' "$parent/hava81-linked"

mkdir "$parent/hava81-no-git"
touch -d '3 days ago' "$parent/hava81-no-git"

mkdir -p "$primary/scripts"
cp "$cleanup_script" "$primary/scripts/cleanup-stale-standalone-checkouts.sh"
chmod +x "$primary/scripts/cleanup-stale-standalone-checkouts.sh"

dry="$(cd "$primary" && scripts/cleanup-stale-standalone-checkouts.sh --parent="$parent" --older-than-hours=24)"
grep -Fq "$parent/hava81-safe" <<<"$dry"
for excluded in hava81-unmerged hava81-dirty hava81-detached hava81-recent hava81-wrong-origin hava81-linked; do
  if grep -Fq "$parent/$excluded" <<<"$dry"; then
    echo "unsafe standalone candidate appeared: $excluded" >&2
    exit 1
  fi
done
[[ -d "$parent/hava81-safe" ]]
if git -C "$primary" show-ref --verify --quiet refs/archive/hava81-standalone/archive-me; then
  echo 'dry-run unexpectedly created archive ref' >&2
  exit 1
fi

audit="$(cd "$primary" && scripts/cleanup-stale-standalone-checkouts.sh --parent="$parent" --older-than-hours=24 --audit)"
grep -Fq 'Audit: scanned=8 standalone_clones=6 linked_worktrees=1 without_git_metadata=1.' <<<"$audit"
grep -Fq 'Audit reasons: eligible=1 dirty=1 origin_mismatch=1 detached=1 unrepresented=1 recent=1 in_use=0 unreadable=0 archive_conflict=0.' <<<"$audit"
grep -Fq "$parent/hava81-safe" <<<"$audit"
[[ -d "$parent/hava81-no-git" ]]

if (cd "$primary" && scripts/cleanup-stale-standalone-checkouts.sh --parent="$parent" --older-than-hours=24 --apply --audit >/dev/null 2>&1); then
  echo 'read-only audit accepted mutation mode' >&2
  exit 1
fi
[[ -d "$parent/hava81-safe" ]]
if git -C "$primary" show-ref --verify --quiet refs/archive/hava81-standalone/archive-me; then
  echo 'rejected apply+audit unexpectedly created archive ref' >&2
  exit 1
fi

(cd "$primary" && scripts/cleanup-stale-standalone-checkouts.sh --parent="$parent" --older-than-hours=24 --apply >/dev/null)
[[ ! -e "$parent/hava81-safe" ]]
[[ -d "$parent/hava81-unmerged" ]]
[[ -d "$parent/hava81-dirty" ]]
[[ -d "$parent/hava81-detached" ]]
[[ -d "$parent/hava81-recent" ]]
[[ -d "$parent/hava81-wrong-origin" ]]
[[ -d "$parent/hava81-linked" ]]
[[ -d "$parent/hava81-no-git" ]]
[[ "$(git -C "$primary" rev-parse refs/archive/hava81-standalone/archive-me)" == "$safe_head" ]]

if (cd "$primary" && scripts/cleanup-stale-standalone-checkouts.sh --parent="$parent" --older-than-hours=0 >/dev/null 2>&1); then
  echo 'invalid standalone age threshold was accepted' >&2
  exit 1
fi

printf 'standalone cleanup safety contract: PASS\n'
