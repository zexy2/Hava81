#!/usr/bin/env bash
# The blue/green deploy builds on the host by default (manual flow) and pulls a
# prebuilt GHCR image when HAVA81_API_IMAGE is set (CI flow). Both must report a
# verifiable build revision.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP_DIR="$(mktemp -d /tmp/hava81-image-source-plan.XXXXXX)"
trap 'rm -rf "$TMP_DIR"' EXIT
NGINX="$TMP_DIR/nginx.conf"
printf 'proxy_pass http://127.0.0.1:4002;\n' >"$NGINX"

plan() {
  CURRENT_API_PORT=4002 \
  HAVA81_NGINX_SITE="$NGINX" \
  HAVA81_API_OPERATION_LOCK="$TMP_DIR/lock" \
  PLAN_ONLY=1 \
  "$@" bash "$REPO_ROOT/deploy/oracle/deploy-api-blue-green.sh"
}
fail() { echo "FAIL: $*" >&2; exit 1; }

SHA=0123456789abcdef0123456789abcdef01234567
out="$(plan env -u HAVA81_API_IMAGE -u HAVA81_API_REVISION)"
grep -qF '[api] source=build image=<local build>' <<<"$out" || fail "default must build locally"

out="$(plan env HAVA81_API_IMAGE="ghcr.io/zexy2/hava81-api:$SHA" HAVA81_API_REVISION="$SHA")"
grep -qF "[api] source=pull image=ghcr.io/zexy2/hava81-api:$SHA revision=$SHA verify_revision=yes" <<<"$out" || fail "pull plan missing"
out="$(plan env HAVA81_API_IMAGE="ghcr.io/zexy2/hava81-api:$SHA" HAVA81_API_REVISION="$SHA" HAVA81_API_VERIFY_REVISION=0)"
grep -qE 'verify_revision=$' <<<"$out" || fail "revision opt-out ignored"

if plan env HAVA81_API_IMAGE='ghcr.io/zexy2/hava81-api:x;reboot' >/dev/null 2>&1; then fail "unsafe image accepted"; fi
if plan env HAVA81_API_IMAGE="ghcr.io/zexy2/hava81-api:$SHA" HAVA81_API_REVISION='a b' >/dev/null 2>&1; then
  fail "unsafe revision accepted"
fi

script="$REPO_ROOT/deploy/oracle/deploy-api-blue-green.sh"
grep -Fq 'docker pull "$API_IMAGE"' "$script" || fail "pull step missing"
grep -Fq 'docker compose -p "$PROJECT_NAME" up -d --no-build --force-recreate weather-api' "$script" || fail "pulled image must not be rebuilt"
grep -Fq 'validate_slot "$TARGET_PORT" "$PROJECT_NAME" "$VERIFY_REVISION"' "$script" || fail "candidate revision not verified"
grep -Fq 'HAVA81_API_REVISION: ${HAVA81_API_REVISION:-unknown}' "$REPO_ROOT/deploy/oracle/docker-compose.yml" || fail "compose build-arg missing"
grep -Fq 'ARG HAVA81_API_REVISION=unknown' "$REPO_ROOT/apps/api/Dockerfile" || fail "Dockerfile build-arg missing"
for lock_user in "$script" "$REPO_ROOT/deploy/oracle/switch-api-traffic.sh" "$REPO_ROOT/deploy/oracle/ci-deploy-api.sh"; do
  grep -Fq '/var/lib/hava81/api-operation.lock' "$lock_user" || fail "lock default differs in $lock_user"
done

echo "API image-source deployment plan checks passed"
