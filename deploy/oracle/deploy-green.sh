#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
PROJECT_NAME="${GREEN_PROJECT:-hava81-green}"
HOST_PORT="${GREEN_PORT:-4001}"
BUILD_TIMEOUT_SECONDS="${HAVA81_API_BUILD_TIMEOUT_SECONDS:-600}"
BUILD_DISK_RESERVE_BYTES="${HAVA81_API_BUILD_DISK_RESERVE_BYTES:-536870912}"
BUILD_DISK_MAX_USED_PERCENT="${HAVA81_API_BUILD_DISK_MAX_USED_PERCENT:-92}"
export HOST_PORT

if [[ ! "$BUILD_TIMEOUT_SECONDS" =~ ^[1-9][0-9]*$ ]]; then
  echo "invalid HAVA81_API_BUILD_TIMEOUT_SECONDS: $BUILD_TIMEOUT_SECONDS" >&2
  exit 1
fi
if [[ ! "$BUILD_DISK_RESERVE_BYTES" =~ ^[0-9]+$ ]]; then
  echo "invalid HAVA81_API_BUILD_DISK_RESERVE_BYTES: $BUILD_DISK_RESERVE_BYTES" >&2
  exit 1
fi
if [[ ! "$BUILD_DISK_MAX_USED_PERCENT" =~ ^[0-9]+$ || "$BUILD_DISK_MAX_USED_PERCENT" -lt 1 || "$BUILD_DISK_MAX_USED_PERCENT" -gt 99 ]]; then
  echo "invalid HAVA81_API_BUILD_DISK_MAX_USED_PERCENT: $BUILD_DISK_MAX_USED_PERCENT" >&2
  exit 1
fi
read -r BUILD_DISK_TOTAL_BYTES BUILD_DISK_FREE_BYTES < <(df -B1 --output=size,avail "$PWD" | awk 'NR == 2 { print $1, $2 }')
if [[ ! "$BUILD_DISK_TOTAL_BYTES" =~ ^[0-9]+$ || ! "$BUILD_DISK_FREE_BYTES" =~ ^[0-9]+$ ]]; then
  echo "could not determine filesystem capacity before green API build; traffic unchanged" >&2
  exit 1
fi
BUILD_DISK_REQUIRED_FOR_USAGE=$((
  (BUILD_DISK_TOTAL_BYTES * (100 - BUILD_DISK_MAX_USED_PERCENT) + 99) / 100
))
BUILD_DISK_REQUIRED_BYTES=$((BUILD_DISK_REQUIRED_FOR_USAGE + BUILD_DISK_RESERVE_BYTES))
if (( BUILD_DISK_FREE_BYTES < BUILD_DISK_REQUIRED_BYTES )); then
  echo "insufficient disk headroom for green API build: free=$BUILD_DISK_FREE_BYTES required=$BUILD_DISK_REQUIRED_BYTES reserve=$BUILD_DISK_RESERVE_BYTES max_used_percent=$BUILD_DISK_MAX_USED_PERCENT; traffic unchanged" >&2
  exit 1
fi

echo "[green] building project=${PROJECT_NAME} host_port=${HOST_PORT}"
timeout --signal=TERM --kill-after=30s "$BUILD_TIMEOUT_SECONDS" docker compose -p "$PROJECT_NAME" build weather-api
docker compose -p "$PROJECT_NAME" up -d weather-api

echo "[green] waiting for readiness"
for attempt in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${HOST_PORT}/api/v1/health/ready" >/tmp/hava81-green-ready.json; then
    cat /tmp/hava81-green-ready.json
    echo
    echo "[green] READY on ${HOST_PORT}"
    exit 0
  fi
  sleep 2
done

echo "[green] readiness failed" >&2
docker compose -p "$PROJECT_NAME" ps >&2 || true
docker compose -p "$PROJECT_NAME" logs --tail=100 weather-api >&2 || true
exit 1
