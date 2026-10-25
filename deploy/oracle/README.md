# Oracle API deployment

API changes on `main` are deployed automatically by `.github/workflows/deploy-api.yml` (see [Automatic deploy from CI](#automatic-deploy-from-ci)). The same blue/green script remains the manual path and is what CI runs on the host.

Production checkout on the Oracle host: `/home/ubuntu/hava81-prod-20261021` (user `ubuntu`). Do **not** use the old `/home/ubuntu/Hava81` checkout.

Manual deployment from the repository root:

```bash
cd ~/hava81-prod-20261021 && git pull
sudo deploy/oracle/deploy-api-blue-green.sh                      # builds apps/api on the host
# or deploy a CI-built image without building on the host:
sudo HAVA81_API_IMAGE=ghcr.io/zexy2/hava81-api:<sha> HAVA81_API_REVISION=<sha> \
  deploy/oracle/deploy-api-blue-green.sh
```

`HAVA81_API_IMAGE` switches the script from *build* to *pull* mode: it pulls the image, tags it as the slot's compose image and starts it with `--no-build`. Everything else (state/Nginx check, readiness, hourly smoke, traffic switch, promotion to 4002, rollback slot on 4001) is identical. In both modes the candidate must report the expected build revision on `/api/v1/health/ready` before traffic moves (build mode: checkout `HEAD`, passed to the image as the `HAVA81_API_REVISION` build-arg; pull mode: `HAVA81_API_REVISION`). The restored rollback slot is not held to the new revision. To redeploy an old commit whose API predates the `revision` field, add `HAVA81_API_VERIFY_REVISION=0`.

**Operation lock.** The default lock is now `/var/lib/hava81/api-operation.lock` (deploy, traffic switch and rollback share it). The former default `/var/lock/hava81-api-operation.lock` lives in a sticky world-writable directory; a copy created by another user (`chatgpt`) cannot be reopened even by root. The old workaround `HAVA81_API_OPERATION_LOCK=/var/lib/hava81/api-operation.lock` is now simply the default and keeps working. Remove the stale file once, while no deploy runs: `sudo rm -f /var/lock/hava81-api-operation.lock`.

The script acquires a shared non-blocking API-operation lock before it reads deployment state, so a second deploy, rollback, or direct traffic switch fails closed instead of racing the active operation. It then reads `/var/lib/hava81/current-api-port`, confirms that state matches the actual Nginx upstream, refuses an uncommitted `apps/api` working tree, builds the inactive slot from the current checkout, waits until the target satisfies the structured readiness/freshness/no-store contract, verifies the one-hour Open-Meteo endpoint with bounded retries, and only then calls `switch-api-traffic.sh`. The traffic switch accepts readiness only when the JSON reports `status=ready`, its timestamp is fresh, the response is `Cache-Control: no-store`, and the public post-switch probe returns the exact Hava81 production CORS origin; a failed public contract check restores the previous Nginx target. Normal deployments finish with validated production traffic on preferred port 4002 (`hava81-v21-canary`) and restore the previous production image to port 4001 (`hava81-green`) as the immediate rollback slot. Port 4001 may be active only during the controlled canary/promotion window or after an explicit rollback.

For a plan without changing containers or traffic:

```bash
sudo PLAN_ONLY=1 deploy/oracle/deploy-api-blue-green.sh
```

Rollback uses the port recorded by the traffic switch and fails closed when that marker is missing or invalid rather than guessing a fallback port:

```bash
sudo deploy/oracle/rollback-api.sh
```

Successful deployments also record the deployed revision (the verified image revision, else checkout `HEAD`) and `apps/api` tree IDs in `/var/lib/hava81/current-api-revision` and `/var/lib/hava81/current-api-tree` for later audits. Keep `deploy/oracle/.env` host-local and untracked.


## Build revision on /health

Every API image carries its commit SHA (`HAVA81_API_REVISION`, also the OCI `org.opencontainers.image.revision` label). It is reported on:

- `GET /api/v1/health` → `{ "status": "ok", "revision": "<sha>", "timestamp": "…" }`
- `GET /api/v1/health/live` and `GET /api/v1/health/ready` (`revision` field)

Images built without the build-arg (local `docker compose`, `deploy-green.sh`) report `"unknown"`.

```bash
curl -s https://api.hava81.zekiakgul.dev/api/v1/health
```

## Automatic deploy from CI

`.github/workflows/deploy-api.yml` runs on pushes to `main` that change `apps/api/**`, `deploy/oracle/**` or the workflow itself (and on manual *Run workflow* from `main`):

1. **verify**: API type-check, tests, build and the deploy-script contract tests.
2. **image**: builds `apps/api` with `HAVA81_API_REVISION=<sha>` and pushes `ghcr.io/zexy2/hava81-api:<sha>` and `:main` using the job's `GITHUB_TOKEN` (`packages: write`).
3. **deploy** (`environment: production`): the fail-closed secret gate runs before SSH. If any required secret is missing, the job fails with the missing secret names and explicitly reports that the published image was not deployed; configure the secrets and rerun the workflow for that commit. With secrets present, it SSHes to the host and runs `deploy/oracle/ci-deploy-api.sh <sha>`, piping the short-lived `GITHUB_TOKEN` on stdin for the GHCR pull. After a deployment result of `deployed`, it requires `https://api.hava81.zekiakgul.dev/api/v1/health` to report `revision == <sha>`; a `superseded` result is explicitly warned and skips the obsolete SHA verification because a newer main revision owns the deployment.

Runs are serialized (`concurrency: hava81-api-deploy`, never cancelled mid-switch).

`ci-deploy-api.sh` (runs as `ubuntu`, not root):

- refuses unless the checkout is on `main`, has no tracked local changes, `<sha>` is on `origin/main`, and no other API operation holds the lock;
- fast-forwards `main` to `<sha>`; if the checkout is already at a newer commit it prints `HAVA81_DEPLOY_RESULT=superseded` and deploys nothing (CI warns, no failure);
- runs `sudo -n HAVA81_API_OPERATION_LOCK=… HAVA81_API_IMAGE=ghcr.io/zexy2/hava81-api:<sha> HAVA81_API_REVISION=<sha> [DOCKER_CONFIG=<tmp>] deploy-api-blue-green.sh`; the registry credential lives in a private temp dir that is deleted on exit;
- can be pinned as an SSH forced command (the SHA is then read from `SSH_ORIGINAL_COMMAND`).

### Secrets and variables

Repository or `production` environment secrets:

| Name | Value |
| --- | --- |
| `ORACLE_SSH_HOST` | Oracle host name or IP |
| `ORACLE_SSH_USER` | `ubuntu` |
| `ORACLE_SSH_KEY` | private key of a dedicated deploy key pair (ed25519, no passphrase) |
| `ORACLE_SSH_KNOWN_HOSTS` | output of `ssh-keyscan -t ed25519 <host>` (verified against the host) |
| `ORACLE_SSH_PORT` | optional, default `22` |

Optional variable `ORACLE_DEPLOY_DIR` (default `/home/ubuntu/hava81-prod-20261021`).

### One-time host setup

```bash
# on your machine
ssh-keygen -t ed25519 -N '' -C hava81-ci-deploy -f hava81_ci_deploy
ssh-keyscan -t ed25519 <host>          # -> ORACLE_SSH_KNOWN_HOSTS

# on the Oracle host (user ubuntu): allow the key to run only the deploy entry point
echo 'command="/home/ubuntu/hava81-prod-20261021/deploy/oracle/ci-deploy-api.sh",restrict <contents of hava81_ci_deploy.pub>' >> ~/.ssh/authorized_keys

# passwordless sudo: Oracle's Ubuntu image already grants "ubuntu ALL=(ALL) NOPASSWD:ALL".
# Check with: sudo -n true && echo ok
# If it is not granted, add (visudo -f /etc/sudoers.d/hava81-deploy):
#   ubuntu ALL=(root) NOPASSWD:SETENV: /home/ubuntu/hava81-prod-20261021/deploy/oracle/deploy-api-blue-green.sh

sudo rm -f /var/lock/hava81-api-operation.lock   # stale lock owned by another user
```

The checkout must be able to `git fetch origin main` without credentials (public repo over HTTPS).

## CI success versus API deployment

The main CI workflow (`ci.yml`) still only validates and publishes the frontend. The API is redeployed by `deploy-api.yml`; if its secrets are missing or it fails, a green `main` CI run is not proof that the API was redeployed. The authoritative check is the public revision:

```bash
curl -s https://api.hava81.zekiakgul.dev/api/v1/health | jq -r .revision
```

The read-only observer compares `current-api-revision` against the latest
main revision and checks **runtime-relevant** API files before it reports
`github.api_deployment.pending=true`.

The additional `github.api_deployment.freshness.state` classifies that drift:

- `recent_runtime_drift`: CI succeeded less than two hours ago; allow for
  the automatic deploy or operator scheduling.
- `manual_deploy_review`: CI has been green for at least two hours and
  API runtime drift remains; check the `API deploy (Oracle)` workflow run and
  use `sudo PLAN_ONLY=1 deploy/oracle/deploy-api-blue-green.sh` before
  considering a manual deployment.
- `awaiting_main_ci`, `main_ci_not_green`, `pending_age_unknown`,
  `up_to_date`, `unknown`: distinguish in-flight builds, failed builds,
  unavailable age evidence, synchronized revisions, and unknown comparisons.

The timestamp used for `ci_age_seconds` is the GitHub **run updated time**,
not the start or progress of any Oracle deployment. The observer never changes
Nginx upstreams, ports, or containers, and it does not label any deploy as
stuck merely because the main branch advanced.
