#!/usr/bin/env bash
set -euo pipefail

project_root="$(git rev-parse --show-toplevel)"
cleanup_script="$project_root/scripts/cleanup-hava81-browser-temp.sh"
tmp="$(mktemp -d)"
worker_pid=""
cleanup() {
  if [[ -n "$worker_pid" ]]; then
    kill "$worker_pid" >/dev/null 2>&1 || true
    wait "$worker_pid" >/dev/null 2>&1 || true
  fi
  rm -rf "$tmp"
}
trap cleanup EXIT

root="$tmp/chromium-tmp"
mkdir -p "$root/hava81-old" "$root/hava81-recent" "$root/not-hava81" "$root/h81meta" "$root/hava81-in-use"
printf 'old\n' > "$root/hava81-old/state"
printf 'recent\n' > "$root/hava81-recent/state"
printf 'other\n' > "$root/not-hava81/state"
printf 'legacy\n' > "$root/h81meta/state"
printf 'active\n' > "$root/hava81-in-use/state"
ln -s "$root/hava81-old" "$root/hava81-symlink"

touch -d '2 hours ago' "$root/hava81-old/state" "$root/hava81-old"
touch -d '2 hours ago' "$root/h81meta/state" "$root/h81meta"
touch -d '2 hours ago' "$root/hava81-in-use/state" "$root/hava81-in-use"

python3 -c 'import time; time.sleep(60)' "$root/hava81-in-use" &
worker_pid=$!
sleep 0.1

dry="$($cleanup_script --root="$root" --older-than-minutes=30)"
grep -Fq "$root/hava81-old" <<<"$dry"
grep -Fq "$root/h81meta" <<<"$dry"
for excluded in hava81-recent not-hava81 hava81-in-use hava81-symlink; do
  if grep -Fq "$root/$excluded" <<<"$dry"; then
    echo "unsafe browser temp candidate appeared: $excluded" >&2
    exit 1
  fi
done
[[ -d "$root/hava81-old" ]]
[[ -d "$root/h81meta" ]]

$cleanup_script --root="$root" --older-than-minutes=30 --apply >/dev/null
[[ ! -e "$root/hava81-old" ]]
[[ ! -e "$root/h81meta" ]]
[[ -d "$root/hava81-recent" ]]
[[ -d "$root/not-hava81" ]]
[[ -d "$root/hava81-in-use" ]]
[[ -L "$root/hava81-symlink" ]]

if $cleanup_script --root="$root" --older-than-minutes=0 >/dev/null 2>&1; then
  echo 'invalid browser temp age threshold was accepted' >&2
  exit 1
fi
if $cleanup_script --root=/ --older-than-minutes=30 >/dev/null 2>&1; then
  echo 'filesystem root was accepted as browser temp root' >&2
  exit 1
fi

printf 'browser temp cleanup safety contract: PASS\n'
