# Mobile decision-score readability

**Base:** `main` at `e3b7ec84cd639373ee41c0d44ac30fb1297de12a` (mobile dock PR #1291)

## Finding

The first-fold decision score is decision context, not decoration. On mobile, the score denominator was 12px and responsive overrides reduced the score label to 10.88px and the explanation link to 10.24px on very small phones. This fell below the repository's established 13px functional-microtype floor.

## Change

- Raise the score denominator, label, and explanation link to `.8125rem` (13px at the default 16px root).
- Keep the existing ring dimensions, score values, thresholds, and recommendation behavior unchanged.
- Extend the existing real-browser hero test to assert computed font sizes at 320, 360, 390, and 428px, at both 100% and 200% root text size.
- Preserve existing assertions for ring fit, link geometry, overlap, and horizontal overflow.

## Gate

The exact-head GitHub CI/CD, browser, Lighthouse, and CodeQL workflows must pass before merge. If enlarged-text geometry fails, adjust spacing/layout without lowering the 13px floor or weakening the assertions. No production operation is part of this UI-only change.
