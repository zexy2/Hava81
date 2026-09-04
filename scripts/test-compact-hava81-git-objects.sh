#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
fixture="$(mktemp -d '/tmp/hava81 git compact.XXXXXX')"
trap 'rm -rf "$fixture"' EXIT

origin="$(git -C "$repo_root" remote get-url origin)"
candidate="$fixture/hava81-candidate"
foreign="$fixture/hava81-foreign"

git init -q "$candidate"
git -C "$candidate" config user.email test@example.com
git -C "$candidate" config user.name Test
git -C "$candidate" remote add origin "$origin"
for i in 1 2 3; do
  printf '%05000d\n' "$i" > "$candidate/file-$i.txt"
  git -C "$candidate" add "file-$i.txt"
  git -C "$candidate" commit -qm "fixture $i"
done
printf 'dirty working tree must survive\n' >> "$candidate/file-3.txt"

git init -q "$foreign"
git -C "$foreign" remote add origin https://github.com/example/foreign.git

before_status="$(git -C "$candidate" status --porcelain)"
before_head="$(git -C "$candidate" rev-parse HEAD)"
output="$(scripts/compact-hava81-git-objects.sh --root="$fixture" --min-loose-kib=0)"
grep -Fq "WOULD_COMPACT" <<<"$output"
grep -Fq "$candidate" <<<"$output"
! grep -Fq "$foreign" <<<"$output"
[[ "$(git -C "$candidate" status --porcelain)" == "$before_status" ]]

scripts/compact-hava81-git-objects.sh --root="$fixture" --min-loose-kib=0 --apply >/dev/null
[[ "$(git -C "$candidate" rev-parse HEAD)" == "$before_head" ]]
[[ "$(git -C "$candidate" status --porcelain)" == "$before_status" ]]
[[ -f "$candidate/file-3.txt" ]]

echo "Hava81 Git compaction preserves dirty source and refs"
