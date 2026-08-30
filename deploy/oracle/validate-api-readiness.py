#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

MAX_READY_AGE_SECONDS = 180
MAX_FUTURE_SKEW_SECONDS = 60


def parse_headers(path: Path) -> dict[str, str]:
    headers: dict[str, str] = {}
    for raw_line in path.read_text(encoding='utf-8', errors='replace').splitlines():
        if ':' not in raw_line:
            continue
        name, value = raw_line.split(':', 1)
        headers[name.strip().lower()] = value.strip()
    return headers


def parse_timestamp(value: object) -> datetime:
    if not isinstance(value, str) or not value:
        raise ValueError('readiness timestamp is missing')
    normalized = value[:-1] + '+00:00' if value.endswith('Z') else value
    parsed = datetime.fromisoformat(normalized)
    if parsed.tzinfo is None:
        raise ValueError('readiness timestamp must include a timezone')
    return parsed.astimezone(timezone.utc)


def validate(body_path: Path, headers_path: Path, expected_origin: str | None = None) -> None:
    payload = json.loads(body_path.read_text(encoding='utf-8'))
    if not isinstance(payload, dict) or payload.get('status') != 'ready':
        raise ValueError('readiness payload did not report status=ready')

    observed_at = parse_timestamp(payload.get('timestamp'))
    age_seconds = (datetime.now(timezone.utc) - observed_at).total_seconds()
    if age_seconds > MAX_READY_AGE_SECONDS:
        raise ValueError(f'readiness payload is stale ({age_seconds:.1f}s old)')
    if age_seconds < -MAX_FUTURE_SKEW_SECONDS:
        raise ValueError(f'readiness payload timestamp is too far in the future ({-age_seconds:.1f}s)')

    headers = parse_headers(headers_path)
    cache_control = headers.get('cache-control', '')
    directives = {part.strip().lower() for part in cache_control.split(',') if part.strip()}
    if 'no-store' not in directives:
        raise ValueError('readiness response must include Cache-Control: no-store')

    if expected_origin is not None:
        actual_origin = headers.get('access-control-allow-origin')
        if actual_origin != expected_origin:
            raise ValueError(
                f'readiness CORS mismatch: expected {expected_origin!r}, got {actual_origin!r}'
            )


def main() -> int:
    if len(sys.argv) not in (3, 4):
        print(f'usage: {sys.argv[0]} BODY_FILE HEADERS_FILE [EXPECTED_ORIGIN]', file=sys.stderr)
        return 2
    try:
        validate(Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3] if len(sys.argv) == 4 else None)
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f'API readiness validation failed: {exc}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
