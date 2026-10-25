#!/usr/bin/env bash
set -euo pipefail

readme='deploy/oracle/README.md'
workflow='.github/workflows/deploy-api.yml'
helper='scripts/check-api-deploy-secrets.sh'

fail() {
  printf 'FAIL: %s\n' "$*" >&2
  exit 1
}

grep -Fq 'the job fails with the missing secret names and explicitly reports that the published image was not deployed' "$readme" \
  || fail 'README must document the fail-closed missing-secret behavior'
if grep -Fq 'skips (the run stays green)' "$readme"; then
  fail 'README still claims missing secrets silently skip deployment'
fi
grep -Fq 'Check deploy secrets (fail closed)' "$workflow" \
  || fail 'workflow must keep the fail-closed secret gate'
grep -Fq 'run: bash scripts/check-api-deploy-secrets.sh' "$workflow" \
  || fail 'workflow must invoke the checked-in secret gate'
grep -Fq 'was NOT deployed' "$helper" \
  || fail 'secret gate must explicitly disclose that the image was not deployed'
grep -Fq 'exit 1' "$helper" \
  || fail 'secret gate must fail the workflow when credentials are missing'

printf 'API deploy README contract: PASS\n'
