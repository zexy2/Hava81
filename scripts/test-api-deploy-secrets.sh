#!/usr/bin/env bash
set -euo pipefail

script="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/check-api-deploy-secrets.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

bash -n "$script"

# Without GitHub's output file, the gate must fail rather than silently skip deploy.
if env -i PATH="$PATH" bash "$script" >"$tmp/no-output.log" 2>&1; then
  fail 'missing GITHUB_OUTPUT unexpectedly succeeded'
fi
grep -Fq 'GITHUB_OUTPUT is required' "$tmp/no-output.log" || fail 'missing output error not reported'

required=(ORACLE_SSH_HOST ORACLE_SSH_USER ORACLE_SSH_KEY ORACLE_SSH_KNOWN_HOSTS)
values=(host-secret user-secret key-secret known-hosts-secret)

run_gate() (
  export GITHUB_OUTPUT="$tmp/output"
  export GITHUB_STEP_SUMMARY="$tmp/summary"
  export HAVA81_API_IMAGE='ghcr.io/example/hava81-api:commit-sha'
  for i in "${!required[@]}"; do
    export "${required[$i]}=${values[$i]}"
  done
  if [[ -n "${1:-}" ]]; then
    unset "$1"
  fi
  bash "$script"
)

# Every missing credential must fail, name the missing key, and never leak values.
for missing in "${required[@]}"; do
  : >"$tmp/output"
  : >"$tmp/summary"
  if run_gate "$missing" >"$tmp/stdout" 2>&1; then
    fail "missing $missing unexpectedly succeeded"
  fi
  grep -Fq "$missing" "$tmp/stdout" || fail "missing $missing was not identified"
  if grep -Eq 'host-secret|user-secret|key-secret|known-hosts-secret' "$tmp/stdout" "$tmp/summary"; then
    fail 'a fake secret value leaked into logs or summary'
  fi
  if grep -Fq 'enabled=true' "$tmp/output"; then
    fail "missing $missing enabled deploy"
  fi
done

# All credentials present must opt in explicitly.
: >"$tmp/output"
: >"$tmp/summary"
run_gate >"$tmp/stdout" 2>&1 || fail 'complete credentials unexpectedly failed'
[[ "$(cat "$tmp/output")" == 'enabled=true' ]] || fail 'complete credentials did not enable deploy'
if grep -Eq 'host-secret|user-secret|key-secret|known-hosts-secret' "$tmp/stdout" "$tmp/summary"; then
  fail 'a fake secret value leaked on the success path'
fi

printf 'API deploy secret gate contract: PASS\n'
