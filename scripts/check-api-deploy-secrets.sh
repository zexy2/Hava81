#!/usr/bin/env bash
# Fail closed before Oracle SSH/deploy steps if a required credential is missing.
# Print secret names only; never print or serialize secret values.
set -euo pipefail

if [[ -z "${GITHUB_OUTPUT:-}" ]]; then
  printf '::error title=API deploy blocked::GITHUB_OUTPUT is required for the deploy gate\n' >&2
  exit 1
fi

required=(ORACLE_SSH_HOST ORACLE_SSH_USER ORACLE_SSH_KEY ORACLE_SSH_KNOWN_HOSTS)
missing=()
for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    missing+=("$name")
  fi
done

if (("${#missing[@]}" > 0)); then
  image="${HAVA81_API_IMAGE:-<unknown image>}"
  message="Oracle API deploy blocked: missing required secrets: ${missing[*]}. Image ${image} was published but was NOT deployed. Configure the secrets and rerun the workflow for this commit."
  printf '::error title=API deploy blocked::%s\n' "$message" >&2
  if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
    {
      printf '### API deploy blocked\n\n'
      printf '%s\n' "$message"
    } >> "$GITHUB_STEP_SUMMARY"
  fi
  exit 1
fi

printf 'enabled=true\n' >> "$GITHUB_OUTPUT"
