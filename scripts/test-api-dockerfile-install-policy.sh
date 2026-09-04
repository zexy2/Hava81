#!/usr/bin/env bash
set -euo pipefail

dockerfile="apps/api/Dockerfile"
mapfile -t installs < <(grep -E '^RUN npm ci([[:space:]]|$)' "$dockerfile")
if [[ ${#installs[@]} -ne 2 ]]; then
  echo "expected exactly two API Docker npm ci layers" >&2
  exit 1
fi
for install in "${installs[@]}"; do
  if [[ " $install " != *" --no-audit "* ]]; then
    echo "API Dockerfile contains an npm ci layer without --no-audit: $install" >&2
    exit 1
  fi
done

echo "API Dockerfile npm install policy ok"
