# Hava81 production observer

This directory versions the read-only observer that runs on the Oracle host every five minutes.

Runtime paths:

- `/usr/local/lib/hava81-worker/observer.py` — collector
- `/usr/local/bin/hava81-worker-status` — compact human-readable status
- `/etc/systemd/system/hava81-observer.service` — hardened oneshot service
- `/etc/systemd/system/hava81-observer.timer` — five-minute timer
- `/var/lib/hava81-worker/state.json` — latest state snapshot
- `/var/log/hava81-worker/history.jsonl` and `events.jsonl` — append-only history/change events

The observer is intentionally read-only with respect to the Hava81 repository and production traffic. It validates the public frontend, API readiness/CORS, Nginx API target, host disk floor and GitHub CI state. It also compares the `apps/api` tree from the latest observed `main` workflow revision with `/var/lib/hava81/current-api-tree`; a merged API change that has not reached the Oracle container is surfaced as `api_deploy_pending` without turning an otherwise healthy endpoint into a false production incident. Readiness is considered healthy only when the API payload timestamp is fresh (within 180 seconds) and the response explicitly carries `Cache-Control: no-store`, preventing a stale intermediary response from satisfying the health gate.

After deploying an observer change, validate the Python files, start the oneshot once, inspect `state.json`, then confirm the timer remains active. The Nginx target check follows `/var/lib/hava81/current-api-port`, which is updated only after a validated blue/green traffic switch; if that state file is absent on a legacy install, the observer falls back to port 4002.

Repository smoke test: `python3 deploy/oracle/observer/test_observer.py`. It covers timestamp parsing, blue/green Nginx state, disk guards and API deployment-tree drift detection.
