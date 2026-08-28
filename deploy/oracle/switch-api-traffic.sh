#!/usr/bin/env bash
set -euo pipefail

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
  cp "$BACKUP" "$CFG"
  nginx -t
  echo "nginx validation failed; configuration restored" >&2
  exit 1
fi

systemctl reload nginx
sleep 1
curl -fsS "https://api.hava81.zekiakgul.dev/api/v1/health/ready" >/tmp/hava81-public-ready.json
cat /tmp/hava81-public-ready.json
echo
mkdir -p /var/lib/hava81
if [[ -f /var/lib/hava81/current-api-port ]]; then
  cp /var/lib/hava81/current-api-port /var/lib/hava81/previous-api-port
fi
printf '%s\n' "$TARGET_PORT" >/var/lib/hava81/current-api-port
printf 'traffic switched to 127.0.0.1:%s; backup=%s\n' "$TARGET_PORT" "$BACKUP"
