# Hava81 Sky Pass — Before / After, 9 October 2026

## Change register

1. **Desktop hierarchy:** Equal 50/50 current-condition and forecast columns → deliberate 45/55 split at >=1280px. Forecast has more graph width, left conditions remain fully readable.
2. **Decision hero:** Scattered sky artwork and decorative sun near score → clean, high-contrast navy-to-teal hero with discreet topographic circles and an unobstructed score ring.
3. **Temperature plate:** Washed-out pale card → clear blue sky gradient, stronger atmospheric separation and more depth around the weather illustration.
4. **Forecast:** Flat graph stage and control strip → gently tinted visualization surface with a stronger selected-hour indicator and consistent border geometry.
5. **Five-day cards:** Low contrast between current and other days → subtle current-day emphasis while preserving daily information and interaction.
6. **Dark theme:** Equivalent spatial treatment in deep blue/teal; weather and chart surfaces retain theme-specific legibility.
7. **Small-screen preservation:** Same content and touch targets; 320px and 390px screens remain free from page-level horizontal scrolling.

## Screenshot matrix

All files were captured by Playwright with real weather API data and no fabricated readings. Before images capture the earlier PR #1282 design; after images capture Sky Pass CSS on top of merged PR #1282 (`main` at `ef053bc`). Weather numbers can change during the interval. Compressed WebP copies are included in Git so comparisons survive remote-worktree cleanup.

| Viewport | Before | After |
| --- | --- | --- |
| Desktop 1440 × 900 | [Before](before-desktop-light.webp) | [After](after-desktop-light.webp) |
| Tablet 768 × 1024 | [Before](before-tablet-light.webp) | [After](after-tablet-light.webp) |
| Mobile 390 × 844 | [Before](before-mobile-light.webp) | [After](after-mobile-light.webp) |
| Mobile dark 390 × 844 | [Before](before-mobile-dark.webp) | [After](after-mobile-dark.webp) |
| Compact 320 × 720 | [Before](before-small-mobile.webp) | [After](after-small-mobile.webp) |

Original full-resolution PNGs and JSON layout measurements:

- PR #1282 baseline: /home/ubuntu/Hava81-visual-overhaul-20261009/test-results/visual-overhaul/after
- Sky Pass final: /tmp/hava81-main-sky-20261009/visual/after

## Browser verification

Playwright captured all five Sky Pass states with HTTP 200, zero page errors and **zero horizontal overflow**. The desktop forecast grid expanded from about 679px to 740px at 1440px viewport; the current-weather column contracted from about 679px to 618px.

Other app states (map, compare and settings) were independently captured for PR #1282; Sky Pass intentionally leaves their functionality untouched. Their next visual pass should be a **separate PR**, focusing on settings density and map legend/heading hierarchy.

## Release checklist

- TypeScript: passed.
- ESLint: passed.
- Vite production bundling: passed.
- Vitest: run with a local writable config cache in the isolated worktree (the shared npm directory is intentionally not modified).
- CI/CD and CodeQL: pending new PR.
- No direct main modification, no deployment or cleanup of existing worktrees.

## CI browser contract reconciliation (follow-up)

The first PR #1282 GitHub Browser flows run reported four CSS-related
regressions while CodeQL, unit tests, API tests, production build, and
Lighthouse were green. This follow-up phase preserves the new aesthetic
and restores its existing responsive/browser guarantees:

1. Keyboard map action: remove added mobile environment-rail inset that
   pushed the focused action away from the clipped rail edge.
2. Small phones at 200% text: scale the city heading with a smaller minimum
   while retaining large text and the city plate reflow.
3. Desktop decision inset: retain a solid fallback background-color under
   the amber visual gradient for a deterministic computed-color contract.
4. Clear-sky decoration: render a muted, compact sun far from the score
   at desktop widths; keep it hidden on mobile, so bounding boxes never cross.

**Final local browser results:** the four focused smoke tests passed after
these corrections. Full Vitest run: **763 passed in 108 files**. Five final
Playwright full-page captures were regenerated against the final CSS after
those corrections, all HTTP 200, zero page JavaScript errors and no horizontal
overflow at 320, 390, 768, or 1440px. Source PNGs and the audit report live
at `/tmp/hava81-sky-final-20261009/after`; matching compressed WebP assets
above are the durable visual record in this PR.

No production deployment or direct `main` modification is part of this branch.

## Final current-main validation

- Branch: `feat/visual-sky-pass-main-20261009`; base: `ef053bc`.
- TypeScript, ESLint, 81-page production build: pass.
- Vitest: 763 / 763 tests passed in 108 files.
- Playwright: all four earlier failing CI browser regressions passed locally against the production preview.
- Real-browser full-page audit: 5 / 5 viewports (1440, 768, 390 light/dark, 320) passed with no JavaScript errors and no horizontal page scrolling.
- Map and comparison were deliberately left unchanged because PR #1283 handles comparison independently.
- Original worktree and its uncommitted files remain untouched.
- GitHub CI/CD / CodeQL must pass before squash merge or live deployment.
PR #1282 is merged and confirmed on `main`. This visual hierarchy follow-up is
branched from its squash-merged commit `ef053bc` and should merge directly to `main`
**only after** its own CI/CD, CodeQL, and deployment checks pass.

## Full GitHub browser suite correction

The first CI run on this PR (commit `4b6d13c`) passed the API,
frontend-quality, Lighthouse, production-build and CodeQL jobs, but
its browser suite reported a single existing responsive contract failure:
the weather atmosphere had 0.32 opacity on normal-size mobile screens.
The revised CSS uses 0.42 for standard mobile type and explicitly keeps
0.1 opacity in a narrow container at 200% enlarged text. The targeted
Playwright test for both 320px and 390px passed locally after the change.
Five full-page screenshot variants were recaptured from the updated
production preview, again with no page errors or horizontal overflow.
Do not squash merge until the rerun GitHub browser suite is green.
