# Browser-flow contract note: `aria-current`

This note records the accessibility contract used by the current Hava81 UI and the corresponding browser-test boundary.

## Runtime contract

- The mobile bottom navigation exposes `aria-current="page"` for the active destination.
- The header compare action intentionally keeps `aria-current="location"` because it represents a contextual location within the current page rather than a page destination.
- Forced-colors styling follows the bottom-navigation `page` contract.

## CI diagnosis

When a browser-flow run reports failures around bottom navigation while frontend quality, production build, Lighthouse, API, and CodeQL remain green, first compare the failing selectors with the runtime contract above. A stale `location` selector in bottom-navigation assertions is a test-contract mismatch, not a weather, API, deployment, or production-health failure.

## Safe follow-up procedure

1. Re-run the exact failing Browser flows job once if the failure is otherwise unexplained.
2. If failures are limited to stale bottom-navigation selectors, update only those selectors/assertions to `page`.
3. Preserve the header compare action's `location` assertion.
4. Verify the exact head SHA and all required checks before merge.
5. Do not use this note as evidence to change production API ports, weather-model semantics, or MGM warning attribution.
