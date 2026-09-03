#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP_DIR="$(mktemp -d /tmp/hava81-stable-slot-plan.XXXXXX)"
trap 'rm -rf "$TMP_DIR"' EXIT

run_plan() {
  local current="$1"
  local expected="$2"
  local nginx="$TMP_DIR/nginx-$current.conf"
  local lock="$TMP_DIR/lock-$current"
  printf 'proxy_pass http://127.0.0.1:%s;\n' "$current" >"$nginx"
  local output
  output="$(
    CURRENT_API_PORT="$current" \
    HAVA81_NGINX_SITE="$nginx" \
    HAVA81_API_OPERATION_LOCK="$lock" \
    PLAN_ONLY=1 \
    bash "$REPO_ROOT/deploy/oracle/deploy-api-blue-green.sh"
  )"
  grep -qF "$expected" <<<"$output"
}

run_plan 4002 '[api] current=4002 candidate=4001 final=4002 rollback=4001 project=hava81-green promote_to_preferred=1'
run_plan 4001 '[api] current=4001 candidate=4002 final=4002 rollback=4001 project=hava81-v21-canary promote_to_preferred=0'

echo "API stable-slot deployment plans preserve 4002 primary / 4001 rollback topology"
