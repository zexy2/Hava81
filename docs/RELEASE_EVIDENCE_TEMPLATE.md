# Hava81 Release Evidence Template

Use this template for every production-affecting release. It is intentionally evidence-first and does not replace the host safety gate.

## 1. Immutable identifiers

- Main base SHA:
- Candidate PR number:
- Candidate head SHA:
- Frontend deployed revision:
- API deployed revision:
- Observer `collected_at` (UTC):

## 2. Host gate

Record a fresh observer sample immediately before merge/deploy:

- `host.healthy`:
- `host.disk.used_percent`:
- `host.disk.free_bytes`:
- `host.disk.api_build_headroom_ok`:
- `worker.can_merge_or_deploy`:
- Blocking reasons:

If `host.healthy=false`, `api_build_headroom_ok=false`, or `can_merge_or_deploy=false`, stop the release mutation. Continue only with isolated, reversible non-runtime work.

## 3. CI and security

- Hosted CI run ID / conclusion:
- CodeQL run ID / conclusion:
- Required checks green at exact candidate head: yes/no
- Head moved since last verification: yes/no

## 4. Production smoke

Run against the public deployment after rollout or when verifying the current state:

- Frontend root HTTP status:
- Canonical city route HTTP status:
- `/api/v1/health/live` HTTP status:
- `/api/v1/health/ready` HTTP status:
- Readiness reported status:
- Readiness timestamp age:
- `cache-control`:
- CORS allow-origin:
- Nginx active API port:
- Stable/canary topology preserved (`4002` / `4001`): yes/no

## 5. Decision and rollback

- Merge decision:
- Deploy decision:
- Rollback decision:
- Evidence links/comments:
- Follow-up queue:

### Non-negotiable data-integrity reminders

- Do not fabricate weather, UV, health, or safety information.
- MGM warnings are authoritative only when a stable official freshness-aware machine-readable source is verified; otherwise keep any modeled guidance explicitly attributed.
- Do not label interpolated precipitation as radar nowcast.
- Modeled marine context is decision support, not navigation safety guidance.
