# Hava81 live operational state — 2026-09-23

This checkpoint records the verified state observed during the autonomous maintenance window. It is intentionally append-only and does not change runtime behavior.

## Production

- Frontend revision: `bb874b520124a61934f353c09dbae9636f4a7911`
- Frontend smoke: root, İstanbul, boot assets, CORS, and readiness checks are green.
- Stable API slot: `4002`
- Rollback/canary slot: `4001`
- OpenWeather provider circuit: `closed`

## Release gate

- Deployed API revision: `d8445e8af156a147d888bf64efbeabb3dc8c66c5`
- Current `main`: `bb874b520124a61934f353c09dbae9636f4a7911`
- API promotion remains fail-closed until the deployed API revision matches current `main` and the blue-green validation path passes.
- No port switch or production API restart was performed in this checkpoint.

## Host capacity

- Root filesystem: approximately 90.7% used, approximately 4.48 GB free.
- API build headroom is currently above the worker reserve threshold.
- No project data, snapshots, or unrelated worktrees were removed.

## Browser-flow follow-up

- PR #1192 remains blocked only by stale `aria-current="location"` assertions in `e2e/smoke.spec.ts`.
- The isolated local test-only fix is preserved at commit `0d72e8baed685507f710edac7df063f088184600` in `/home/ubuntu/hava81-run11-e2e-fix-2344`.
- The pending PR branch was not mutated because host HTTPS push authentication is unavailable.

## Next queue

1. Publish the isolated E2E fix through an authenticated GitHub write path.
2. Re-run Browser flows on the exact follow-up head and merge only after all required gates are green.
3. Re-check the API deployment revision before any promotion or slot switch.
4. Continue independent accessibility, mobile ergonomics, performance, and observability work while external jobs are pending.
