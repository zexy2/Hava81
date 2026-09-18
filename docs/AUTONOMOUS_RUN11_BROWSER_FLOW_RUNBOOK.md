# Run 11 Browser-flow contract runbook

## Scope

This runbook records the narrow accessibility contract needed to unblock the run 11 Browser flows gate without changing runtime behavior.

## Contract

- The mobile bottom navigation represents page-level destinations and must expose `aria-current="page"` for the active item.
- Saved-city comparison tabs represent a location set and may continue to expose `aria-current="location"`.
- Forced-colors styling must target the same semantic attribute used by the runtime, so the selected bottom-navigation item remains visibly distinct.

## Safe publication sequence

1. Start from the current `origin/main` head.
2. Apply only the three stale bottom-navigation assertions in `e2e/smoke.spec.ts`:
   - forced-colors bottom navigation;
   - keyboard map close focus restoration;
   - saved navigation active-item expectation.
3. Keep saved-city `aria-current="location"` assertions unchanged.
4. Run the Browser flows job plus the existing API, frontend-quality, production-build, Lighthouse, and CodeQL gates.
5. Verify the exact PR head SHA immediately before merge.
6. Merge only after all required checks are green; do not alter API port topology or restart production for this test-only change.

## Current evidence

- PR #1120 remains blocked only by the stale Browser flows expectations.
- The prepared isolated fix is `89b2904685263fae18f09dffb4f4643ef2b0a002` on branch `automation/hava81-run11-e2e-contract-complete`.
- The Oracle host currently has no Node/npm/pnpm/bun executable on PATH, so local Browser flows execution is not available there; GitHub Actions is the authoritative validation path.
