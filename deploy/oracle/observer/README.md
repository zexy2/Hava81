# Hava81 production observer

This directory versions the read-only observer that runs on the Oracle host every five minutes.

Runtime paths:

- `/usr/local/lib/hava81-worker/observer.py` — collector
- `/usr/local/bin/hava81-worker-status` — compact human-readable status
- `/etc/systemd/system/hava81-observer.service` — hardened oneshot service
- `/etc/systemd/system/hava81-observer.timer` — five-minute timer
- `/var/lib/hava81-worker/state.json` — latest state snapshot
- `/var/log/hava81-worker/history.jsonl` and `events.jsonl` — append-only history/change events

The observer is intentionally read-only with respect to the Hava81 repository and production traffic. It validates the public frontend, API readiness/CORS, Nginx API target, host disk floor and GitHub CI state. Readiness is considered healthy only when the API payload timestamp is fresh (within 180 seconds) and the response explicitly carries `Cache-Control: no-store`, preventing a stale intermediary response from satisfying the health gate.

After deploying an observer change, validate the Python files, start the oneshot once, inspect `state.json`, then confirm the timer remains active. Do not change the expected production API port from 4002 unless the production topology has been deliberately migrated and validated.

Repository smoke test: `python3 deploy/oracle/observer/test_observer.py`. It covers timestamp parsing and proves that an otherwise healthy but stale readiness payload marks production unhealthy.
