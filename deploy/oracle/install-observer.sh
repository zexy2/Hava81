#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "install-observer.sh must run as root" >&2
  exit 1
fi

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
observer_dir="$repo/deploy/oracle/observer"

PYTHONDONTWRITEBYTECODE=1 python3 -m unittest discover -s "$observer_dir" -p 'test_*.py'
python3 - "$observer_dir/observer.py" "$observer_dir/hava81-worker-status.py" <<'PY'
from pathlib import Path
import sys
for filename in sys.argv[1:]:
    source = Path(filename).read_text(encoding='utf-8')
    compile(source, filename, 'exec')
PY

install -d -m 0755 /usr/local/lib/hava81-worker /usr/local/bin /etc/systemd/system /etc/logrotate.d
observer_tmp="$(mktemp /usr/local/lib/hava81-worker/.observer.py.XXXXXX)"
status_tmp="$(mktemp /usr/local/bin/.hava81-worker-status.XXXXXX)"
service_tmp="$(mktemp /etc/systemd/system/.hava81-observer.service.XXXXXX)"
timer_tmp="$(mktemp /etc/systemd/system/.hava81-observer.timer.XXXXXX)"
logrotate_tmp="$(mktemp /etc/logrotate.d/.hava81-observer.XXXXXX)"
cleanup() {
  rm -f "$observer_tmp" "$status_tmp" "$service_tmp" "$timer_tmp" "$logrotate_tmp"
}
trap cleanup EXIT

install -o root -g root -m 0755 "$observer_dir/observer.py" "$observer_tmp"
install -o root -g root -m 0755 "$observer_dir/hava81-worker-status.py" "$status_tmp"
install -o root -g root -m 0644 "$observer_dir/hava81-observer.service" "$service_tmp"
install -o root -g root -m 0644 "$observer_dir/hava81-observer.timer" "$timer_tmp"
install -o root -g root -m 0644 "$observer_dir/hava81-observer.logrotate" "$logrotate_tmp"
/usr/sbin/logrotate --debug "$logrotate_tmp" >/dev/null

# The currently installed unit may still use the runtime-directory lock. Acquire
# that legacy lock during the migration and the persistent state-directory lock
# used by the new unit, so a timer invocation cannot overlap the file replacements.
install -d -o ubuntu -g ubuntu -m 0755 /run/hava81-worker /var/lib/hava81-worker
legacy_lock_file=/run/hava81-worker/observer.lock
observer_lock_file=/var/lib/hava81-worker/observer.lock
for lock_file in "$legacy_lock_file" "$observer_lock_file"; do
  if [[ ! -e "$lock_file" ]]; then
    install -o ubuntu -g ubuntu -m 0644 /dev/null "$lock_file"
  else
    chown ubuntu:ubuntu "$lock_file"
    chmod 0644 "$lock_file"
  fi
done
exec {legacy_lock_fd}>"$legacy_lock_file"
if ! flock -x -w 60 "$legacy_lock_fd"; then
  echo "timed out waiting for the legacy Hava81 observer lock" >&2
  exit 1
fi
exec {observer_lock_fd}>"$observer_lock_file"
if ! flock -x -w 60 "$observer_lock_fd"; then
  echo "timed out waiting for the Hava81 observer state lock" >&2
  exit 1
fi

# Keep both locks until systemd has loaded the new unit. Atomic file replacement
# prevents partial Python files; the shared locks prevent a collector from starting
# against a mixed set of observer/status/service revisions. The timer is never stopped
# or disabled during deployment.
mv -f "$observer_tmp" /usr/local/lib/hava81-worker/observer.py
mv -f "$status_tmp" /usr/local/bin/hava81-worker-status
mv -f "$service_tmp" /etc/systemd/system/hava81-observer.service
mv -f "$timer_tmp" /etc/systemd/system/hava81-observer.timer
mv -f "$logrotate_tmp" /etc/logrotate.d/hava81-observer
systemctl daemon-reload
flock -u "$observer_lock_fd"
exec {observer_lock_fd}>&-
flock -u "$legacy_lock_fd"
exec {legacy_lock_fd}>&-
trap - EXIT

systemctl enable --now hava81-observer.timer >/dev/null
systemctl start hava81-observer.service
systemctl is-enabled --quiet hava81-observer.timer
systemctl is-active --quiet hava81-observer.timer
/usr/local/bin/hava81-worker-status
