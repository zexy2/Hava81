# Autonomous Run 11 — Publication Checkpoint

Date: 2026-09-18

## Production baseline

- Frontend `main`: `751f2aac8f39d3a6c877deef33730ead1cb8caf1`
- API deployed revision: `d8445e8af156a147d888bf64efbeabb3dc8c66c5`
- Stable API port: `4002`
- Rollback/canary port: `4001`
- Fresh public checks: frontend root, `/istanbul/`, API readiness, CORS and boot assets all healthy.

## Pending accessibility PR

- PR: `#1120`
- Exact head: `703883c555d26e3d66bce11a1be24b858985e3ff`
- Status: intentionally unmerged.
- Passing gates: API test/build, frontend quality, production build, Lighthouse and CodeQL.
- Remaining failure: Browser flows has three stale e2e assertions in `e2e/smoke.spec.ts` that still expect `aria-current="location"` for bottom navigation, while the shipped runtime contract is `aria-current="page"`.
- Saved-city tabs intentionally retain `aria-current="location"`; they are a different navigation contract.

## Prepared fix

- Local prepared commit: `89b2904685263fae18f09dffb4f4643ef2b0a002`
- Parent: current `main` baseline `751f2aac8f39d3a6c877deef33730ead1cb8caf1`
- Scope: e2e assertions only; no runtime/API behavior changes.
- Publication blocker at checkpoint time: the Oracle checkout has no authenticated GitHub CLI/git push path, so the local commit cannot be pushed directly from the host.

## Safe next action

Use an authenticated GitHub write path to publish the prepared e2e-only change as a separate branch/PR or recreate the exact three-line assertion update against current `main`. Re-run Browser flows and all required checks. Do not merge PR #1120 until the exact head is green. Do not change API port topology or deploy while the API observer still reports the deployment as pending.
