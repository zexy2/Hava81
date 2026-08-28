# Hava81 v2.0 Release Checklist

Production is already live as of 2026-08-28. Treat this checklist as the continuous release gate for subsequent v2 hardening; do not hold a healthy, fully gated improvement for the superseded 2026-08-31 window.

## Release blockers

- Clean working tree on the release candidate commit.
- `npm ci` and `npm ci --prefix apps/api` succeed from a clean dependency state.
- Frontend lint and type-check pass with zero warnings/errors.
- Frontend unit/integration tests pass and line coverage stays >= 55% (target >= 70%).
- API type-check, tests and build pass.
- Production dependency audits contain no high/critical vulnerabilities.
- Playwright smoke tests pass for mobile, tablet and desktop.
- Lighthouse assertions pass.
- Frontend and API Docker images build successfully.
- Secret scan finds no real credentials in the release diff.
- 81/81 province current + forecast verification passes against the green API.
- Green API `/live` and `/ready` remain healthy before traffic switch.

## Blue/green production procedure

1. Read the active proxy target first; after v2.1 it is expected to be `127.0.0.1:4002`. Keep it untouched during canary build.
2. Use the inactive slot as canary (currently `GREEN_PORT=4001 GREEN_PROJECT=hava81-green sudo -E deploy/oracle/deploy-green.sh`).
3. Run `BASE_URL=http://127.0.0.1:4001/api/v1 node scripts/verify-81-cities.mjs` against the canary slot.
4. Smoke-test current weather, forecast, air quality, context, route and health endpoints on the canary slot.
5. Switch with `sudo deploy/oracle/switch-api-traffic.sh 4001` only after all canary gates pass.
6. Verify public readiness, CORS, core city API and mobile frontend immediately after switching.
7. Keep the previous 4002 API container intact as rollback until a later explicit cleanup decision.
8. For the next API release, reverse the slot roles rather than deploying over the active port.

## Rollback

API rollback: `sudo deploy/oracle/rollback-api.sh`.

Frontend rollback: redeploy the previous known-good GitHub Pages commit/artifact.

Rollback immediately for persistent readiness failure, repeated container restarts, meaningful 5xx increase, broad city-data failure, CORS failure, blank frontend, or broken primary mobile flow.

Do not rollback for cosmetic-only issues.

## Post-release

- Observe health, logs and browser flows closely for the first two hours.
- Recheck after 24 hours before retiring the old API.
- Real second-provider fallback, real UV data, deeper observability and bundle optimization belong to v2.1 unless a release blocker exposes a need earlier.
