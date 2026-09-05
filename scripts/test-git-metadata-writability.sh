#!/usr/bin/env bash
set -euo pipefail

project_root="$(git rev-parse --show-toplevel)"
audit_script="$project_root/scripts/audit-git-metadata-writability.sh"
tmp="$(mktemp -d)"
trap 'chmod -R u+w "$tmp" 2>/dev/null || true; rm -rf "$tmp"' EXIT

repo="$tmp/repo"
git init -b main "$repo" >/dev/null
git -C "$repo" config user.name 'Hava81 metadata test'
git -C "$repo" config user.email 'metadata-test@example.invalid'
printf 'base\n' > "$repo/base.txt"
git -C "$repo" add base.txt
git -C "$repo" commit -m base >/dev/null

"$audit_script" "$repo" | grep -Fq 'git metadata writability: PASS'

objects="$repo/.git/objects"
mkdir -p "$objects/aa"
chmod 0555 "$objects/aa"
if "$audit_script" "$repo" >/dev/null 2>"$tmp/error"; then
  echo 'audit accepted a non-writable Git object fan-out directory' >&2
  exit 1
fi
grep -Fq 'Git metadata is not writable' "$tmp/error"
grep -Fq "$objects/aa" "$tmp/error"

chmod 0755 "$objects/aa"
"$audit_script" "$repo" >/dev/null
printf 'git metadata writability contract: PASS\n'
