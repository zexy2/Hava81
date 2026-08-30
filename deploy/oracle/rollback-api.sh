#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

PREVIOUS_PORT_FILE="${HAVA81_API_PREVIOUS_PORT_FILE:-/var/lib/hava81/previous-api-port}"
TARGET="${1:-}"
if [[ -z "$TARGET" ]]; then
  if [[ ! -r "$PREVIOUS_PORT_FILE" ]]; then
    echo "rollback target is unknown: $PREVIOUS_PORT_FILE is missing or unreadable; pass 4000, 4001, or 4002 explicitly" >&2
    exit 1
  fi
  TARGET="$(tr -d "\r\n" <"$PREVIOUS_PORT_FILE")"
fi

case "$TARGET" in
  4000|4001|4002) ;;
  *)
    echo "invalid rollback target: ${TARGET:-empty} (expected 4000, 4001, or 4002)" >&2
    exit 1
    ;;
esac

exec ./switch-api-traffic.sh "$TARGET"
