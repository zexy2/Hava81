#!/usr/bin/env bash
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "install-observer.sh must run as root" >&2
  exit 1
fi

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
observer_dir="$repo/deploy/oracle/observer"

PYTHONDONTWRITEBYTECODE=1 python3 "$observer_dir/test_observer.py"
python3 - "$observer_dir/observer.py" "$observer_dir/hava81-worker-status.py" <<'PY'
from pathlib import Path
import sys
for filename in sys.argv[1:]:
    source = Path(filename).read_text(encoding='utf-8')
    compile(source, filename, 'exec')
PY

install -d -m 0755 /usr/local/lib/hava81-worker /usr/local/bin /etc/systemd/system
observer_tmp="$(mktemp /usr/local/lib/hava81-worker/.observer.py.XXXXXX)"
status_tmp="$(mktemp /usr/local/bin/.hava81-worker-status.XXXXXX)"
service_tmp="$(mktemp /etc/systemd/system/.hava81-observer.service.XXXXXX)"
timer_tmp="$(mktemp /etc/systemd/system/.hava81-observer.timer.XXXXXX)"
cleanup() {
  rm -f "$observer_tmp" "$status_tmp" "$service_tmp" "$timer_tmp"
}
trap cleanup EXIT

install -o root -g root -m 0755 "$observer_dir/observer.py" "$observer_tmp"
install -o root -g root -m 0755 "$observer_dir/hava81-worker-status.py" "$status_tmp"
install -o root -g root -m 0644 "$observer_dir/hava81-observer.service" "$service_tmp"
install -o root -g root -m 0644 "$observer_dir/hava81-observer.timer" "$timer_tmp"

# Each replacement is atomic on its target filesystem. The running oneshot therefore
# observes either a complete old collector or a complete new collector; the timer is
# never stopped or disabled during deployment.
mv -f "$observer_tmp" /usr/local/lib/hava81-worker/observer.py
mv -f "$status_tmp" /usr/local/bin/hava81-worker-status
mv -f "$service_tmp" /etc/systemd/system/hava81-observer.service
mv -f "$timer_tmp" /etc/systemd/system/hava81-observer.timer
trap - EXIT

systemctl daemon-reload
systemctl enable --now hava81-observer.timer >/dev/null
systemctl start hava81-observer.service
systemctl is-enabled --quiet hava81-observer.timer
systemctl is-active --quiet hava81-observer.timer
/usr/local/bin/hava81-worker-status
