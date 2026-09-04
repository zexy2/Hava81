#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
audit="$repo_root/scripts/audit-hava81-standalone-checkouts.sh"
fixture="$(mktemp -d '/tmp/hava81 audit.XXXXXX')"
trap 'rm -rf "$fixture"' EXIT

remote="$fixture/remote.git"
root="$fixture/checkouts"
canonical="$fixture/canonical"
mkdir -p "$root"
git init --bare -q "$remote"
git clone -q "$remote" "$canonical"

git -C "$canonical" config user.name Hava81-Test
git -C "$canonical" config user.email test@hava81.invalid
printf 'base\n' > "$canonical/README.md"
git -C "$canonical" add README.md
git -C "$canonical" commit -q -m base
git -C "$canonical" branch -M main
git -C "$canonical" push -q -u origin main
git --git-dir="$remote" symbolic-ref HEAD refs/heads/main

git clone -q "$remote" "$root/hava81-merged"
git clone -q "$remote" "$root/hava81-dirty"
git clone -q "$remote" "$root/hava81-unrepresented"
git clone -q "$remote" "$root/hava81-remote-ancestor"
git -C "$root/hava81-remote-ancestor" config user.name Hava81-Test
git -C "$root/hava81-remote-ancestor" config user.email test@hava81.invalid
printf 'archived base\n' > "$root/hava81-remote-ancestor/archive.txt"
git -C "$root/hava81-remote-ancestor" add archive.txt
git -C "$root/hava81-remote-ancestor" commit -q -m 'archive base'
archived_head="$(git -C "$root/hava81-remote-ancestor" rev-parse HEAD)"
git -C "$root/hava81-remote-ancestor" push -q origin HEAD:archive/test
printf 'later archive tip\n' >> "$root/hava81-remote-ancestor/archive.txt"
git -C "$root/hava81-remote-ancestor" commit -qam 'later archive tip'
git -C "$root/hava81-remote-ancestor" push -q origin HEAD:archive/test
git -C "$canonical" fetch -q origin archive/test:refs/remotes/origin/archive/test
git -C "$root/hava81-remote-ancestor" reset -q --hard "$archived_head"
printf 'dirty\n' > "$root/hava81-dirty/local.txt"
git -C "$root/hava81-unrepresented" config user.name Hava81-Test
git -C "$root/hava81-unrepresented" config user.email test@hava81.invalid
printf 'private\n' > "$root/hava81-unrepresented/private.txt"
git -C "$root/hava81-unrepresented" add private.txt
git -C "$root/hava81-unrepresented" commit -q -m private

output="$(cd "$canonical" && "$audit" --root="$root")"
printf '%s\n' "$output"

awk -F '\t' -v path="$root/hava81-merged" '$1 == "SAFE_TO_ARCHIVE" && $3 == path { found=1 } END { exit !found }' <<<"$output"
awk -F '\t' -v path="$root/hava81-remote-ancestor" '$1 == "SAFE_TO_ARCHIVE" && $3 == path { found=1 } END { exit !found }' <<<"$output"
awk -F '\t' -v path="$root/hava81-dirty" '$1 == "DIRTY" && $3 == path { found=1 } END { exit !found }' <<<"$output"
awk -F '\t' -v path="$root/hava81-unrepresented" '$1 == "UNREPRESENTED" && $3 == path { found=1 } END { exit !found }' <<<"$output"
grep -Fq 'Audit: 2 clean fully represented standalone checkouts' <<<"$output"

echo 'standalone checkout audit contract passed'
