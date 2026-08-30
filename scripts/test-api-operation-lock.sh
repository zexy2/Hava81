#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP_DIR="$(mktemp -d /tmp/hava81-operation-lock-test.XXXXXX)"
cleanup() {
  if [[ -n "${LOCK_HOLDER_PID:-}" ]]; then
    kill "$LOCK_HOLDER_PID" 2>/dev/null || true
    wait "$LOCK_HOLDER_PID" 2>/dev/null || true
  fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

LOCK_FILE="$TMP_DIR/api-operation.lock"
NGINX_SITE="$TMP_DIR/api.conf"
READY_FILE="$TMP_DIR/lock-held"
cat >"$NGINX_SITE" <<'CONF'
location / {
  proxy_pass http://127.0.0.1:4002;
}
CONF

run_plan() {
  (
    cd "$REPO_ROOT"
    CURRENT_API_PORT=4002 \
      HAVA81_API_OPERATION_LOCK="$LOCK_FILE" \
      HAVA81_NGINX_SITE="$NGINX_SITE" \
      PLAN_ONLY=1 \
      bash deploy/oracle/deploy-api-blue-green.sh
  )
}

run_plan >/dev/null

(
  exec 8>"$LOCK_FILE"
  flock -n 8
  : >"$READY_FILE"
  sleep 3
) &
LOCK_HOLDER_PID=$!
for _attempt in $(seq 1 50); do
  [[ -f "$READY_FILE" ]] && break
  sleep 0.02
done
[[ -f "$READY_FILE" ]] || { echo "failed to establish lock contention" >&2; exit 1; }

if run_plan >/dev/null 2>"$TMP_DIR/deploy-error"; then
  echo "concurrent deploy unexpectedly acquired the API operation lock" >&2
  exit 1
fi
grep -q "another Hava81 API deploy/rollback operation is already running" "$TMP_DIR/deploy-error"

if HAVA81_API_OPERATION_LOCK="$LOCK_FILE" \
  bash "$REPO_ROOT/deploy/oracle/switch-api-traffic.sh" 4001 \
  >/dev/null 2>"$TMP_DIR/switch-error"; then
  echo "concurrent traffic switch unexpectedly acquired the API operation lock" >&2
  exit 1
fi
grep -q "another Hava81 API deploy/rollback operation is already running" "$TMP_DIR/switch-error"

kill "$LOCK_HOLDER_PID" 2>/dev/null || true
wait "$LOCK_HOLDER_PID" 2>/dev/null || true
LOCK_HOLDER_PID=

echo "API operation lock contention checks passed"
