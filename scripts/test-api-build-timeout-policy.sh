#!/usr/bin/env bash
set -euo pipefail
script="deploy/oracle/deploy-api-blue-green.sh"
grep -Fq 'HAVA81_API_BUILD_TIMEOUT_SECONDS:-600' "$script"
grep -Fq 'timeout --signal=TERM --kill-after=30s "$BUILD_TIMEOUT_SECONDS" docker compose -p "$PROJECT_NAME" build weather-api' "$script"
grep -Fq 'traffic unchanged' "$script"
echo "API deploy build timeout policy ok"
