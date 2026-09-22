# Accessibility E2E contract

This repository uses `aria-current="page"` for the active route in both the bottom navigation and saved-city tab rail.

## Contract

- Active route controls expose `aria-current="page"`.
- Inactive controls omit `aria-current`.
- Visual regression tests should locate the active control using the same `page` value.
- `aria-current="location"` is not part of the Hava81 navigation contract and must not be used in E2E selectors or assertions.

## Why this is explicit

Keeping the semantic value in one short contract prevents a test-only selector drift from blocking the browser-flow gate while the runtime and accessibility behavior remain correct.

## Verification scope

When changing navigation semantics, run the forced-colors bottom-navigation and saved-city tests, then the full Browser flows workflow. This file is documentation-only and does not change runtime weather, provider, API, or deployment behavior.
