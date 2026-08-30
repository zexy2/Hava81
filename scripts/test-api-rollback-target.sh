#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP_DIR="$(mktemp -d /tmp/hava81-rollback-target-test.XXXXXX)"
trap 'rm -rf "$TMP_DIR"' EXIT
MISSING_FILE="$TMP_DIR/missing-previous-port"
INVALID_FILE="$TMP_DIR/invalid-previous-port"
printf '%s\n' 'not-a-port' >"$INVALID_FILE"

if HAVA81_API_PREVIOUS_PORT_FILE="$MISSING_FILE" \
  bash "$REPO_ROOT/deploy/oracle/rollback-api.sh" \
  >/dev/null 2>"$TMP_DIR/missing-error"; then
  echo "rollback unexpectedly guessed a target without previous state" >&2
  exit 1
fi
grep -q 'rollback target is unknown' "$TMP_DIR/missing-error"

if HAVA81_API_PREVIOUS_PORT_FILE="$INVALID_FILE" \
  bash "$REPO_ROOT/deploy/oracle/rollback-api.sh" \
  >/dev/null 2>"$TMP_DIR/invalid-error"; then
  echo "rollback unexpectedly accepted an invalid previous target" >&2
  exit 1
fi
grep -q 'invalid rollback target' "$TMP_DIR/invalid-error"

echo "API rollback target fail-closed checks passed"
