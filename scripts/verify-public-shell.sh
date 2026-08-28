#!/usr/bin/env bash
set -euo pipefail

base_url="${HAVA81_PUBLIC_URL:-https://hava81.zekiakgul.dev}"
base_url="${base_url%/}"
attempts="${HAVA81_SMOKE_ATTEMPTS:-12}"
delay_seconds="${HAVA81_SMOKE_DELAY_SECONDS:-5}"

check_path() {
  local path="$1"
  local expected="$2"
  local body
  local code
  body="$(mktemp)"
  trap "rm -f " RETURN

  for ((attempt = 1; attempt <= attempts; attempt++)); do
    code="$(curl --location --silent --show-error --output "$body" --write-out "%{http_code}" "${base_url}${path}" || true)"
    if [[ "$code" == "200" ]] && grep -Fq "$expected" "$body"; then
      printf "ok %s (attempt %s/%s)\n" "$path" "$attempt" "$attempts"
      return 0
    fi

    if (( attempt < attempts )); then
      sleep "$delay_seconds"
    fi
  done

  printf "public smoke failed for %s (last HTTP %s)\n" "$path" "$code" >&2
  return 1
}

check_path "/" "Hava81"
check_path "/istanbul/" "Hava81"
check_path "/manifest.json" name
check_path "/sw.js" "notificationclick"
