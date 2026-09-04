#!/usr/bin/env bash
set -euo pipefail

if (( $# == 0 )); then
  echo "Usage: scripts/run-npm-audit-with-retry.sh <npm audit command...>" >&2
  exit 2
fi

max_attempts="${NPM_AUDIT_MAX_ATTEMPTS:-3}"
sleep_seconds="${NPM_AUDIT_RETRY_SLEEP_SECONDS:-5}"
attempt_timeout_seconds="${NPM_AUDIT_ATTEMPT_TIMEOUT_SECONDS:-90}"
allow_transient_unavailable="${NPM_AUDIT_ALLOW_TRANSIENT_UNAVAILABLE:-0}"

if [[ ! "$max_attempts" =~ ^[1-9][0-9]*$ ]]; then
  echo "NPM_AUDIT_MAX_ATTEMPTS must be an integer >= 1" >&2
  exit 2
fi
if [[ ! "$sleep_seconds" =~ ^[0-9]+$ ]]; then
  echo "NPM_AUDIT_RETRY_SLEEP_SECONDS must be an integer >= 0" >&2
  exit 2
fi
if [[ ! "$attempt_timeout_seconds" =~ ^[1-9][0-9]*$ ]]; then
  echo "NPM_AUDIT_ATTEMPT_TIMEOUT_SECONDS must be an integer >= 1" >&2
  exit 2
fi
if [[ "$allow_transient_unavailable" != "0" && "$allow_transient_unavailable" != "1" ]]; then
  echo "NPM_AUDIT_ALLOW_TRANSIENT_UNAVAILABLE must be 0 or 1" >&2
  exit 2
fi

is_transient_registry_failure() {
  local log_file="$1"
  grep -Eiq '(^|[^0-9])5[0-9]{2} (Service Unavailable|Bad Gateway|Gateway Timeout|Internal Server Error)|EAI_AGAIN|ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENETUNREACH|network timeout|fetch failed|audit endpoint returned an error' "$log_file"
}

attempt=1
while (( attempt <= max_attempts )); do
  log_file="$(mktemp)"
  trap 'rm -f "$log_file"' EXIT

  set +e
  timeout --signal=TERM --kill-after=5s "${attempt_timeout_seconds}s" "$@" 2>&1 | tee "$log_file"
  status=${PIPESTATUS[0]}
  set -e

  if (( status == 0 )); then
    rm -f "$log_file"
    trap - EXIT
    exit 0
  fi

  if (( status != 124 )) && ! is_transient_registry_failure "$log_file"; then
    rm -f "$log_file"
    trap - EXIT
    exit "$status"
  fi

  if (( attempt == max_attempts )); then
    if [[ "$allow_transient_unavailable" == "1" ]]; then
      echo "::warning::npm audit registry remained unavailable after ${max_attempts} bounded attempts; continuing without converting infrastructure unavailability into a product failure. Known advisories still fail closed." >&2
      rm -f "$log_file"
      trap - EXIT
      exit 0
    fi
    echo "npm audit failed after ${max_attempts} attempts because the registry remained unavailable." >&2
    rm -f "$log_file"
    trap - EXIT
    exit "$status"
  fi

  echo "Transient npm audit registry failure; retrying (${attempt}/${max_attempts})..." >&2
  rm -f "$log_file"
  trap - EXIT
  if (( sleep_seconds > 0 )); then
    sleep "$sleep_seconds"
  fi
  attempt=$((attempt + 1))
done
