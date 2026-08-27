#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
PROJECT_NAME="${GREEN_PROJECT:-hava81-green}"
HOST_PORT="${GREEN_PORT:-4001}"
export HOST_PORT

echo "[green] building project=${PROJECT_NAME} host_port=${HOST_PORT}"
docker compose -p "$PROJECT_NAME" build weather-api
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
