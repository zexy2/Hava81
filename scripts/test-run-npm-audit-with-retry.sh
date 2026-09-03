#!/usr/bin/env bash
set -euo pipefail

script="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/run-npm-audit-with-retry.sh"
root="$(mktemp -d)"
trap 'rm -rf "$root"' EXIT

make_fake() {
  local path="$1"
  local body="$2"
  cat >"$path" <<EOF
#!/usr/bin/env bash
set -euo pipefail
$body
EOF
  chmod +x "$path"
}

counter="$root/counter"
printf '0' >"$counter"
make_fake "$root/transient-then-success" '
count=$(cat "$COUNTER_FILE")
count=$((count + 1))
printf "%s" "$count" > "$COUNTER_FILE"
if (( count < 3 )); then
  echo "npm warn audit 503 Service Unavailable - POST https://registry.npmjs.org/-/npm/v1/security/audits/quick - Service Unavailable" >&2
  echo "npm error audit endpoint returned an error" >&2
  exit 1
fi
exit 0
'
COUNTER_FILE="$counter" NPM_AUDIT_RETRY_SLEEP_SECONDS=0 "$script" "$root/transient-then-success"
[[ "$(cat "$counter")" == "3" ]]

printf '0' >"$counter"
make_fake "$root/advisory" '
count=$(cat "$COUNTER_FILE")
count=$((count + 1))
printf "%s" "$count" > "$COUNTER_FILE"
echo "high severity vulnerability found" >&2
exit 1
'
if COUNTER_FILE="$counter" NPM_AUDIT_RETRY_SLEEP_SECONDS=0 "$script" "$root/advisory"; then
  echo "expected advisory failure" >&2
  exit 1
fi
[[ "$(cat "$counter")" == "1" ]]

printf '0' >"$counter"
make_fake "$root/persistent-transient" '
count=$(cat "$COUNTER_FILE")
count=$((count + 1))
printf "%s" "$count" > "$COUNTER_FILE"
echo "npm error ETIMEDOUT while contacting registry" >&2
exit 1
'
if COUNTER_FILE="$counter" NPM_AUDIT_RETRY_SLEEP_SECONDS=0 "$script" "$root/persistent-transient"; then
  echo "expected persistent transient failure" >&2
  exit 1
fi
[[ "$(cat "$counter")" == "3" ]]

printf '0' >"$counter"
make_fake "$root/timeout" '
count=$(cat "$COUNTER_FILE")
count=$((count + 1))
printf "%s" "$count" > "$COUNTER_FILE"
sleep 10
'
if COUNTER_FILE="$counter" NPM_AUDIT_MAX_ATTEMPTS=2 NPM_AUDIT_ATTEMPT_TIMEOUT_SECONDS=1 NPM_AUDIT_RETRY_SLEEP_SECONDS=0 "$script" "$root/timeout"; then
  echo "expected bounded timeout failure" >&2
  exit 1
fi
[[ "$(cat "$counter")" == "2" ]]

echo "npm audit retry contract passed"
