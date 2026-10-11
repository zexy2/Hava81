# Hourly rain peak — visual review (2026-10-11)

This review contains real Playwright screenshots from the **same controlled mock weather scenario**, not screenshots from the live weather provider. The sample forecast includes a 72% peak precipitation probability and 2.4 mm hourly amount.

## User-facing improvement

The hourly forecast previously displayed only the peak rain probability and amount. Its summary now also displays **the peak's local time**, with a Today/Tomorrow label in both Turkish and English, plus a subtle amber accent. This helps users identify when to take an umbrella without manually scanning all hourly tiles. When the precipitation signal is zero, the extra label and highlight are not shown.

## Evidence

- `before-mobile-390.png`, `after-mobile-390.png` — 390×844 viewport, scroll-positioned to loaded forecast
- `before-desktop-1280.png`, `after-desktop-1280.png` — 1280×900 desktop viewport

Each screenshot is captured after `.hava81-forecast-atlas` becomes visible and `.atlas-forecast-loading--card` reaches count zero.

## Verification

- `npm run type-check` — passed
- `npm run lint` — passed
- `npm run build` — passed
- `e2e/hourly-rain-peak.spec.ts` — Playwright mobile and desktop, 2/2 passed
- Screenshots intentionally include the new timestamp only in the `after-` files.
