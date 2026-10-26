#!/usr/bin/env bash
set -euo pipefail

file=Dockerfile.dev
[[ -f "$file" ]]
grep -Fxq 'FROM node:26-alpine' "$file"
line=$(grep -E '^RUN npm ci --legacy-peer-deps([[:space:]]|$)' "$file")
for flag in \
  '--fetch-retries=5' \
  '--fetch-retry-factor=2' \
  '--fetch-retry-mintimeout=10000' \
  '--fetch-retry-maxtimeout=60000'; do
  [[ "$line" == *"$flag"* ]] || { echo "Missing development install retry flag: $flag" >&2; exit 1; }
done
grep -Fxq 'EXPOSE 3000' "$file"
grep -Fxq 'CMD ["npm", "start", "--", "--port", "3000", "--strictPort"]' "$file"
echo 'Development Docker install retries and port contract are valid.'
