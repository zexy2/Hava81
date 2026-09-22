# Hava81 production API deploy gate

This note documents the fail-closed deployment rule for the production API.

## Required topology

- Stable production traffic stays on port `4002`.
- Port `4001` remains available as the rollback/canary target.
- A deployment must not switch ports until the candidate has passed local checks and green CI.

## Promotion checks

Before promotion, verify all of the following against the exact candidate SHA:

1. Readiness responds successfully and continuously.
2. Core API smoke checks pass, including CORS and representative weather endpoints.
3. Frontend boot and the core mobile flow remain healthy against the deployed API.
4. The candidate SHA is the one built and tested by CI; do not infer freshness from branch names.
5. No persistent 5xx, blank frontend, broken CORS, or readiness failures are present during observation.

## Fail-closed behavior

If the deployed API revision differs from current `main`, keep the existing stable service on `4002`, retain `4001` for rollback/canary, and do not restart or switch ports merely to remove the mismatch. Roll back immediately when the promotion checks fail persistently.

This document is operational guidance only; it does not change runtime, provider, weather-model, safety, or deployment behavior.
