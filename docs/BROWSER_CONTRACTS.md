# Browser contracts

This document records the accessibility contracts that browser flows should assert against shipped semantics.

## Current-page semantics

- Use `aria-current="page"` for the active primary or bottom navigation item.
- Use `aria-current="location"` for a selected city or saved-location tab that identifies the current place within a comparison or city rail.
- Do not use `location` for global navigation: it describes a location selection, not a route/page selection.

## Test guidance

- Prefer role- and state-based locators over CSS-only selectors.
- When a runtime semantic changes intentionally, update all affected assertions in the same test-only change.
- Keep forced-colors checks focused on the visible distinction: underline, thickness, border, or another robust state signal.
- Preserve `aria-current` assertions for saved-city tabs unless the component contract changes too.

## Verification checklist

1. Run the focused Browser flows suite for mobile navigation, map return, and saved-city comparison.
2. Run the full Browser flows job across desktop, tablet, and mobile projects.
3. Verify CodeQL and the production build before merge.
4. After merge, smoke-test `/`, `/istanbul/`, and API readiness without changing the 4002 stable / 4001 rollback topology.
