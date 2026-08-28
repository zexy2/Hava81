# Hava81 Autonomous Decisions

This log records product and engineering decisions made during the autonomous improvement window requested for 28 August 2026.

## 2026-08-28 initial decisions

- Keep the product centered on actionable weather decisions rather than raw-data density.
- Never synthesize UV, pollen, dust, marine, health or safety values; modeled data must be attributed and optional.
- Use Open-Meteo as an additional context source for UV/dust/pollen/marine while OpenWeather remains the core current/forecast provider.
- Treat route weather without a routing provider as an approximate weather corridor, never as turn-by-turn navigation or road-safety assurance.
- Keep core Day Plan eager-loaded; lazy-load secondary modules to protect first-load performance.
- Generate real static entry pages for all 81 provinces to eliminate GitHub Pages deep-link 404 semantics and improve crawlability.
- Production deployments use canary/blue-green and retain the previous API port for immediate rollback.

## 2026-08-28 09:43 TRT — God Mode run

- Keep browser alert dedupe signatures stable within a day. Score changes must not create repeated rain/difficult notifications; the day key already provides freshness.
- Reject route-weather corridors below 1 km or above 2,000 km before the five-upstream-forecast fan-out. This bounds provider cost and prevents meaningless same-point requests while covering realistic Türkiye intercity trips.
- Extend modeled marine context with Open-Meteo wave direction and wave period. Open-Meteo documents both as current marine variables; these remain modeled context and not navigation safety data.
- Treat nested paths such as `/istanbul/anything` as non-city routes. Only a single canonical city slug resolves to a province, avoiding accidental deep-link/canonical mismatch.
- Do not ship an MGM MeteoUyarı integration until an official, stable, machine-readable source and freshness semantics can be verified. No scraping-derived or unattributed official-warning claims will be fabricated.

## 2026-08-28 follow-up run

- Alert only on decision-level strong wind and poor AQI thresholds already used by Hava81 scoring; do not invent medical claims or new pollutant thresholds. Rain remains highest priority.
- Surface modeled marine wave period/direction and model fetch time as transparency signals, not navigation/safety recommendations.
- Route cards must show wind because wind contributes to route score; users should be able to see why a segment is penalized.
- Root and province HTML must each emit exactly one canonical and one og:url; the static generator replaces root metadata instead of appending duplicates.
- Treat ports 4001/4002 as reversible blue-green slots. Never overwrite the active slot during a release.

- Canonical province URLs use a trailing slash because GitHub Pages serves generated province directories that way. This removes the observed `/istanbul` -> `/istanbul/` 301/canonical disagreement.

## 2026-08-28 10:44 TRT — God Mode run

- Treat Open-Meteo 15-minute precipitation in Türkiye as interpolated model guidance, not radar nowcast; do not market it as nowcast.
- Calculate UV/dust/pollen maxima from the actual next 24 hours rather than the first 24 provider rows, which may include elapsed local-day hours.
- Cap route-weather requests at 12/minute per rate-limit key because each accepted route fans out to five forecast samples.
- Never let Playwright reuse an arbitrary process occupying the preview port; fail fast instead of producing misleading browser results.
- Cancel superseded CI runs for the same PR/ref to reduce queue time and wasted runner work.
- Keep PWA shortcut URLs aligned with GitHub Pages trailing-slash canonical province URLs.

## 2026-08-28 10:58 TRT — visual polish
- Cosmetic work must reinforce the decision hierarchy rather than add decorative chrome: current conditions and the actionable day decision remain visually dominant.
- Use subtle shared elevation/radius tokens for hierarchy; avoid heavy glassmorphism, large animation dependencies, or effects that cost first-load performance.
- Notification copy must describe the current foreground-browser behavior only; do not imply account-backed/background delivery before that infrastructure exists.

- 2026-08-28 polish-2: Keep cosmetic changes bounded to presentation and interaction affordances; do not alter weather thresholds or modeled-data semantics while polishing UI. Mobile route segments use horizontal scanning instead of compressing five risk cards into two narrow columns.

- 2026-08-28 — Visual polish batch 3 keeps data/decision logic unchanged: Forecast, Environment, Compare and Search now share the established surface/token system. CI downstream jobs reuse the production `dist` artifact rather than rebuilding identical frontend output; the build job remains the single artifact producer.
- 2026-08-28 — Browser notification permission `denied` is treated as a non-actionable state: Hava81 shows the blocked label but disables the opt-in button instead of repeatedly invoking a browser permission request that cannot succeed.


## 2026-08-28 11:46 TRT — performance split

- Keep the current-conditions decision field synchronous, but code-split Forecast Atlas, Daily Plan and Environment Rail. Forecast data already arrives asynchronously, so these presentation modules do not need to inflate the initial application bundle; browser smoke tests remain the guard against visible regressions.
- Normalize provider micro-unit glyphs to the SI micro sign at presentation boundaries. This is visually/semantically equivalent for units such as µg/m³ and prevents a Greek font subset from being fetched solely for U+03BC.
- Do not carry a ~125 kB animation runtime solely for the Settings drawer. CSS entry animation plus reduced-motion handling is sufficient; the prior component was unmounted by its parent on close anyway, so its internal AnimatePresence could not provide a meaningful exit lifecycle.
- 2026-08-28 — GitHub Pages currently serves HTML, hashed assets and `sw.js` with `Cache-Control: max-age=600`; repo code cannot override those platform headers. Keep the notification-only service worker cacheless and request SW updates with `updateViaCache: 'none'` instead of introducing an application cache that could serve stale weather UI.
