#!/usr/bin/env bash
# Fail closed when the Oracle API deploy job cannot authenticate to the host.
# Only variable names are reported; secret values must never enter logs.
set -euo pipefail

required=(
  ORACLE_SSH_HOST
  ORACLE_SSH_USER
  ORACLE_SSH_KEY
  ORACLE_SSH_KNOWN_HOSTS
)
missing=()
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    missing+=("$name")
  fi
done

if (("${#missing[@]}")); then
  printf '::error title=API deploy blocked::Missing required Oracle API deployment secrets: %s\n' "${missing[*]}" >&2
  exit 1
fi

printf 'Required Oracle API deployment secrets are configured.\n'
