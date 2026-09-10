# Hava81 host-gate safety runbook

This runbook documents the fail-closed rules used before repository merges and Oracle deployments. It is intentionally documentation-only and does not change runtime behavior.

## Required gates

1. **Observer freshness** — read `/var/lib/hava81-worker/state.json` and compare `collected_at` with the current time. If the observer is stale or incomplete, query GitHub and the host directly before acting.
2. **Production health** — verify frontend root/city responses, API readiness, CORS, boot assets, and the active nginx upstream. Production must remain on API port `4002`; port `4001` is reserved for validated canary/rollback use.
3. **Exact-head safety** — before merging a PR, re-read its current head SHA and mergeability. Use the exact SHA as an optimistic lease so a moved branch cannot be merged accidentally.
4. **Host disk gate** — do not install API dependencies, run API builds, merge API changes, or deploy API changes while `api_build_headroom_ok=false` or the host is otherwise unhealthy.
5. **API release sequence** — for an API change, run local and hosted checks, deploy to `4001`, verify readiness/CORS/core smoke, then switch traffic to `4002` only after the canary is healthy. Keep `4001` available for rollback.
6. **Rollback triggers** — roll back on persistent readiness failure, repeated 5xx responses, CORS failure, blank/broken frontend, or a broken core mobile flow.

## Safe disk cleanup policy

Only reclaim space when ownership is proven and the target is rebuildable or explicitly disposable. Never remove unrelated user data, unknown caches, active release artifacts, or rollback material merely to clear the gate. Prefer measured, reversible cleanup and re-check free space after every action.

## Continuity policy

A queued workflow, pending review, external propagation delay, or canary observation is not a reason to stop. Continue independent work in an isolated branch/worktree, periodically re-check pending processes, and merge/deploy as soon as all gates are green.

## Evidence to record

Each autonomous run should record the current main SHA, production revisions, active API port, host gate result, pending PR/run identifiers, exact next action, and the prioritized follow-up queue in `docs/AUTONOMOUS_PROGRESS.md` before the execution window ends.
