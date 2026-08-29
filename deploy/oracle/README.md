# Oracle API deployment

The GitHub Actions workflow validates the API and frontend and can publish the frontend, but it does **not** deploy the Oracle-hosted API container. API changes therefore need an explicit blue/green deployment on the Oracle host after the merged revision is checked out.

Recommended deployment from the repository root:

```bash
sudo deploy/oracle/deploy-api-blue-green.sh
```

The script reads `/var/lib/hava81/current-api-port`, confirms that state matches the actual Nginx upstream, refuses an uncommitted `apps/api` working tree, builds the inactive slot from the current checkout, waits for readiness, verifies the one-hour Open-Meteo endpoint, and only then calls `switch-api-traffic.sh`. The active slot alternates between 4001 (`hava81-green`) and 4002 (`hava81-v21-canary`). The previous slot remains available for rollback.

For a plan without changing containers or traffic:

```bash
sudo PLAN_ONLY=1 deploy/oracle/deploy-api-blue-green.sh
```

Rollback uses the port recorded by the traffic switch:

```bash
sudo deploy/oracle/rollback-api.sh
```

Successful deployments also record the deployed repository revision and `apps/api` tree IDs in `/var/lib/hava81/current-api-revision` and `/var/lib/hava81/current-api-tree` for later audits. Keep `deploy/oracle/.env` host-local and untracked.
