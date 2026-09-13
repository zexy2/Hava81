# Hava81 Operations Safety

This page is the short operational companion to the repository's release-gate runbook. It records the checks that protect weather-data integrity and reversible production operation.

## Live topology

- Web: GitHub Pages at `hava81.zekiakgul.dev`
- API: Oracle host behind `api.hava81.zekiakgul.dev`
- Active API slot: `4002`
- Canary/rollback slot: `4001`

Never replace the active API slot in place. Validate a new build on the inactive slot first, then switch traffic only after readiness, CORS, provider-circuit, root, province, and boot-asset checks pass.

## Observer freshness

Treat the SentinelX observer as a read-only signal. Before any merge, restart, rollback, or traffic change:

1. Read `collected_at` and compare it with the current time.
2. Re-check the live host directly if the observer is stale, incomplete, or contradictory.
3. Confirm the exact GitHub commit SHA that is being merged or deployed.

A missing or unknown CI result is not a pass. A green PR cannot override a red host safety gate.

## Data truth

- OpenWeather remains the core current/forecast provider.
- Open-Meteo environmental and marine values are modeled context and must remain attributed.
- MGM hazards are authoritative only when surfaced from a verified, freshness-aware official machine-readable source.
- Interpolated precipitation must never be described as radar nowcast.
- Static SEO pages must not serialize live weather, UV, health, warnings, or decision values.

## Stop conditions

Stop the rollout and preserve the last known-good slot when any of the following persists:

- readiness failure
- repeated 5xx responses
- CORS failure
- blank or broken frontend shell
- broken core mobile flow
- unexplained provider-circuit regression

Document the exact SHA, active port, observed symptom, and next safe action before handing work to the next autonomous run.
