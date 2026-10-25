#!/usr/bin/env bash
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
installer="$repo/deploy/oracle/install-observer.sh"
service="$repo/deploy/oracle/observer/hava81-observer.service"
readme="$repo/deploy/oracle/observer/README.md"

# Upgrade must serialize with the currently installed runtime lock and then migrate
# the collector to a persistent lock that systemd cannot unlink between oneshot runs.
grep -Fq 'legacy_lock_file=/run/hava81-worker/observer.lock' "$installer"
grep -Fq 'observer_lock_file=/var/lib/hava81-worker/observer.lock' "$installer"
grep -Fq 'flock -x -w 60 "$legacy_lock_fd"' "$installer"
grep -Fq 'flock -x -w 60 "$observer_lock_fd"' "$installer"
grep -Fq 'flock -u "$legacy_lock_fd"' "$installer"
grep -Fq 'flock -u "$observer_lock_fd"' "$installer"
grep -Fq 'ExecStart=/usr/bin/flock -n /var/lib/hava81-worker/observer.lock' "$service"
grep -Fq 'StateDirectory=hava81-worker' "$service"
grep -Fq 'RuntimeDirectory=hava81-worker' "$service"
grep -Fq 'legacy `/run/hava81-worker/observer.lock`' "$readme"
grep -Fq 'persistent `/var/lib/hava81-worker/observer.lock`' "$readme"

reload_line=$(grep -n '^systemctl daemon-reload$' "$installer" | cut -d: -f1)
persistent_unlock_line=$(grep -n '^flock -u "\$observer_lock_fd"$' "$installer" | cut -d: -f1)
legacy_unlock_line=$(grep -n '^flock -u "\$legacy_lock_fd"$' "$installer" | cut -d: -f1)
start_line=$(grep -n '^systemctl start hava81-observer.service$' "$installer" | cut -d: -f1)
(( reload_line < persistent_unlock_line && reload_line < legacy_unlock_line ))
(( persistent_unlock_line < start_line && legacy_unlock_line < start_line ))

if grep -Eq '^systemctl (stop|disable) hava81-observer\.(timer|service)' "$installer"; then
  echo 'observer installer must never stop or disable the five-minute timer' >&2
  exit 1
fi
grep -Fq 'systemctl enable --now hava81-observer.timer' "$installer"
grep -Fq 'systemctl is-active --quiet hava81-observer.timer' "$installer"

# Exercise real flock contention with the same exclusive/non-blocking contract used
# by the service, without touching the live host's lock files.
tmp_dir="$(mktemp -d /tmp/hava81-observer-lock-test.XXXXXX)"
cleanup() {
  if [[ -n "${holder_pid:-}" ]]; then
    kill "$holder_pid" 2>/dev/null || true
    wait "$holder_pid" 2>/dev/null || true
  fi
  rm -rf "$tmp_dir"
}
trap cleanup EXIT
lock_file="$tmp_dir/observer.lock"
ready_file="$tmp_dir/held"
(
  exec 8>"$lock_file"
  flock -n 8
  : > "$ready_file"
  sleep 2
) &
holder_pid=$!
for _attempt in $(seq 1 100); do
  [[ -f "$ready_file" ]] && break
  sleep 0.01
done
[[ -f "$ready_file" ]]
if flock -n "$lock_file" true 2>/dev/null; then
  echo 'observer lock contention check unexpectedly acquired the held lock' >&2
  exit 1
fi
kill "$holder_pid" 2>/dev/null || true
wait "$holder_pid" 2>/dev/null || true
holder_pid=

printf '%s\n' 'Observer installer lock migration contract passed'
