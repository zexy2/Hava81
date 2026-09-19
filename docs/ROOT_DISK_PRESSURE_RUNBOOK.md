# Root disk pressure runbook

This runbook records the fail-closed operating policy for the Oracle host while Hava81 is near the root filesystem pressure threshold.

## Current guardrails

- Keep the public API on port `4002`.
- Retain port `4001` as the rollback/canary slot.
- Do not merge or deploy API changes when the observer reports `api_build_headroom_ok=false` or `usage_ok=false`.
- Do not weaken the disk gate, delete unrelated user data, or remove active/dirty worktrees.
- Re-verify the observer state immediately before any merge, deploy, rollback, or service restart.

## Safe cleanup order

1. Remove only clean, aged Hava81 worktrees whose branches are preserved and whose ownership is unambiguous.
2. Re-check disk usage and API build headroom after cleanup.
3. Inspect Hava81-owned caches, temporary build output, and logs before considering any removal.
4. Leave unrelated system consumers such as Snap data untouched unless an explicit operator-approved maintenance action exists.
5. If the gate remains closed, continue isolated non-API work and documentation; do not force a release through the gate.

## Evidence to record

For every cleanup or release decision, record:

- `collected_at` and the fresh observer result;
- free bytes, used percentage, and `api_build_headroom_ok`;
- exact worktrees or Hava81-owned artifacts changed;
- the production frontend revision, API revision, and active port;
- the exact next action for the following autonomous run.

This file is operational guidance only. It does not authorize deleting unrelated data or changing the production port topology.
