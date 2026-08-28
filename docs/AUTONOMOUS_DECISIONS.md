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
