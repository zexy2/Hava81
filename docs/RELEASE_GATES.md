# Hava81 Release Gates

This runbook is intentionally conservative: a green code check does not override a red host or production safety signal.

## 1. Before merge or deploy

- Read the fresh SentinelX observer state and compare `collected_at` with the current time.
- Re-check the live host immediately before a merge, restart, rollback, or traffic change.
- Require `can_merge_or_deploy=true`, `host.healthy=true`, and `api_build_headroom_ok=true`.
- Preserve the active API slot and the rollback slot. The validated topology is active traffic on `4002` with `4001` retained for canary/rollback unless a later validated deployment explicitly changes it.
- Do not mutate a pending PR branch from a second workstream. Re-read the remote head and use the exact expected head SHA for merges.

## 2. Required repository checks

For an API or cross-cutting change, require all applicable protected checks on the exact PR head:

- Frontend quality
- API test & build
- Production build
- Browser flows
- Lighthouse budgets
- CodeQL (JavaScript/TypeScript)

A missing, stale, or unknown check is not a passing check. If the Oracle host cannot run a local dependency-backed gate, hosted exact-head checks remain mandatory.

## 3. API rollout sequence

1. Confirm the PR is current, mergeable, and green on the exact head SHA.
2. Merge with the expected head SHA; do not merge an older branch after `main` advances.
3. Watch the main production pipeline to completion.
4. Validate the new build on the rollback/canary slot (`4001`) before moving traffic.
5. Check readiness, CORS, provider-circuit state, root/province responses, and boot assets.
6. Move traffic only after the canary is healthy; keep the previous slot available for immediate rollback.
7. Smoke-test the public custom domain and confirm the deployed revision matches the intended commit.

## 4. Immediate rollback triggers

Rollback or stop the rollout on persistent readiness failure, repeated 5xx responses, CORS failure, a blank or broken frontend shell, broken core mobile flow, or an unexplained provider-circuit regression.

## 5. Data-truth constraints

- MGM hazards remain authoritative only when surfaced from a verified, freshness-aware official source.
- Open-Meteo context is modeled guidance and must remain attributed.
- Do not call interpolated precipitation a radar nowcast.
- Do not serialize live weather, UV, health, warning, or decision values into static SEO metadata.
