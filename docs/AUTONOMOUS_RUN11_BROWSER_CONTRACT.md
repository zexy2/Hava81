# Autonomous run 11 — browser contract continuity

## Current production baseline

- Frontend `main`: `dc7d2526b823cf20028d1ed8ca90fa94ce1da494`
- Public frontend smoke: `/` and `/istanbul/` return HTTP 200.
- Public API readiness returns HTTP 200 with `Cache-Control: no-store`.
- Production API remains on port 4002; port 4001 remains the rollback/canary slot.
- Observer state reports the host healthy and API build headroom available, with a root-disk pressure warning at ~90.5% usage.

## Open PR #1120 diagnosis

PR #1120 changes the shipped mobile bottom-navigation contract to `aria-current="page"` and aligns the forced-colors CSS selector plus the focused component contract test. Its API, frontend quality, production build, Lighthouse and CodeQL jobs passed. The remaining Browser flows failure is a stale test contract in `e2e/smoke.spec.ts`: three bottom-navigation assertions still expect `aria-current="location"`.

The `location` value remains correct for saved-city tabs, so the e2e repair must be scoped to bottom navigation only. The prepared local replacement commit is `713fbe08624a23e65cbd67cdb56c9c5c1be23fd7` on branch `automation/hava81-run11-e2e-contract`.

## Next safe action

Publish the prepared e2e-only replacement from the current `main` base as an isolated PR, re-run all gates, then merge only after exact-head CI is green. Do not mutate PR #1120 while another branch is pending. Do not switch production traffic or restart the API for this frontend-only correction.
