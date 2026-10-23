#!/usr/bin/env bash
# Contract test for deploy/oracle/ci-deploy-api.sh (CI -> Oracle entry point).
# Uses throwaway git repositories under /tmp and a stub blue/green script.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP_DIR="$(mktemp -d /tmp/hava81-ci-deploy-entry.XXXXXX)"
trap 'rm -rf "$TMP_DIR"' EXIT

export GIT_AUTHOR_NAME=test GIT_AUTHOR_EMAIL=test@example.invalid
export GIT_COMMITTER_NAME=test GIT_COMMITTER_EMAIL=test@example.invalid
export HAVA81_CI_DEPLOY_NO_SUDO=1
unset DOCKER_CONFIG SSH_ORIGINAL_COMMAND
export HAVA81_API_OPERATION_LOCK="$TMP_DIR/api-operation.lock"
RECORD="$TMP_DIR/deploy-record"
export HAVA81_TEST_RECORD="$RECORD"

git init --quiet --bare --initial-branch=main "$TMP_DIR/origin.git"
git clone --quiet "$TMP_DIR/origin.git" "$TMP_DIR/seed" 2>/dev/null
git -C "$TMP_DIR/seed" symbolic-ref HEAD refs/heads/main
mkdir -p "$TMP_DIR/seed/deploy/oracle"
cp "$REPO_ROOT/deploy/oracle/ci-deploy-api.sh" "$TMP_DIR/seed/deploy/oracle/"
cat >"$TMP_DIR/seed/deploy/oracle/deploy-api-blue-green.sh" <<'STUB'
#!/usr/bin/env bash
set -euo pipefail
{
  echo "image=$HAVA81_API_IMAGE"
  echo "revision=$HAVA81_API_REVISION"
  echo "lock=$HAVA81_API_OPERATION_LOCK"
  echo "head=$(git -C "$(dirname "$0")/../.." rev-parse HEAD)"
  if [[ -n "${DOCKER_CONFIG:-}" ]]; then
    echo "docker_config=$(cat "$DOCKER_CONFIG/config.json")"
  fi
} >"$HAVA81_TEST_RECORD"
STUB
chmod +x "$TMP_DIR/seed/deploy/oracle/"*.sh
(
  cd "$TMP_DIR/seed"
  git add -A && git commit --quiet -m one
  git push --quiet origin main
)
git clone --quiet "$TMP_DIR/origin.git" "$TMP_DIR/prod" 2>/dev/null
ENTRY="$TMP_DIR/prod/deploy/oracle/ci-deploy-api.sh"

commit_upstream() {
  (
    cd "$TMP_DIR/seed"
    echo "$1" >"file-$1"
    git add -A && git commit --quiet -m "$1"
    git push --quiet origin main
    git rev-parse HEAD
  )
}

fail() { echo "FAIL: $*" >&2; exit 1; }

# The fail-closed helper is a repository file; the deploy job must check out
# this exact SHA before invoking it (without persisting the checkout token).
WORKFLOW="$REPO_ROOT/.github/workflows/deploy-api.yml"
PUSH_PATH_FILTERS="$(sed -n '/^  push:/,/^  workflow_dispatch:/p' "$WORKFLOW")"
grep -qF -- "- '!deploy/oracle/observer/**'" <<<"$PUSH_PATH_FILTERS" || \
  fail "observer-only changes must not trigger an API production deployment"
grep -qF -- "- '!deploy/oracle/install-observer.sh'" <<<"$PUSH_PATH_FILTERS" || \
  fail "observer installer changes must not trigger an API production deployment"
grep -qF -- "- '!deploy/oracle/README.md'" <<<"$PUSH_PATH_FILTERS" || \
  fail "Oracle documentation changes must not trigger an API production deployment"
if grep -qF -- "- '.github/workflows/deploy-api.yml'" <<<"$PUSH_PATH_FILTERS"; then
  fail "workflow-only changes should be validated by CI without deploying the API"
fi
DEPLOY_JOB="$(sed -n '/^  deploy:/,$p' "$WORKFLOW")"
# The security contract is about ordering and token persistence, not a pinned action major.
# Keep Dependabot's compatible checkout upgrades from failing an unrelated deploy gate.
CHECKOUT_LINE="$(grep -nE 'uses: actions/checkout@v[0-9]+' <<<"$DEPLOY_JOB" | head -n1 | cut -d: -f1)"
SECRET_GATE_LINE="$(grep -nF 'run: bash scripts/check-api-deploy-secrets.sh' <<<"$DEPLOY_JOB" | head -n1 | cut -d: -f1)"
[[ -n "$CHECKOUT_LINE" && -n "$SECRET_GATE_LINE" && "$CHECKOUT_LINE" -lt "$SECRET_GATE_LINE" ]] || \
  fail "deploy job must check out the repository before running the secret gate"
grep -qF 'persist-credentials: false' <<<"$DEPLOY_JOB" || \
  fail "deploy-job checkout must not persist the GitHub token"

# 1. Fast-forwards to the requested SHA and deploys that exact image/revision.
SHA2="$(commit_upstream two)"
out="$(bash "$ENTRY" "$SHA2" </dev/null)"
grep -qx 'HAVA81_DEPLOY_RESULT=deployed' <<<"$out" || fail "deploy result missing"
grep -qx "image=ghcr.io/zexy2/hava81-api:$SHA2" "$RECORD" || fail "wrong image"
grep -qx "revision=$SHA2" "$RECORD" || fail "wrong revision"
grep -qx "head=$SHA2" "$RECORD" || fail "checkout not fast-forwarded"
grep -qx "lock=$HAVA81_API_OPERATION_LOCK" "$RECORD" || fail "lock path not passed"
if grep -q '^docker_config=' "$RECORD"; then fail "no token must mean no registry config"; fi

# 2. A token on stdin becomes a temporary ghcr.io credential that is removed afterwards.
SHA3="$(commit_upstream three)"
rm -f "$RECORD"
printf 'secret-token\n' | bash "$ENTRY" "$SHA3" >/dev/null
expected_auth="$(printf 'github-actions:secret-token' | base64 | tr -d '\n')"
grep -qF "\"ghcr.io\":{\"auth\":\"$expected_auth\"}" "$RECORD" || fail "registry auth not written"
if compgen -G "/tmp/hava81-ghcr.*/config.json" >/dev/null; then
  for leftover in /tmp/hava81-ghcr.*/config.json; do
    if grep -qF "$expected_auth" "$leftover" 2>/dev/null; then fail "registry credential left behind: $leftover"; fi
  done
fi

# 3. SSH forced-command form: SHA comes from SSH_ORIGINAL_COMMAND.
SHA4="$(commit_upstream four)"
rm -f "$RECORD"
SSH_ORIGINAL_COMMAND="/home/ubuntu/hava81-prod-20261021/deploy/oracle/ci-deploy-api.sh $SHA4" \
  bash "$ENTRY" </dev/null >/dev/null
grep -qx "revision=$SHA4" "$RECORD" || fail "forced command SHA not used"

# 4. An older SHA than the checkout is reported as superseded and deploys nothing.
rm -f "$RECORD"
out="$(bash "$ENTRY" "$SHA3" </dev/null)"
grep -qx 'HAVA81_DEPLOY_RESULT=superseded' <<<"$out" || fail "superseded not reported"
[[ ! -e "$RECORD" ]] || fail "superseded run must not deploy"

# 5. Rejects malformed SHAs, commits not on origin/main and dirty checkouts.
if bash "$ENTRY" 'abc; rm -rf /' </dev/null >/dev/null 2>&1; then fail "malformed sha accepted"; fi
(
  cd "$TMP_DIR/seed"
  git checkout --quiet -b side
  echo side >side && git add side && git commit --quiet -m side
  git push --quiet origin side
)
SIDE_SHA="$(git -C "$TMP_DIR/seed" rev-parse side)"
if bash "$ENTRY" "$SIDE_SHA" </dev/null >/dev/null 2>"$TMP_DIR/err"; then fail "non-main sha accepted"; fi
grep -q "is not on origin/main" "$TMP_DIR/err" || fail "missing non-main message"
git -C "$TMP_DIR/seed" checkout --quiet main
SHA5="$(commit_upstream five)"
echo dirty >>"$TMP_DIR/prod/file-two"
if bash "$ENTRY" "$SHA5" </dev/null >/dev/null 2>"$TMP_DIR/err"; then fail "dirty checkout accepted"; fi
grep -q "uncommitted tracked changes" "$TMP_DIR/err" || fail "missing dirty message"
git -C "$TMP_DIR/prod" checkout --quiet -- file-two

# 6. Refuses to touch the checkout while another API operation holds the lock.
(
  exec 8>"$HAVA81_API_OPERATION_LOCK"
  flock -n 8
  if bash "$ENTRY" "$SHA5" </dev/null >/dev/null 2>"$TMP_DIR/err"; then exit 1; fi
  grep -q "another API operation holds" "$TMP_DIR/err"
) || fail "lock contention not detected"

echo "API CI deploy entry-point contract passed"
