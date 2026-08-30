#!/usr/bin/env bash
set -euo pipefail

base_url="${HAVA81_PUBLIC_URL:-https://hava81.zekiakgul.dev}"
base_url="${base_url%/}"
attempts="${HAVA81_SMOKE_ATTEMPTS:-12}"
delay_seconds="${HAVA81_SMOKE_DELAY_SECONDS:-5}"
connect_timeout_seconds="${HAVA81_SMOKE_CONNECT_TIMEOUT_SECONDS:-5}"
max_time_seconds="${HAVA81_SMOKE_MAX_TIME_SECONDS:-15}"
smoke_token="${GITHUB_SHA:-$(date +%s)}"

sha256_file() {
  local digest
  digest="$(sha256sum "$1")"
  printf '%s' "${digest%% *}"
}

check_path() {
  local path="$1"
  local expected="$2"
  local local_file="${3:-}"
  local forbidden="${4:-}"
  local body
  local code
  local request_url
  local expected_sha=""
  local actual_sha=""

  body="$(mktemp)"
  if [[ -n "$local_file" && -f "$local_file" ]]; then
    expected_sha="$(sha256_file "$local_file")"
  fi

  for ((attempt = 1; attempt <= attempts; attempt++)); do
    request_url="${base_url}${path}"
    if [[ "$request_url" == *\?* ]]; then
      request_url="${request_url}&__hava81_smoke=${smoke_token}-${attempt}"
    else
      request_url="${request_url}?__hava81_smoke=${smoke_token}-${attempt}"
    fi

    code="$(curl --location --silent --show-error \
      --connect-timeout "$connect_timeout_seconds" \
      --max-time "$max_time_seconds" \
      --output "$body" --write-out "%{http_code}" "$request_url" || true)"
    actual_sha=""
    if [[ "$code" == "200" ]]; then
      actual_sha="$(sha256_file "$body")"
    fi

    if [[ "$code" == "200" ]] \
      && { [[ -z "$expected" ]] || grep -Fq "$expected" "$body"; } \
      && { [[ -z "$forbidden" ]] || ! grep -Fq "$forbidden" "$body"; } \
      && { [[ -z "$expected_sha" ]] || [[ "$actual_sha" == "$expected_sha" ]]; }; then
      printf 'ok %s (attempt %s/%s)\n' "$path" "$attempt" "$attempts"
      rm -f "$body"
      return 0
    fi

    if (( attempt < attempts )); then
      sleep "$delay_seconds"
    fi
  done

  printf 'public smoke failed for %s (last HTTP %s' "$path" "$code" >&2
  if [[ -n "$expected_sha" ]]; then
    printf ', expected sha256 %s, received %s' "$expected_sha" "${actual_sha:-unavailable}" >&2
  fi
  printf ')\n' >&2
  rm -f "$body"
  return 1
}

# When the deploy artifact is present, hash equality ensures the smoke test waits
# for the exact GitHub Pages release instead of accepting a healthy stale shell.
check_path "/" "hava81-favicon.ico" "dist/index.html" "/react.svg"
check_path "/istanbul/" "İstanbul hava durumu ve gün planı — Hava81" "dist/istanbul/index.html"
check_path "/manifest.json" '"short_name": "Hava81"' "dist/manifest.json" '"React App"'
check_path "/sw.js" "notificationclick" "dist/sw.js"
check_path "/hava81-mark.svg" "<svg" "dist/hava81-mark.svg"
check_path "/hava81-favicon.ico" "" "dist/hava81-favicon.ico"
check_path "/hava81-social-card.png" "" "dist/hava81-social-card.png"
