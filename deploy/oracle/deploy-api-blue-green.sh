#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

# Default lives under /var/lib/hava81 (root-owned state dir). The former
# /var/lock default sits in a sticky world-writable directory where a lock file
# created by another user cannot be reopened even by root (fs.protected_regular).
OPERATION_LOCK="${HAVA81_API_OPERATION_LOCK:-/var/lib/hava81/api-operation.lock}"
mkdir -p "$(dirname "$OPERATION_LOCK")" 2>/dev/null || true
exec 9>"$OPERATION_LOCK"
if ! flock -n 9; then
  echo "another Hava81 API deploy/rollback operation is already running; refusing concurrent deploy" >&2
  exit 1
fi
export HAVA81_API_OPERATION_LOCK_FD=9

STATE_FILE="${HAVA81_API_STATE_FILE:-/var/lib/hava81/current-api-port}"
NGINX_SITE="${HAVA81_NGINX_SITE:-/etc/nginx/sites-enabled/api.hava81.zekiakgul.dev}"
CURRENT_PORT="${CURRENT_API_PORT:-}"
if [[ -z "$CURRENT_PORT" ]]; then
  if [[ ! -f "$STATE_FILE" ]]; then
    echo "current API state is missing: $STATE_FILE" >&2
    exit 1
  fi
  CURRENT_PORT="$(tr -d '\r\n' <"$STATE_FILE")"
fi

PREFERRED_PORT=4002
ROLLBACK_PORT=4001
SLOT_4001_PROJECT="${SLOT_4001_PROJECT:-hava81-green}"
SLOT_4002_PROJECT="${SLOT_4002_PROJECT:-hava81-v21-canary}"
PROMOTE_TO_PREFERRED=0
case "$CURRENT_PORT" in
  4001)
    TARGET_PORT=4002
    PROJECT_NAME="$SLOT_4002_PROJECT"
    ;;
  4002)
    TARGET_PORT=4001
    PROJECT_NAME="$SLOT_4001_PROJECT"
    PROMOTE_TO_PREFERRED=1
    ;;
  *)
    echo "unsupported current API port: $CURRENT_PORT (expected 4001 or 4002)" >&2
    exit 1
    ;;
esac

if [[ ! -r "$NGINX_SITE" ]]; then
  echo "Nginx API site is not readable: $NGINX_SITE" >&2
  exit 1
fi
NGINX_PORT="$(sed -nE 's#.*proxy_pass[[:space:]]+http://127\.0\.0\.1:(400[012]);.*#\1#p' "$NGINX_SITE" | head -n 1)"
if [[ "$NGINX_PORT" != "$CURRENT_PORT" ]]; then
  echo "API state/Nginx mismatch: state=$CURRENT_PORT nginx=${NGINX_PORT:-unknown}; refusing deploy" >&2
  exit 1
fi

REPO_ROOT="$(cd ../.. && pwd)"
git_repo() {
  git -c "safe.directory=$REPO_ROOT" -C "$REPO_ROOT" "$@"
}

HAVE_GIT=0
if git_repo rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  HAVE_GIT=1
  if [[ -n "$(git_repo status --porcelain -- apps/api)" ]]; then
    echo "apps/api has uncommitted changes; refusing production deploy" >&2
    exit 1
  fi
fi

# Image source. Default (manual operator flow): build apps/api from this
# checkout. With HAVA81_API_IMAGE set (CI flow): pull that prebuilt image, e.g.
# ghcr.io/zexy2/hava81-api:<sha>, instead of building on the host.
API_IMAGE="${HAVA81_API_IMAGE:-}"
if [[ -n "$API_IMAGE" ]]; then
  if [[ ! "$API_IMAGE" =~ ^[a-z0-9.-]+(:[0-9]+)?/[a-z0-9._/-]+(:[A-Za-z0-9._-]+|@sha256:[0-9a-f]{64})$ ]]; then
    echo "invalid HAVA81_API_IMAGE: $API_IMAGE" >&2
    exit 1
  fi
  IMAGE_SOURCE="pull"
else
  IMAGE_SOURCE="build"
fi

# Revision the candidate must report on /api/v1/health/ready before traffic
# moves. Pull mode: HAVA81_API_REVISION (CI passes the commit SHA). Build mode:
# the checkout HEAD, which is also passed to the image as a build-arg.
EXPECTED_REVISION="${HAVA81_API_REVISION:-}"
if [[ -z "$EXPECTED_REVISION" && "$IMAGE_SOURCE" == "build" && "$HAVE_GIT" == "1" ]]; then
  EXPECTED_REVISION="$(git_repo rev-parse HEAD)"
fi
if [[ -n "$EXPECTED_REVISION" && ! "$EXPECTED_REVISION" =~ ^[0-9A-Za-z._-]{1,64}$ ]]; then
  echo "invalid HAVA81_API_REVISION: $EXPECTED_REVISION" >&2
  exit 1
fi
export HAVA81_API_REVISION="${EXPECTED_REVISION:-unknown}"
# Escape hatch for redeploying an old commit whose API predates the revision
# field: HAVA81_API_VERIFY_REVISION=0 keeps the build-arg but skips the check.
VERIFY_REVISION="$EXPECTED_REVISION"
if [[ "${HAVA81_API_VERIFY_REVISION:-1}" == "0" ]]; then
  VERIFY_REVISION=""
fi

echo "[api] current=$CURRENT_PORT candidate=$TARGET_PORT final=$PREFERRED_PORT rollback=$ROLLBACK_PORT project=$PROJECT_NAME promote_to_preferred=$PROMOTE_TO_PREFERRED"
echo "[api] source=$IMAGE_SOURCE image=${API_IMAGE:-<local build>} revision=${EXPECTED_REVISION:-unknown} verify_revision=${VERIFY_REVISION:+yes}"
if [[ "${PLAN_ONLY:-0}" == "1" ]]; then
  exit 0
fi

if [[ ! -f .env ]]; then
  echo "deploy/oracle/.env is required before API deployment" >&2
  exit 1
fi

BUILD_DISK_RESERVE_BYTES="${HAVA81_API_BUILD_DISK_RESERVE_BYTES:-536870912}"
BUILD_DISK_MAX_USED_PERCENT="${HAVA81_API_BUILD_DISK_MAX_USED_PERCENT:-92}"
if [[ ! "$BUILD_DISK_RESERVE_BYTES" =~ ^[0-9]+$ ]]; then
  echo "invalid HAVA81_API_BUILD_DISK_RESERVE_BYTES: $BUILD_DISK_RESERVE_BYTES" >&2
  exit 1
fi
if [[ ! "$BUILD_DISK_MAX_USED_PERCENT" =~ ^[0-9]+$ || "$BUILD_DISK_MAX_USED_PERCENT" -lt 1 || "$BUILD_DISK_MAX_USED_PERCENT" -gt 99 ]]; then
  echo "invalid HAVA81_API_BUILD_DISK_MAX_USED_PERCENT: $BUILD_DISK_MAX_USED_PERCENT" >&2
  exit 1
fi
read -r BUILD_DISK_TOTAL_BYTES BUILD_DISK_FREE_BYTES < <(df -B1 --output=size,avail "$REPO_ROOT" | awk 'NR == 2 { print $1, $2 }')
if [[ ! "$BUILD_DISK_TOTAL_BYTES" =~ ^[0-9]+$ || ! "$BUILD_DISK_FREE_BYTES" =~ ^[0-9]+$ ]]; then
  echo "could not determine filesystem capacity before API build; traffic unchanged" >&2
  exit 1
fi
BUILD_DISK_REQUIRED_FOR_USAGE=$((
  (BUILD_DISK_TOTAL_BYTES * (100 - BUILD_DISK_MAX_USED_PERCENT) + 99) / 100
))
BUILD_DISK_REQUIRED_BYTES=$((BUILD_DISK_REQUIRED_FOR_USAGE + BUILD_DISK_RESERVE_BYTES))
if (( BUILD_DISK_FREE_BYTES < BUILD_DISK_REQUIRED_BYTES )); then
  echo "insufficient disk headroom for API build: free=$BUILD_DISK_FREE_BYTES required=$BUILD_DISK_REQUIRED_BYTES reserve=$BUILD_DISK_RESERVE_BYTES max_used_percent=$BUILD_DISK_MAX_USED_PERCENT; traffic unchanged" >&2
  exit 1
fi

PREVIOUS_PRODUCTION_IMAGE=""
if [[ "$PROMOTE_TO_PREFERRED" == "1" ]]; then
  mapfile -t preferred_containers < <(docker ps --filter "publish=4002" --format '{{.ID}}')
  if [[ "${#preferred_containers[@]}" != "1" ]]; then
    echo "expected exactly one active production container on 4002; found ${#preferred_containers[@]}; refusing deploy" >&2
    exit 1
  fi
  preferred_container="${preferred_containers[0]}"
  PREVIOUS_PRODUCTION_IMAGE="$(docker inspect --format '{{.Image}}' "$preferred_container")"
  if [[ -z "$PREVIOUS_PRODUCTION_IMAGE" ]]; then
    echo "could not resolve current 4002 production image; refusing deploy" >&2
    exit 1
  fi
fi

export HOST_PORT="$TARGET_PORT"
BUILD_TIMEOUT_SECONDS="${HAVA81_API_BUILD_TIMEOUT_SECONDS:-600}"
if [[ ! "$BUILD_TIMEOUT_SECONDS" =~ ^[1-9][0-9]*$ ]]; then
  echo "invalid HAVA81_API_BUILD_TIMEOUT_SECONDS: $BUILD_TIMEOUT_SECONDS" >&2
  exit 1
fi
if [[ "$IMAGE_SOURCE" == "pull" ]]; then
  # DOCKER_CONFIG may point at a short-lived registry credential (CI passes the
  # job's GITHUB_TOKEN); a public GHCR package needs no login at all.
  if ! timeout --signal=TERM --kill-after=30s "$BUILD_TIMEOUT_SECONDS" docker pull "$API_IMAGE"; then
    echo "API image pull failed or exceeded ${BUILD_TIMEOUT_SECONDS}s: $API_IMAGE; traffic unchanged" >&2
    exit 1
  fi
  docker tag "$API_IMAGE" "${PROJECT_NAME}-weather-api:latest"
  docker compose -p "$PROJECT_NAME" up -d --no-build --force-recreate weather-api
else
  if ! timeout --signal=TERM --kill-after=30s "$BUILD_TIMEOUT_SECONDS" docker compose -p "$PROJECT_NAME" build weather-api; then
    echo "API image build failed or exceeded ${BUILD_TIMEOUT_SECONDS}s; traffic unchanged" >&2
    exit 1
  fi
  docker compose -p "$PROJECT_NAME" up -d weather-api
fi

READY_FILE="$(mktemp "/tmp/hava81-api-ready.XXXXXX.json")"
READY_HEADERS="$(mktemp "/tmp/hava81-api-ready.XXXXXX.headers")"
HOURLY_FILE="$(mktemp "/tmp/hava81-api-hourly.XXXXXX.json")"
cleanup() {
  rm -f "$READY_FILE" "$READY_HEADERS" "$HOURLY_FILE"
}
trap cleanup EXIT

validate_ready_port() {
  local port="$1"
  local expected_revision="${2:-}"
  local ready=0
  echo "[api] waiting for readiness on $port${expected_revision:+ (revision $expected_revision)}"
  for _attempt in $(seq 1 30); do
    if curl -fsS --max-time 5 -D "$READY_HEADERS" \
      "http://127.0.0.1:${port}/api/v1/health/ready" >"$READY_FILE" && \
      HAVA81_EXPECTED_API_REVISION="$expected_revision" \
        python3 "$PWD/validate-api-readiness.py" "$READY_FILE" "$READY_HEADERS"; then
      ready=1
      break
    fi
    sleep 2
  done
  if [[ "$ready" != "1" ]]; then
    echo "API on $port did not satisfy the readiness contract" >&2
    return 1
  fi
  cat "$READY_FILE"
  echo
}

validate_hourly_smoke() {
  local port="$1"
  curl -fsS --max-time 15 \
    "http://127.0.0.1:${port}/api/v1/weather/hourly?lat=41.0082&lon=28.9784&lang=tr" \
    >"$HOURLY_FILE" && \
  python3 - "$HOURLY_FILE" <<'PY'
import json
import sys
from pathlib import Path

payload = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
meta = payload.get('meta') or {}
hourly = payload.get('hourly') or []
if meta.get('provider') != 'Open-Meteo' or meta.get('intervalHours') != 1 or not hourly:
    raise SystemExit('hourly provider smoke failed')
print(f"[api] hourly smoke ok provider={meta.get('provider')} points={len(hourly)}")
PY
}

validate_slot() {
  local port="$1"
  local project="$2"
  local expected_revision="${3:-}"
  if ! validate_ready_port "$port" "$expected_revision"; then
    docker compose -p "$project" ps >&2 || true
    docker compose -p "$project" logs --tail=100 weather-api >&2 || true
    return 1
  fi

  echo "[api] running hourly provider smoke on $port"
  local hourly_ok=0
  local attempt
  for attempt in 1 2 3; do
    if validate_hourly_smoke "$port"; then
      hourly_ok=1
      break
    fi
    echo "[api] hourly provider smoke attempt $attempt failed on $port" >&2
    if [[ "$attempt" -lt 3 ]]; then
      sleep 2
    fi
  done
  if [[ "$hourly_ok" != "1" ]]; then
    echo "API on $port failed hourly provider smoke after 3 attempts" >&2
    docker compose -p "$project" logs --tail=100 weather-api >&2 || true
    return 1
  fi
}

if ! validate_slot "$TARGET_PORT" "$PROJECT_NAME" "$VERIFY_REVISION"; then
  echo "candidate API on $TARGET_PORT failed validation; traffic unchanged" >&2
  exit 1
fi

candidate_container="$(HOST_PORT="$TARGET_PORT" docker compose -p "$PROJECT_NAME" ps -q weather-api)"
if [[ -z "$candidate_container" ]]; then
  echo "validated candidate container on $TARGET_PORT is missing; traffic unchanged" >&2
  exit 1
fi
CANDIDATE_IMAGE="$(docker inspect --format '{{.Image}}' "$candidate_container")"
if [[ -z "$CANDIDATE_IMAGE" ]]; then
  echo "could not resolve validated candidate image; traffic unchanged" >&2
  exit 1
fi

if [[ "$PROMOTE_TO_PREFERRED" == "1" ]]; then
  echo "[api] temporarily switching public traffic to validated canary on 4001"
  ./switch-api-traffic.sh 4001

  echo "[api] promoting exact validated image to preferred production slot 4002"
  docker tag "$CANDIDATE_IMAGE" "${SLOT_4002_PROJECT}-weather-api:latest"
  HOST_PORT=4002 docker compose -p "$SLOT_4002_PROJECT" up -d --no-build --force-recreate weather-api
  if ! validate_slot 4002 "$SLOT_4002_PROJECT" "$VERIFY_REVISION"; then
    echo "preferred 4002 promotion failed; validated canary remains active on 4001" >&2
    exit 1
  fi

  ./switch-api-traffic.sh 4002

  echo "[api] restoring previous production image to rollback slot 4001"
  docker tag "$PREVIOUS_PRODUCTION_IMAGE" "${SLOT_4001_PROJECT}-weather-api:latest"
  HOST_PORT=4001 docker compose -p "$SLOT_4001_PROJECT" up -d --no-build --force-recreate weather-api
  if ! validate_slot 4001 "$SLOT_4001_PROJECT"; then
    echo "production is healthy on 4002 but rollback slot 4001 failed restoration" >&2
    exit 1
  fi
else
  ./switch-api-traffic.sh 4002
fi

# Record what now serves traffic. Prefer the verified image revision (pull
# mode may run from a checkout that differs from the image); fall back to HEAD.
mkdir -p /var/lib/hava81
DEPLOYED_REVISION="$EXPECTED_REVISION"
if [[ -z "$DEPLOYED_REVISION" && "$HAVE_GIT" == "1" ]]; then
  DEPLOYED_REVISION="$(git_repo rev-parse HEAD)"
fi
if [[ -n "$DEPLOYED_REVISION" ]]; then
  printf '%s\n' "$DEPLOYED_REVISION" > /var/lib/hava81/current-api-revision
fi
if [[ "$HAVE_GIT" == "1" ]]; then
  if ! git_repo rev-parse "${DEPLOYED_REVISION:-HEAD}:apps/api" > /var/lib/hava81/current-api-tree 2>/dev/null; then
    git_repo rev-parse HEAD:apps/api > /var/lib/hava81/current-api-tree
  fi
fi

echo "[api] deployment complete active=4002 rollback=4001 revision=${DEPLOYED_REVISION:-unknown} candidate_image=$CANDIDATE_IMAGE"