# Security Policy

## Reporting a vulnerability

Please do **not** open a public GitHub issue for a suspected security vulnerability, exposed credential, authentication problem or abuse path.

Use GitHub's private security reporting for this repository when available. Include:

- the affected surface or endpoint,
- a concise description of the impact,
- reproducible steps or a minimal proof of concept,
- any conditions required to trigger the issue,
- suggested remediation if you have one.

Please avoid accessing data that is not yours, disrupting production services, performing denial-of-service testing or publishing vulnerability details before a fix is available.

## Secrets

Provider credentials such as `OPENWEATHER_API_KEY` are server-side secrets. They must never be committed, exposed through `VITE_` environment variables or embedded in browser assets.

## Supported version

Security fixes target the current production version and the latest `main` branch.
