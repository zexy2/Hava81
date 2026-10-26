# Hava81 production observer

This directory versions the read-only observer intended to run on the Oracle host every five minutes. Each snapshot records the hostname where disk and browser-process metrics were collected; a copied or gateway-local snapshot is not a fresh measurement of Oracle disk capacity.

Runtime paths:

- `/usr/local/lib/hava81-worker/observer.py` — collector
- `/usr/local/bin/hava81-worker-status` — compact human-readable status, including snapshot age/freshness (stale after ten minutes; future clock skew over 60 seconds is rejected) and root/TR/EN revision and boot-asset parity
- `/etc/systemd/system/hava81-observer.service` — hardened oneshot service
- `/etc/systemd/system/hava81-observer.timer` — five-minute timer
- `/var/lib/hava81-worker/state.json` — latest state snapshot
- `/var/log/hava81-worker/history.jsonl` and `events.jsonl` — append-only history/change events
  - installed logrotate policy rotates either file at 8 MiB, keeps six compressed generations, and recreates files as `ubuntu:ubuntu` 0644

The observer is intentionally read-only with respect to the Hava81 repository and production traffic. It validates the public root, Turkish İstanbul and English `/en/istanbul/` shells; requires all three build-revision markers to exist and agree; verifies every hashed boot asset referenced by those shells; and checks API readiness/CORS, Nginx API target, host disk floor and GitHub CI state. API deployment drift is derived from the GitHub comparison between `/var/lib/hava81/current-api-revision` and the latest observed `main` revision, but only Docker/runtime inputs (`apps/api/src`, the API Docker/package/TypeScript build files, and the Oracle compose file) count as deploy-relevant. Test-only or documentation-only API changes therefore do not request a needless blue/green traffic switch. A merged runtime API change that has not reached the Oracle container is surfaced as `api_deploy_pending` without turning an otherwise healthy endpoint into a false production incident. Readiness is considered healthy only when the API payload timestamp is fresh (within 180 seconds) and the response explicitly carries `Cache-Control: no-store`, preventing a stale intermediary response from satisfying the health gate.

Deploy a merged observer revision with `sudo bash deploy/oracle/install-observer.sh`. The installer runs the versioned observer tests and Python compilation first, then acquires both the legacy `/run/hava81-worker/observer.lock` and persistent `/var/lib/hava81-worker/observer.lock` during upgrade. The service uses the persistent state-directory lock so systemd cleanup of `/run` cannot unlink the active lock inode between oneshot runs. The installer reloads systemd while both locks are held, releases them before starting a collection, keeps the five-minute timer enabled, verifies that it remains enabled/active, and prints the resulting status. It never stops or disables the timer.

After any observer deployment, inspect `state.json` and confirm the expected new checks are present and healthy. The Nginx target check follows `/var/lib/hava81/current-api-port`, which is updated only after a validated blue/green traffic switch; if that state file is absent on a legacy install, the observer falls back to port 4002.

Repository smoke test: `python3 deploy/oracle/observer/test_observer.py`. It covers timestamp parsing, blue/green Nginx state, disk guards and API deployment-tree drift detection.

## GitHub REST authentication

The five-minute observer can use an optional read-only GitHub token from `/etc/hava81-worker/github.env`. The file is loaded by systemd when the oneshot service starts; its only supported variable is `HAVA81_GITHUB_TOKEN`. Use a fine-grained token restricted to `zexy2/Hava81` with **Contents: read-only**, **Actions: read-only**, and **Pull requests: read-only** permissions, and set an expiry/rotation reminder. Keep the file root-owned and mode `0600`; never commit it, print its contents, or reuse the OpenWeather production credential. The request client attaches the token only to HTTPS requests whose exact host is `api.github.com`; it uses an unredirected Authorization header so urllib cannot forward the token to a different redirect host.

If the file is absent, the observer continues anonymously and records `auth_mode=anonymous`. GitHub's shared unauthenticated REST quota may then return HTTP 403 with `rate_limit_remaining=0`; that means CI/PR state is unknown, not green. Configure the credential before relying on the observer's merge/deploy signals. The timer remains enabled and active throughout credential setup.
