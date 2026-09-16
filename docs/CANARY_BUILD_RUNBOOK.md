# Hava81 API Canary Build Runbook

This runbook describes the safe release path for the API when the stable service is on port `4002` and the rollback/canary service is on port `4001`.

## Preconditions

- `origin/main` is green in GitHub Actions and the intended release SHA is recorded.
- SentinelX reports a healthy host and `api_build_headroom_ok=true`.
- Production readiness is green before any mutation.
- The current stable service remains reachable on `4002`; do not switch traffic before the canary is ready.

## Build and canary sequence

1. Build the intended image from a clean checkout of the exact release SHA.
2. If Docker Buildx fails before reading the repository, inspect the Buildx lock path and permissions. Correct only the lock ownership/mode needed by the SentinelX runtime; do not delete caches or mutate application files.
3. Start or replace only the canary service on `4001`.
4. Verify `/api/v1/health/ready` and `/api/v1/health/live` locally on `4001`.
5. Verify CORS, `cache-control: no-store`, provider circuit state, and representative current/forecast responses.
6. Smoke-test the public frontend and the public stable API while `4002` remains active.
7. Switch nginx traffic to `4001` only after the canary checks are green and the fresh host state is re-read immediately before the switch.
8. Re-run readiness, CORS, frontend, and core mobile-flow smoke tests after the switch.
9. Keep the former stable image available on `4002` until post-switch validation is complete; it is the immediate rollback target.

## Rollback triggers

Rollback to the known-good port if any of the following persists after one bounded retry:

- readiness or liveness failure;
- repeated 5xx responses or broken CORS;
- blank or broken frontend boot;
- broken core mobile flow;
- provider circuit opens unexpectedly or the release returns fabricated/ambiguous weather guidance.

Rollback means restoring nginx to the last known-good port and re-running the same smoke checks. Do not alter weather semantics, MGM attribution, or modeled-guidance labels during an operational rollback.

## Evidence to record

Record the release SHA, image tag, canary port, stable port, readiness timestamps, smoke-test results, and rollback decision in `docs/AUTONOMOUS_PROGRESS.md`. Preserve prior checkpoints; append new evidence instead of rewriting history.
