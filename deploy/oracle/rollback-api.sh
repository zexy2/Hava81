#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
TARGET="${1:-}"
if [[ -z "$TARGET" && -f /var/lib/hava81/previous-api-port ]]; then
  TARGET="$(tr -d "\r\n" </var/lib/hava81/previous-api-port)"
fi
TARGET="${TARGET:-4001}"
exec ./switch-api-traffic.sh "$TARGET"
