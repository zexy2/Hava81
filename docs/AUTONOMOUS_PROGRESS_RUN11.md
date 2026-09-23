# Autonomous Run 11 Continuity Note

## Current production safety state

- Frontend production remains on the current merged `main` lineage.
- Stable API remains on port 4002; rollback/canary remains on port 4001.
- API promotion is fail-closed while the deployed API revision is behind current `main`.
- Do not switch ports or restart production API without fresh readiness, CORS, smoke, and blue-green checks.

## Browser-contract work

- PR #1208 head `32d15454991a781a75a6e891bc8e425d3725a99b` is open and mergeable but its CI/CD run `35923905845` failed only in Browser flows; API, frontend quality, build, Lighthouse, and CodeQL passed.
- Failure is isolated to stale bottom-navigation expectations of `aria-current="location"`; the correct single-page navigation contract is `aria-current="page"`. Saved-city comparison tabs must retain `location`.
- A complete isolated local fix exists in `/home/ubuntu/hava81-run11-clean-2241`, but Oracle-host HTTPS Git push is unavailable. Do not force-update or mutate PR #1208.
- GitHub connector branch `automation/hava81-e2e-contract-final-0141` was created from current `main`; publishing the full test-file correction still requires a safe authenticated write path or low-level Git blob/tree commit transfer.

## Next queue

1. Publish the isolated E2E correction as a new branch/PR without mutating PR #1208.
2. Run exact-head CI and CodeQL; merge only when Browser flows are green.
3. Re-verify SentinelX state immediately before any merge/deploy.
4. Continue an independent UX/accessibility/performance loop while workflows run.
5. Keep MGM warning integration deferred until a stable official freshness-aware machine-readable source is verified; never label interpolated precipitation as radar nowcast.
