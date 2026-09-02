#!/usr/bin/env bash
set -euo pipefail

project_root="$(git rev-parse --show-toplevel)"
cleanup_script="$project_root/scripts/cleanup-merged-worktree-artifacts.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

bare="$tmp/origin.git"
primary="$tmp/repo"
git init --bare "$bare" >/dev/null
git init -b main "$primary" >/dev/null
git -C "$primary" config user.name 'Hava81 cleanup test'
git -C "$primary" config user.email 'cleanup-test@example.invalid'
printf 'base\n' > "$primary/base.txt"
printf 'dist/\nnode_modules/\n' > "$primary/.gitignore"
git -C "$primary" add base.txt .gitignore
git -C "$primary" commit -m base >/dev/null
git -C "$primary" remote add origin "$bare"
git -C "$primary" push -u origin main >/dev/null

base="$(git -C "$primary" rev-parse HEAD)"
merged="$tmp/merged"
unmerged="$tmp/unmerged"
stale="$tmp/stale"
detached="$tmp/detached"
dirty="$tmp/dirty"
unreadable="$tmp/unreadable"
locked="$tmp/locked"
git -C "$primary" worktree add -b feature-merged "$merged" "$base" >/dev/null
printf 'same patch\n' > "$merged/merged.txt"
git -C "$merged" add merged.txt
git -C "$merged" commit -m feature >/dev/null
merged_head="$(git -C "$merged" rev-parse HEAD)"

git -C "$primary" cherry-pick "$merged_head" >/dev/null
git -C "$primary" commit --amend -m 'squash-equivalent main commit' >/dev/null
git -C "$primary" push origin main >/dev/null

git -C "$primary" worktree add -b feature-locked "$locked" origin/main >/dev/null
mkdir -p "$locked/dist/locked"
printf 'locked build\n' > "$locked/dist/locked/output.txt"
chmod 0555 "$locked/dist/locked"

git -C "$primary" worktree add -b feature-unmerged "$unmerged" "$base" >/dev/null
printf 'unique\n' > "$unmerged/unique.txt"
git -C "$unmerged" add unique.txt
git -C "$unmerged" commit -m unique >/dev/null

git -C "$primary" worktree add -b feature-stale "$stale" "$base" >/dev/null
printf 'stale unique\n' > "$stale/stale.txt"
git -C "$stale" add stale.txt
git -C "$stale" commit -m 'stale unique' >/dev/null
touch -d '3 days ago' "$stale"

git -C "$primary" worktree add --detach "$detached" "$base" >/dev/null
printf 'detached unique\n' > "$detached/detached.txt"
git -C "$detached" add detached.txt
git -C "$detached" commit -m 'detached unique' >/dev/null
touch -d '3 days ago' "$detached"

git -C "$primary" worktree add -b feature-dirty "$dirty" "$base" >/dev/null
printf 'dirty\n' > "$dirty/uncommitted.txt"
touch -d '3 days ago' "$dirty"

git -C "$primary" worktree add -b feature-unreadable "$unreadable" "$base" >/dev/null
printf 'unreadable unique\n' > "$unreadable/unreadable.txt"
git -C "$unreadable" add unreadable.txt
git -C "$unreadable" commit -m 'unreadable unique' >/dev/null
touch -d '3 days ago' "$unreadable"
chmod 000 "$(git -C "$unreadable" rev-parse --git-path index)"
mkdir -p "$merged/dist"
printf 'build\n' > "$merged/dist/output.txt"

mkdir -p "$primary/scripts"
cp "$cleanup_script" "$primary/scripts/cleanup-merged-worktree-artifacts.sh"
chmod +x "$primary/scripts/cleanup-merged-worktree-artifacts.sh"

dry="$(cd "$primary" && scripts/cleanup-merged-worktree-artifacts.sh --remove-worktrees)"
grep -Fq "WOULD_REMOVE_WORKTREE" <<<"$dry"
grep -Fq "$merged" <<<"$dry"
grep -Fq "$merged/dist" <<<"$dry"
grep -Fq "WOULD_SKIP_UNWRITABLE_WORKTREE" <<<"$dry"
grep -Fq "$locked" <<<"$dry"
grep -Fq "WOULD_SKIP_UNWRITABLE_ARTIFACT" <<<"$dry"
grep -Fq "$locked/dist" <<<"$dry"
if grep -Fq "$unmerged" <<<"$dry" || grep -Fq "$stale" <<<"$dry" || grep -Fq "$detached" <<<"$dry" || grep -Fq "$dirty" <<<"$dry" || grep -Fq "$unreadable" <<<"$dry"; then
  echo 'unsafe worktree appeared in default dry-run eligibility' >&2
  exit 1
fi

(cd "$primary" && scripts/cleanup-merged-worktree-artifacts.sh --remove-worktrees --apply >/dev/null)
[[ ! -d "$merged" ]]
[[ -d "$locked" ]]
[[ -f "$locked/dist/locked/output.txt" ]]
[[ -d "$unmerged" ]]
[[ -d "$dirty" ]]
git -C "$primary" show-ref --verify --quiet refs/heads/feature-merged
git -C "$primary" show-ref --verify --quiet refs/heads/feature-locked

stale_dry="$(cd "$primary" && scripts/cleanup-merged-worktree-artifacts.sh --stale-clean-hours=24)"
grep -Fq "$stale" <<<"$stale_dry"
grep -Fq 'qualify only via the stale-clean guard' <<<"$stale_dry"
if grep -Fq "$unmerged" <<<"$stale_dry" || grep -Fq "$detached" <<<"$stale_dry" || grep -Fq "$dirty" <<<"$stale_dry" || grep -Fq "$unreadable" <<<"$stale_dry"; then
  echo 'recent, detached, dirty, or unreadable worktree appeared in stale-clean eligibility' >&2
  exit 1
fi

(cd "$primary" && scripts/cleanup-merged-worktree-artifacts.sh --stale-clean-hours=24 --apply >/dev/null)
[[ ! -d "$stale" ]]
[[ -d "$unmerged" ]]
[[ -d "$detached" ]]
[[ -d "$dirty" ]]
[[ -d "$unreadable" ]]
git -C "$primary" show-ref --verify --quiet refs/heads/feature-stale

if (cd "$primary" && scripts/cleanup-merged-worktree-artifacts.sh --stale-clean-hours=0 >/dev/null 2>&1); then
  echo 'invalid stale-clean threshold was accepted' >&2
  exit 1
fi

chmod 0644 "$(git -C "$primary" rev-parse --git-path worktrees/$(basename "$unreadable")/index 2>/dev/null || true)" 2>/dev/null || true
chmod 0755 "$locked/dist/locked"
printf 'cleanup worktree safety contract: PASS\n'
