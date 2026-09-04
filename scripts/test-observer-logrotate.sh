#!/usr/bin/env bash
set -euo pipefail

repo="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
config="$repo/deploy/oracle/observer/hava81-observer.logrotate"
installer="$repo/deploy/oracle/install-observer.sh"

grep -Fxq '/var/log/hava81-worker/history.jsonl /var/log/hava81-worker/events.jsonl {' "$config"
grep -Eq '^[[:space:]]+su ubuntu ubuntu$' "$config"
grep -Eq '^[[:space:]]+size 8M$' "$config"
grep -Eq '^[[:space:]]+rotate 6$' "$config"
grep -Eq '^[[:space:]]+compress$' "$config"
grep -Eq '^[[:space:]]+delaycompress$' "$config"
grep -Eq '^[[:space:]]+missingok$' "$config"
grep -Eq '^[[:space:]]+notifempty$' "$config"
grep -Eq '^[[:space:]]+create 0644 ubuntu ubuntu$' "$config"
grep -Fq 'hava81-observer.logrotate' "$installer"
grep -Fq '/etc/logrotate.d/hava81-observer' "$installer"
grep -Fq '/usr/sbin/logrotate --debug' "$installer"

echo 'Observer logrotate retention contract is bounded and installer-wired'
