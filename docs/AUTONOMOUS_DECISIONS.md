# Hava81 autonomous decisions

## Release and branch safety
- Do not experiment on main. Keep each improvement in its own branch/worktree.
- Never edit the pending PR #1358 branch from a second workstream. P1.3 is a dependent branch based on its head and must be rebased only after the parent merges.
- Before merge/deploy/rollback, re-check current head SHA, CI, mergeability, and a fresh observer snapshot.
- If a normal write is blocked by platform safety controls, stop; do not try an alternate write path.
- Keep checkpoints append-only and preserve all prior valid entries.

## API operations
- Keep primary API port 4002; port 4001 is rollback/canary.
- No API deployment without local gates, green CI, blue-green/canary readiness, and public revision verification.
- A missing required deployment credential must fail the job, not silently skip it and leave a green run.
- Keep the fail-closed gate separate until tests and workflow integration pass.

## Weather and AQI integrity
- OpenWeather AQI uses 1–5 categories; Open-Meteo European AQI uses a different numeric scale. Never pass European AQI directly to the 1–5 classifier.
- Preserve provider/source/freshness metadata. Stale optional evidence is unavailable, not a zero.
- Every slot at or beyond 72 hours has low plan confidence.
- Intent weights tune preferences but cannot bypass absolute safety ceilings for extreme temperature, very-poor AQI, severe wind, heavy precipitation, or severe weather.
- A surfaced material risk must not receive the excellent band.
- Do not call interpolated precipitation radar nowcast or present modeled guidance as an official MGM warning.

## Product quality
- Hava81 tells users what to do about the weather; avoid generic dashboard bloat.
- Improve visual hierarchy, first viewport, typography, state clarity, dark mode, and mobile ergonomics only with evidence.
- Measure real production before performance changes and keep Lighthouse artifacts tied to exact SHAs.

## 2026-10-23 — GitHub Actions repository-script prerequisites
If a workflow job invokes a script stored in the repository, that job must check out the exact workflow SHA before running the script. Use `persist-credentials: false` when the job does not need authenticated Git operations, and keep a workflow contract test that asserts checkout precedes the script. A failed gate before SSH/deploy must leave the prior production revision serving and must not be described as a successful deploy.
