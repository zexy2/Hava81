# Hava81 production smoke matrix

This matrix is a compact release contract for verifying the public Hava81 surface after a frontend publish or API rollout. It checks availability and attribution boundaries without asserting fabricated live weather values.

## Before any mutation

1. Read the observer state and compare `collected_at` with current time.
2. Re-verify the live host, production endpoints and the exact target SHA immediately before merge, deploy or rollback.
3. Keep the operation fail-closed when the host is unhealthy, root disk pressure is active, API build headroom is false, or any required check is unknown.

## Frontend shell

- `GET /` returns 200 and renders the Hava81 shell.
- A canonical province path such as `/istanbul/` returns 200 without a broken blank state.
- The generated document contains one canonical URL, one `og:url`, a branded favicon/touch icon and a valid manifest reference.
- `sw.js` is reachable and is not treated as an immutable fingerprinted asset.
- Mobile smoke covers the first viewport, primary decision content, menu/drawer opening, city navigation and no horizontal overflow at 390 px.

## API contract

- `/api/v1/health/ready` returns 200 with `status=ready`, a fresh timestamp and `cache-control: no-store`.
- `/api/v1/health/live` returns 200 for liveness.
- The shorthand `/api/v1/ready` is not a canonical route and should not be used as a readiness assertion.
- CORS allows only `https://hava81.zekiakgul.dev`.
- `/api/v1/cities/istanbul/current` returns a successful attributed provider payload or an explicit unavailable/error state; tests must not require a particular temperature.
- Provider circuit state is observed and reported; no test may silently turn provider failures into fabricated values.

## Release topology

- Stable traffic remains on port 4002.
- Port 4001 is reserved for canary/rollback.
- API changes require local gates, hosted CI, readiness/CORS verification and a bounded canary observation before switching traffic.
- Roll back on persistent readiness failure, repeated 5xx responses, CORS breakage, blank frontend or broken core mobile flow.

## Evidence to record

Record exact SHA values, CI/CodeQL run IDs, the observed production endpoints, the result of each smoke item and any unresolved limitation. Do not record a green release based only on a Pages publish step or a stale observer snapshot.
