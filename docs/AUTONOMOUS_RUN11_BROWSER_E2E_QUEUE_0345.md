# Autonomous run 11 — browser E2E queue (2026-09-20)

## Verified state

- Production frontend and API remain healthy on the observer's latest sample.
- Frontend `main` is at `39068110d9de978d236d0203f7955790f9a5e01f`.
- Stable API remains on port `4002`; rollback/canary remains `4001`.
- The observer reports `api_deploy_pending=true`, so runtime/API merge and deployment remain fail-closed until the deployed revision catches up with `main` and fresh state is re-verified.

## Browser accessibility queue

PR #1137 has the runtime contract fix for the mobile bottom navigation (`aria-current="page"`) while preserving saved-city/location semantics (`aria-current="location"`). Its remaining failure is isolated to three stale Browser flows assertions that still select the bottom-navigation active item via `aria-current="location"`:

- forced-colors bottom navigation
- keyboard map-close focus restoration flow
- saved comparison navigation flow

A host-local isolated patch exists at commit `129b1da28ecf` in worktree `/home/ubuntu/hava81-auto-run11-browser-e2e-fix-2243`. It changes only those three assertions to `aria-current="page"`; it does not alter the runtime, API, weather semantics, or deployment topology. The Oracle checkout cannot push directly because GitHub HTTPS credentials are unavailable, so the patch must be reproduced through the authenticated GitHub write path or applied from a credentialed maintainer checkout.

## Safe next actions

1. Re-verify PR #1137 exact head and workflow results before any mutation.
2. Publish the three-assertion E2E patch as a separate branch/PR from current `main` using the authenticated GitHub path.
3. Run exact-head Browser flows and CodeQL; merge only with fresh green gates and after the observer no longer reports `api_deploy_pending`.
4. While the gate is pending, continue independent accessibility, mobile ergonomics, and production-measured performance work in isolated branches.
