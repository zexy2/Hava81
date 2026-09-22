# Hava81 production smoke checklist

Use this checklist after a green frontend deployment or a controlled API canary. It is intentionally evidence-first: record observed responses and revisions, never infer health from a single page load.

## Frontend

- Confirm the deployed frontend revision matches the intended `main` SHA.
- `GET /` returns `200` and renders the application shell.
- `GET /istanbul/` returns `200` and renders the city route.
- `GET /robots.txt` and `GET /sitemap.xml` return `200` when present.
- Verify the mobile core flow at 390px: city route, forecast, bottom navigation, and map open/close.
- Verify the location gate does not request geolocation before the user activates the location action.

## API

- `GET /api/v1/health/ready` returns `200`, `status=ready`, and a fresh timestamp.
- Record the active API port; production remains on `4002` unless a controlled switch is explicitly authorized.
- Confirm `Access-Control-Allow-Origin` is exactly `https://hava81.zekiakgul.dev`.
- Smoke one current-weather request and one forecast request; record provider metadata and cache status.
- Do not treat modeled Hava81 guidance as an official MGM warning.

## Stop conditions

Stop and rollback the changed surface if any of these persist: readiness failure, repeated `5xx`, CORS mismatch, blank/broken frontend, broken city route, or broken core mobile flow.

## Evidence

Record the UTC timestamp, deployed revision, API revision, active port, endpoint status codes, and the exact failing route or selector. Keep the note append-only in the autonomous progress log when this checklist is used for a merge or deploy decision.
