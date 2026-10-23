#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="$ROOT/scripts/dispatch-main-ci-after-dependabot-merge.sh"
WORKFLOW="$ROOT/.github/workflows/dependabot-automerge.yml"
OPS_WORKFLOW="$ROOT/.github/workflows/ops-scripts.yml"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Static workflow contract: the post-merge job is scoped to merged Dependabot PRs
# targeting main and delegates its guarded decision to the testable shell script.
grep -Fq 'types: [opened, synchronize, reopened, closed]' "$WORKFLOW"
grep -Fq "github.event.pull_request.merged == true" "$WORKFLOW"
grep -Fq "github.event.pull_request.user.login == 'dependabot[bot]'" "$WORKFLOW"
grep -Fq "github.event.pull_request.base.ref == 'main'" "$WORKFLOW"
grep -Fq 'uses: actions/checkout@v7' "$WORKFLOW"
grep -Fq 'bash scripts/dispatch-main-ci-after-dependabot-merge.sh' "$WORKFLOW"
grep -Fq 'bash scripts/test-dependabot-main-ci-dispatch.sh' "$OPS_WORKFLOW"
bash -n "$SCRIPT"

mkdir -p "$TMP/bin"
cat > "$TMP/bin/gh" <<'MOCK_GH'
#!/usr/bin/env bash
set -euo pipefail
case "${1:-} ${2:-}" in
  'api repos/'*'/git/ref/heads/main') printf '%s' "${MOCK_MAIN_SHA:?}" ;;
  'api repos/'*'/compare/'*) printf '%s' "${MOCK_COMPARE_STATUS:?}" ;;
  'run list') printf '%s' "${MOCK_RUNS_JSON:-[]}" ;;
  'workflow run')
    printf '%s\n' "$*" >> "${MOCK_DISPATCH_LOG:?}"
    echo 'mock workflow_dispatch'
    ;;
  *) echo "unexpected gh command: $*" >&2; exit 91 ;;
esac
MOCK_GH
cat > "$TMP/bin/sleep" <<'MOCK_SLEEP'
#!/usr/bin/env bash
exit 0
MOCK_SLEEP
chmod +x "$TMP/bin/gh" "$TMP/bin/sleep"
export PATH="$TMP/bin:$PATH"
export GH_TOKEN=test REPOSITORY=zexy2/Hava81
export MERGE_SHA=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
export MOCK_MAIN_SHA="$MERGE_SHA" MOCK_COMPARE_STATUS=identical
export MOCK_DISPATCH_LOG="$TMP/dispatch.log"

# Existing matching main run: no duplicate dispatch.
export MOCK_RUNS_JSON="[{\"headSha\":\"$MOCK_MAIN_SHA\",\"status\":\"completed\",\"conclusion\":\"success\"}]"
rm -f "$MOCK_DISPATCH_LOG"
bash "$SCRIPT"
test ! -e "$MOCK_DISPATCH_LOG"

# Missing main run: dispatch once after the bounded propagation wait.
export MOCK_RUNS_JSON='[]'
rm -f "$MOCK_DISPATCH_LOG"
bash "$SCRIPT"
test "$(grep -c 'workflow run ci.yml' "$MOCK_DISPATCH_LOG")" -eq 1

# Main not yet containing the merge SHA: fail closed and do not dispatch.
export MOCK_MAIN_SHA=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb MOCK_COMPARE_STATUS=behind
rm -f "$MOCK_DISPATCH_LOG"
if bash "$SCRIPT" >"$TMP/not-propagated.out" 2>&1; then
  echo 'Expected an unpropagated merge to fail closed.' >&2
  exit 1
fi
test ! -e "$MOCK_DISPATCH_LOG"

echo 'Dependabot main-CI dispatch contract passed (existing run, missing run, unpropagated merge).'
