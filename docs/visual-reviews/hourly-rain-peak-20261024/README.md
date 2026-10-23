# Hourly rain-peak day label — 2026-10-24

## Rationale

The hourly forecast summary already ties its rain peak to a real forecast hour, but the compact summary can make the day context explicit: `Bugün · 21:00` / `Today · 9 PM` or `Yarın · 02:00` / `Tomorrow · 2 AM`. This reduces the work needed to decide whether to carry an umbrella now or plan around a later window, without changing precipitation inputs, severity ranking, or any weather values.

## Implementation

- Reuses the existing location-time conversion and `HourlySummaryData.peakPrecipitation` timestamp; no interpolation or invented nowcast is introduced.
- Labels the current local date as Today/Bugün, the next local date as Tomorrow/Yarın, and uses the existing weekday formatter for any later date.
- Keeps the note compact and uses the existing saffron ink/background and radius design tokens; no new gradients, shadows, or raw design values.
- English and Turkish labels are both covered. The hourly forecast remains modeled guidance, not an official warning.

## Validation

- `ForecastAtlas.test.tsx`: 19/19 passed, including same-day and next-day labels.
- TypeScript type-check passed.
- Production build passed (81 TR + 81 EN province pages generated).
- CSS token lint passed after replacing raw radius/color values with design tokens.
- Targeted Playwright: 2/2 passed on 320px mobile and desktop 1280 after adding an explicit production-compatible bundle 404 mock; no proxy-refusal warnings remained.
