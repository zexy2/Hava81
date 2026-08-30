#!/usr/bin/env bash
set -euo pipefail

OPERATION_LOCK="${HAVA81_API_OPERATION_LOCK:-/var/lock/hava81-api-operation.lock}"
INHERITED_LOCK_FD="${HAVA81_API_OPERATION_LOCK_FD:-}"
if [[ -n "$INHERITED_LOCK_FD" ]]; then
  if [[ ! "$INHERITED_LOCK_FD" =~ ^[0-9]+$ ]] || ! flock -n "$INHERITED_LOCK_FD"; then
    echo "inherited Hava81 API operation lock is invalid or unavailable" >&2
    exit 1
  fi
else
  exec 9>"$OPERATION_LOCK"
  if ! flock -n 9; then
    echo "another Hava81 API deploy/rollback operation is already running; refusing concurrent traffic switch" >&2
    exit 1
  fi
fi

TARGET_PORT="${1:-}"
case "$TARGET_PORT" in
  4000|4001|4002) ;;
  *) echo "usage: $0 4000|4001|4002" >&2; exit 2 ;;
esac

CFG="/etc/nginx/sites-enabled/api.hava81.zekiakgul.dev"
BACKUP_DIR="/var/backups/hava81"
mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP="$BACKUP_DIR/api.hava81.zekiakgul.dev.${STAMP}.conf"
cp "$CFG" "$BACKUP"

READY_URL="http://127.0.0.1:${TARGET_PORT}/api/v1/health/ready"
PUBLIC_READY_URL="https://api.hava81.zekiakgul.dev/api/v1/health/ready"
TARGET_READY_FILE="$(mktemp /tmp/hava81-target-ready.XXXXXX.json)"
PUBLIC_READY_FILE="$(mktemp /tmp/hava81-public-ready.XXXXXX.json)"
cleanup() {
  rm -f "$TARGET_READY_FILE" "$PUBLIC_READY_FILE"
}
trap cleanup EXIT

wait_for_ready() {
  local url="$1"
  local output="$2"
  local attempt
  for attempt in 1 2 3; do
    if curl -fsS --max-time 5 "$url" >"$output"; then
      return 0
    fi
    sleep 2
  done
  return 1
}

restore_previous_config() {
  echo "restoring previous nginx API configuration from $BACKUP" >&2
  cp "$BACKUP" "$CFG"
  nginx -t
  systemctl reload nginx
}

if ! wait_for_ready "$READY_URL" "$TARGET_READY_FILE"; then
  echo "target API on 127.0.0.1:${TARGET_PORT} failed readiness checks; traffic unchanged" >&2
  exit 1
fi

python3 - "$CFG" "$TARGET_PORT" <<'PY'
from pathlib import Path
import re, sys
path = Path(sys.argv[1])
port = sys.argv[2]
text = path.read_text()
new, count = re.subn(r'proxy_pass http://127\.0\.0\.1:(?:4000|4001|4002);', f'proxy_pass http://127.0.0.1:{port};', text, count=1)
if count != 1:
    raise SystemExit('expected exactly one API proxy_pass target')
path.write_text(new)
PY

if ! nginx -t; then
  restore_previous_config
  echo "nginx validation failed; configuration restored" >&2
  exit 1
fi

if ! systemctl reload nginx; then
  restore_previous_config || true
  echo "nginx reload failed; previous configuration restored" >&2
  exit 1
fi
sleep 1
if ! wait_for_ready "$PUBLIC_READY_URL" "$PUBLIC_READY_FILE"; then
  restore_previous_config
  echo "public readiness failed; traffic rolled back to the previous API target" >&2
  exit 1
fi
cat "$PUBLIC_READY_FILE"
echo
mkdir -p /var/lib/hava81
if [[ -f /var/lib/hava81/current-api-port ]]; then
  cp /var/lib/hava81/current-api-port /var/lib/hava81/previous-api-port
fi
printf '%s\n' "$TARGET_PORT" >/var/lib/hava81/current-api-port
printf 'traffic switched to 127.0.0.1:%s; backup=%s\n' "$TARGET_PORT" "$BACKUP"
