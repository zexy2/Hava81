# Hava81 v2.0 Release Checklist

Target production window: 2026-08-31 14:00 TRT. If any blocker fails, defer to 2026-09-01 14:00 TRT.

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

1. Keep current API on `127.0.0.1:4000` untouched.
2. Run `sudo deploy/oracle/deploy-green.sh` to build and start the release candidate on `127.0.0.1:4001`.
3. Run `BASE_URL=http://127.0.0.1:4001/api/v1 node scripts/verify-81-cities.mjs`.
4. Smoke-test current weather, forecast, air quality and health endpoints on port 4001.
5. Run `sudo deploy/oracle/switch-api-traffic.sh 4001`.
6. Observe the old frontend against the new API for at least 20 minutes.
7. Only then merge/deploy the new frontend.
8. Keep the old API on port 4000 for at least 24 hours.

## Rollback

API rollback: `sudo deploy/oracle/rollback-api.sh`.

Frontend rollback: redeploy the previous known-good GitHub Pages commit/artifact.

Rollback immediately for persistent readiness failure, repeated container restarts, meaningful 5xx increase, broad city-data failure, CORS failure, blank frontend, or broken primary mobile flow.

Do not rollback for cosmetic-only issues.

## Post-release

- Observe health, logs and browser flows closely for the first two hours.
- Recheck after 24 hours before retiring the old API.
- Real second-provider fallback, real UV data, deeper observability and bundle optimization belong to v2.1 unless a release blocker exposes a need earlier.
