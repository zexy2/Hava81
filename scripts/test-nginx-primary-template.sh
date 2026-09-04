#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
config="$repo_root/deploy/oracle/nginx/api.hava81.zekiakgul.dev.conf"
compose="$repo_root/deploy/oracle/docker-compose.yml"

grep -Fq 'proxy_pass http://127.0.0.1:4002;' "$config"
if grep -Eq 'proxy_pass http://127\.0\.0\.1:(4000|4001);' "$config"; then
  echo "Nginx install template must default to preferred production port 4002" >&2
  exit 1
fi
grep -Fq '127.0.0.1:${HOST_PORT:-4002}:4000' "$compose"

echo "Nginx and compose install defaults agree on preferred API port 4002"
