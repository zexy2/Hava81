# E2E follow-up — 2026-09-23

## Verified

- PR #1192 runtime accessibility change uses `aria-current="page"` for bottom navigation.
- GitHub-hosted Browser flows still exercised three stale `aria-current="location"` assertions in `e2e/smoke.spec.ts`.
- The exact isolated local test-only fix is preserved in commit `0d72e8baed685507f710edac7df063f088184600`.
- Production remains healthy on frontend revision `326dd73a7daa84e767294d61355fdc761ac90170` with stable API proxy `4002`; rollback/canary `4001` is retained.

## Queue

1. Publish the exact E2E assertion fix through an authenticated write path.
2. Re-run Browser flows on the exact head and require all required checks before merge.
3. Keep API promotion fail-closed until the deployed API revision matches current `main` and blue-green gates pass.
