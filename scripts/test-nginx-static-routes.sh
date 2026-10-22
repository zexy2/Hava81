#!/usr/bin/env bash
# nginx.conf must serve pre-rendered routes and answer unknown paths with a real 404.
set -euo pipefail
conf="$(git rev-parse --show-toplevel)/nginx.conf"
fail() { echo "nginx.conf: $1" >&2; exit 1; }
grep -Fq 'try_files $uri $uri/ =404;' "$conf" || fail "location / must end try_files with =404"
grep -Fq 'error_page 404 /404.html;' "$conf" || fail "missing error_page 404 /404.html"
grep -Fq 'try_files $uri $uri/ /index.html' "$conf" && fail "SPA index.html fallback returns 200 for unknown paths"
grep -Fq 'Cache-Control "public, max-age=31536000, immutable"' "$conf" || fail "immutable /assets/ cache rule missing"
echo "nginx.conf: real 404 for unknown paths, pre-rendered routes and cache rules intact"
