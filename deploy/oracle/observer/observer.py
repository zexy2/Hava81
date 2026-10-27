#!/usr/bin/env python3
from __future__ import annotations

import json
import math
import os
import pwd
import re
import socket
import ssl
import subprocess
import tempfile
import time
import unicodedata
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit
from typing import Any

STATE_DIR = Path('/var/lib/hava81-worker')
LOG_DIR = Path('/var/log/hava81-worker')
STATE_FILE = STATE_DIR / 'state.json'
HISTORY_FILE = LOG_DIR / 'history.jsonl'
EVENTS_FILE = LOG_DIR / 'events.jsonl'
NGINX_SITE = Path('/etc/nginx/sites-enabled/api.hava81.zekiakgul.dev')
CURRENT_API_PORT_FILE = Path('/var/lib/hava81/current-api-port')
DEPLOYED_API_REVISION_FILE = Path('/var/lib/hava81/current-api-revision')
DEPLOYED_API_TREE_FILE = Path('/var/lib/hava81/current-api-tree')
DEFAULT_API_PORT = 4002
PREFERRED_API_PORT = 4002
ALLOWED_API_PORTS = {4000, 4001, 4002}
REPO = 'zexy2/Hava81'
MINIMUM_ROOT_FREE_BYTES = 2 * 1024 * 1024 * 1024
MAXIMUM_ROOT_USED_PERCENT = 92.0
API_BUILD_DISK_RESERVE_BYTES = 512 * 1024 * 1024
ROOT_DISK_WARNING_USED_PERCENT = 85.0
MAX_READY_AGE_SECONDS = 180
MAX_FUTURE_SKEW_SECONDS = 60
MAX_CURRENT_WEATHER_SOURCE_AGE_SECONDS = 2 * 60 * 60
MAX_CURRENT_WEATHER_FRESHNESS_SECONDS = 24 * 60 * 60
USER_AGENT = 'Hava81-Deterministic-Observer/1.0'
SSL_CONTEXT = ssl.create_default_context()
API_RUNTIME_PATHS = {
    'apps/api/.dockerignore',
    'apps/api/Dockerfile',
    'apps/api/package-lock.json',
    'apps/api/package.json',
    'apps/api/tsconfig.json',
    'deploy/oracle/docker-compose.yml',
}
API_RUNTIME_PREFIXES = ('apps/api/src/',)
GITHUB_COMPARE_FILE_LIMIT = 300
GITHUB_COMPARE_TIMEOUT_SECONDS = 12.0
GITHUB_RUNS_TIMEOUT_SECONDS = 12.0
GITHUB_RUNS_FALLBACK_PAGE_SIZE = 30
PR_CHECK_CACHE_SECONDS = 15 * 60
API_DEPLOY_REVIEW_AFTER_SECONDS = 2 * 60 * 60
BOOT_ASSET_TRANSIENT_RETRY_LIMIT = 2
SHELL_TRANSIENT_RETRY_LIMIT = 1
SHELL_TRANSIENT_RETRY_DELAY_SECONDS = 0.25
TRANSIENT_HTTP_STATUS_CODES = {408, 425, 500, 502, 503, 504}
HAVA81_BROWSER_STALE_SECONDS = 2 * 60 * 60
MAX_STALE_BROWSER_PROCESSES_REPORTED = 8
HAVA81_BROWSER_PROFILE_NAMES = {'h81deploycheck', 'h81meta', 'h81text'}
HAVA81_BROWSER_PROFILE_ARG = re.compile(r'--user-data-dir(?:=|\s+)([^\s]+)')


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


def http_get(url: str, *, headers: dict[str, str] | None = None, timeout: float = 6.0) -> dict[str, Any]:
    request_headers = {'User-Agent': USER_AGENT, 'Accept': 'application/json,text/html;q=0.9,*/*;q=0.8'}
    if headers:
        request_headers.update(headers)

    # The observer runs every five minutes, so anonymous REST requests can
    # exhaust GitHub's 60/hour shared-IP limit. An optional read-only token is
    # supplied by the systemd EnvironmentFile; never attach it to production,
    # weather-provider, or arbitrary URLs, and never include it in diagnostics.
    parsed_url = urlsplit(url)
    github_token = os.environ.get('HAVA81_GITHUB_TOKEN', '').strip()
    if (
        github_token
        and parsed_url.scheme == 'https'
        and parsed_url.hostname == 'api.github.com'
    ):
        request_headers.setdefault('Authorization', f'Bearer {github_token}')

    # urllib copies Request.headers to redirect targets. Keep Authorization in
    # unredirected_hdrs so it is sent to the original API request but is never
    # copied if GitHub responds with a cross-host redirect.
    authorization = next(
        (request_headers.pop(key) for key in tuple(request_headers) if key.lower() == 'authorization'),
        None,
    )
    req = urllib.request.Request(url, headers=request_headers, method='GET')
    if authorization:
        req.add_unredirected_header('Authorization', authorization)
    started = time.monotonic()
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=SSL_CONTEXT) as response:
            body = response.read(1_500_000)
            content_type = response.headers.get('content-type', '')
            parsed: Any = None
            if 'json' in content_type.lower() or body[:1] in (b'{', b'['):
                try:
                    parsed = json.loads(body.decode('utf-8'))
                except (UnicodeDecodeError, json.JSONDecodeError):
                    parsed = None
            body_text: str | None = None
            if 'html' in content_type.lower():
                try:
                    body_text = body.decode('utf-8')
                except UnicodeDecodeError:
                    body_text = None
            return {
                'ok': 200 <= response.status < 400,
                'status': response.status,
                'elapsed_ms': round((time.monotonic() - started) * 1000),
                'headers': {
                    'access-control-allow-origin': response.headers.get('access-control-allow-origin'),
                    'cache-control': response.headers.get('cache-control'),
                    'x-ratelimit-remaining': response.headers.get('x-ratelimit-remaining'),
                    'x-ratelimit-reset': response.headers.get('x-ratelimit-reset'),
                },
                'json': parsed,
                'text': body_text,
                'error': None,
            }
    except urllib.error.HTTPError as exc:
        remaining = exc.headers.get('x-ratelimit-remaining') if exc.headers else None
        reset = exc.headers.get('x-ratelimit-reset') if exc.headers else None
        error = f'HTTP {exc.code}'
        if parsed_url.hostname == 'api.github.com' and str(remaining) == '0':
            error = 'GitHub API rate limit exhausted'
            if reset:
                error += f' (reset epoch {reset})'
        return {
            'ok': False,
            'status': exc.code,
            'elapsed_ms': round((time.monotonic() - started) * 1000),
            'headers': {
                'access-control-allow-origin': exc.headers.get('access-control-allow-origin') if exc.headers else None,
                'cache-control': exc.headers.get('cache-control') if exc.headers else None,
                'x-ratelimit-remaining': remaining,
                'x-ratelimit-reset': reset,
            },
            'json': None,
            'error': error,
        }
    except Exception as exc:  # bounded observer: record, never mutate production
        return {
            'ok': False,
            'status': None,
            'elapsed_ms': round((time.monotonic() - started) * 1000),
            'headers': {},
            'json': None,
            'error': f'{type(exc).__name__}: {exc}',
        }


def expected_api_port() -> int:
    try:
        raw = CURRENT_API_PORT_FILE.read_text(encoding='utf-8').strip()
    except FileNotFoundError:
        return DEFAULT_API_PORT
    port = int(raw)
    if port not in ALLOWED_API_PORTS:
        raise ValueError(f'unsupported API port: {port}')
    return port


def nginx_target() -> dict[str, Any]:
    expected: int | None = None
    try:
        expected = expected_api_port()
        text = NGINX_SITE.read_text(encoding='utf-8')
        match = re.search(r'proxy_pass\s+http://127\.0\.0\.1:(\d+)\s*;', text)
        port = int(match.group(1)) if match else None
        return {'port': port, 'expected': expected, 'preferred': PREFERRED_API_PORT, 'preferred_ok': port == PREFERRED_API_PORT, 'ok': port == expected, 'error': None}
    except Exception as exc:
        return {'port': None, 'expected': expected, 'preferred': PREFERRED_API_PORT, 'preferred_ok': None, 'ok': False, 'error': f'{type(exc).__name__}: {exc}'}


def slim_http(result: dict[str, Any]) -> dict[str, Any]:
    summary = {
        'ok': result.get('ok'),
        'status': result.get('status'),
        'elapsed_ms': result.get('elapsed_ms'),
        'error': result.get('error'),
    }
    retry = result.get('retry')
    if isinstance(retry, dict):
        summary['retry'] = retry
    return summary


def is_transient_shell_failure(result: dict[str, Any]) -> bool:
    status = result.get('status')
    if status in TRANSIENT_HTTP_STATUS_CODES:
        return True
    if status is not None:
        return False

    error = str(result.get('error') or '').lower()
    return any(
        marker in error
        for marker in (
            'timed out',
            'timeout',
            'connection reset',
            'connection aborted',
            'remote end closed',
            'temporarily unavailable',
            'temporary failure in name resolution',
        )
    )


def http_get_with_transient_retry(
    url: str,
    *,
    headers: dict[str, str] | None = None,
    timeout: float = 6.0,
    retry_limit: int = SHELL_TRANSIENT_RETRY_LIMIT,
) -> dict[str, Any]:
    result = http_get(url, headers=headers, timeout=timeout)
    if retry_limit <= 0 or not is_transient_shell_failure(result):
        return result

    first_attempt = {
        'status': result.get('status'),
        'error': result.get('error'),
        'elapsed_ms': result.get('elapsed_ms'),
    }
    attempts = 1
    while attempts <= retry_limit and is_transient_shell_failure(result):
        time.sleep(SHELL_TRANSIENT_RETRY_DELAY_SECONDS)
        result = http_get(url, headers=headers, timeout=timeout)
        attempts += 1

    result['retry'] = {
        'attempts': attempts,
        'first_status': first_attempt['status'],
        'first_error': first_attempt['error'],
        'first_elapsed_ms': first_attempt['elapsed_ms'],
        'recovered': result.get('ok') is True,
    }
    return result


def extract_build_revision(html: Any) -> str | None:
    if not isinstance(html, str) or not html:
        return None
    match = re.search(
        r'<meta\b[^>]*\bname=["\']hava81-build-revision["\'][^>]*\bcontent=["\']([0-9a-f]{40})["\'][^>]*>',
        html,
        flags=re.IGNORECASE,
    )
    return match.group(1).lower() if match else None


def extract_boot_asset_paths(html: Any) -> list[str]:
    if not isinstance(html, str) or not html:
        return []
    assets: set[str] = set()
    for tag in re.findall(r'<(?:script|link)\b[^>]*>', html, flags=re.IGNORECASE):
        match = re.search(r'\b(?:src|href)=["\'](/assets/[^"\']+)["\']', tag, flags=re.IGNORECASE)
        if not match:
            continue
        path = match.group(1)
        if '..' in path.split('/'):
            continue
        assets.add(path)
    return sorted(assets)


def collect_boot_assets(
    root: dict[str, Any],
    city: dict[str, Any] | None = None,
    english_city: dict[str, Any] | None = None,
) -> dict[str, Any]:
    root_paths = extract_boot_asset_paths(root.get('text'))
    city_paths = extract_boot_asset_paths(city.get('text')) if city is not None else root_paths
    english_city_paths = (
        extract_boot_asset_paths(english_city.get('text')) if english_city is not None else []
    )
    paths = sorted(set(root_paths) | set(city_paths) | set(english_city_paths))
    failed: list[dict[str, Any]] = []
    transient_retries_remaining = BOOT_ASSET_TRANSIENT_RETRY_LIMIT
    for path in paths[:32]:
        result = http_get(f'https://hava81.zekiakgul.dev{path}', timeout=4.0)
        if is_transient_shell_failure(result) and transient_retries_remaining > 0:
            first_attempt = {
                'status': result.get('status'),
                'error': result.get('error'),
                'elapsed_ms': result.get('elapsed_ms'),
            }
            transient_retries_remaining -= 1
            result = http_get(f'https://hava81.zekiakgul.dev{path}', timeout=4.0)
            result['retry'] = {
                'attempts': 2,
                'first_status': first_attempt['status'],
                'first_error': first_attempt['error'],
                'first_elapsed_ms': first_attempt['elapsed_ms'],
                'recovered': result.get('status') == 200,
            }
        if result.get('status') != 200:
            failed.append({'path': path, **slim_http(result)})
    return {
        'ok': (
            bool(root_paths)
            and bool(city_paths)
            and (english_city is None or bool(english_city_paths))
            and not failed
            and len(paths) <= 32
        ),
        'count': len(paths),
        'root_count': len(root_paths),
        'city_count': len(city_paths),
        'english_city_count': len(english_city_paths),
        'failed': failed,
        'truncated': len(paths) > 32,
    }


def timestamp_age_seconds(value: Any) -> float | None:
    if (
        not isinstance(value, str)
        or 'T' not in value
        or not re.search(r'(?:Z|[+-]\d{2}:\d{2})$', value)
    ):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return round((datetime.now(timezone.utc) - parsed.astimezone(timezone.utc)).total_seconds(), 1)
    except ValueError:
        return None


def strict_timestamp_age_seconds(value: Any, now: datetime | None = None) -> float | None:
    """Parse a timezone-qualified ISO timestamp without assuming a timezone for naive values."""
    if (
        not isinstance(value, str)
        or 'T' not in value
        or not re.search(r'(?:Z|[+-]\d{2}:\d{2})$', value)
    ):
        return None
    try:
        parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
        if parsed.tzinfo is None or parsed.utcoffset() is None:
            return None
        current = now or datetime.now(timezone.utc)
        if current.tzinfo is None or current.utcoffset() is None:
            return None
        return round(
            (current.astimezone(timezone.utc) - parsed.astimezone(timezone.utc)).total_seconds(),
            1,
        )
    except (TypeError, ValueError, OverflowError):
        return None


def normalize_city_label(value: Any) -> str:
    if not isinstance(value, str):
        return ''
    decomposed = unicodedata.normalize('NFKD', value).casefold()
    return ''.join(char for char in decomposed if not unicodedata.combining(char)).strip()


def evaluate_current_weather(
    result: dict[str, Any],
    expected_provider: Any,
    now: datetime | None = None,
) -> tuple[dict[str, bool], dict[str, Any]]:
    """Fail closed unless the real public current-weather response is fresh and coherent."""
    payload = result.get('json') if isinstance(result.get('json'), dict) else {}
    meta = payload.get('meta') if isinstance(payload.get('meta'), dict) else {}
    coordinates = payload.get('coordinates') if isinstance(payload.get('coordinates'), dict) else {}

    city_name = payload.get('cityName')
    country = payload.get('country')
    temperature = payload.get('temperature')
    provider = meta.get('provider')
    fetched_age = strict_timestamp_age_seconds(meta.get('fetchedAt'), now)
    timestamp_age = strict_timestamp_age_seconds(payload.get('timestamp'), now)
    observed_value = meta.get('observedAt', payload.get('timestamp'))
    observation_age = strict_timestamp_age_seconds(observed_value, now)
    observed_timestamp_age = (
        strict_timestamp_age_seconds(meta.get('observedAt'), now)
        if meta.get('observedAt') is not None
        else timestamp_age
    )
    fresh_for = meta.get('freshForSeconds')
    fresh_for_valid = (
        isinstance(fresh_for, (int, float))
        and not isinstance(fresh_for, bool)
        and math.isfinite(fresh_for)
        and 0 < fresh_for <= MAX_CURRENT_WEATHER_FRESHNESS_SECONDS
    )
    lat = coordinates.get('lat')
    lon = coordinates.get('lon')
    coordinates_match = (
        isinstance(lat, (int, float))
        and not isinstance(lat, bool)
        and math.isfinite(lat)
        and 40 <= lat <= 42
        and isinstance(lon, (int, float))
        and not isinstance(lon, bool)
        and math.isfinite(lon)
        and 27 <= lon <= 30
    )
    observation_consistent = True
    if meta.get('observedAt') is not None:
        observation_consistent = (
            timestamp_age is not None
            and observed_timestamp_age is not None
            and abs(timestamp_age - observed_timestamp_age) <= 60
        )

    checks = {
        'current_weather_200': result.get('ok') is True and result.get('status') == 200,
        'current_weather_city_matches': (
            normalize_city_label(city_name) == 'istanbul'
            and isinstance(country, str)
            and country.upper() == 'TR'
            and coordinates_match
        ),
        'current_weather_temperature_valid': (
            isinstance(temperature, (int, float))
            and not isinstance(temperature, bool)
            and math.isfinite(temperature)
            and -100 <= temperature <= 100
        ),
        'current_weather_provider_matches': (
            isinstance(provider, str)
            and bool(provider.strip())
            and isinstance(expected_provider, str)
            and provider == expected_provider
        ),
        'current_weather_fetch_fresh': (
            fetched_age is not None
            and fresh_for_valid
            and -MAX_FUTURE_SKEW_SECONDS <= fetched_age <= fresh_for
        ),
        'current_weather_observation_fresh': (
            observation_age is not None
            and -MAX_FUTURE_SKEW_SECONDS
            <= observation_age
            <= MAX_CURRENT_WEATHER_SOURCE_AGE_SECONDS
        ),
        'current_weather_observation_consistent': observation_consistent,
    }
    return checks, {
        'status': result.get('status'),
        'elapsed_ms': result.get('elapsed_ms'),
        'city_name': city_name if isinstance(city_name, str) else None,
        'country': country if isinstance(country, str) else None,
        'provider': provider if isinstance(provider, str) else None,
        'temperature_valid': checks['current_weather_temperature_valid'],
        'fetched_age_seconds': fetched_age,
        'observation_age_seconds': observation_age,
        'fresh_for_seconds': fresh_for if fresh_for_valid else None,
        'cache_status': meta.get('cacheStatus') if isinstance(meta.get('cacheStatus'), str) else None,
        'ok': all(checks.values()),
        'error': result.get('error'),
    }


def collect_production() -> dict[str, Any]:
    # One bounded retry absorbs a short edge/network blip without masking persistent
    # failures. GitHub API requests deliberately do not use this helper: a 429 or
    # exhausted REST quota must not trigger another request.
    root = http_get_with_transient_retry('https://hava81.zekiakgul.dev/')
    city = http_get_with_transient_retry('https://hava81.zekiakgul.dev/istanbul/')
    english_city = http_get_with_transient_retry('https://hava81.zekiakgul.dev/en/istanbul/')
    ready = http_get_with_transient_retry(
        'https://api.hava81.zekiakgul.dev/api/v1/health/ready',
        headers={'Origin': 'https://hava81.zekiakgul.dev'},
    )
    current_weather = http_get_with_transient_retry(
        (
            'https://api.hava81.zekiakgul.dev/api/v1/weather/current'
            '?city=%C4%B0stanbul&units=metric&lang=en'
        ),
        headers={'Origin': 'https://hava81.zekiakgul.dev'},
    )
    boot_assets = collect_boot_assets(root, city, english_city)
    root_revision = extract_build_revision(root.get('text'))
    city_revision = extract_build_revision(city.get('text'))
    english_city_revision = extract_build_revision(english_city.get('text'))
    revisions = (root_revision, city_revision, english_city_revision)
    frontend_revision = {
        'known': all(revision is not None for revision in revisions),
        'consistent': all(revision is not None for revision in revisions) and len(set(revisions)) == 1,
        'root': root_revision,
        'city': city_revision,
        'english_city': english_city_revision,
    }
    ready_json = ready.get('json') if isinstance(ready.get('json'), dict) else {}
    provider = ready_json.get('provider') if isinstance(ready_json.get('provider'), dict) else {}
    current_weather_checks, current_weather_summary = evaluate_current_weather(
        current_weather,
        provider.get('name'),
    )
    ready_headers = ready.get('headers') or {}
    cors_value = ready_headers.get('access-control-allow-origin')
    cors_ok = cors_value == 'https://hava81.zekiakgul.dev'
    ready_timestamp = ready_json.get('timestamp')
    ready_age_seconds = timestamp_age_seconds(ready_timestamp)
    ready_cache_control = ready_headers.get('cache-control') or ''
    nginx = nginx_target()
    checks = {
        'root_200': root.get('status') == 200,
        'istanbul_200': city.get('status') == 200,
        'english_istanbul_200': english_city.get('status') == 200,
        'frontend_revision_known': frontend_revision['known'],
        'frontend_revision_consistent': frontend_revision['consistent'],
        'boot_assets_200': boot_assets.get('ok') is True,
        'api_ready_200': ready.get('status') == 200,
        'api_reports_ready': ready_json.get('status') == 'ready',
        'api_ready_fresh': (
            ready_age_seconds is not None
            and -MAX_FUTURE_SKEW_SECONDS <= ready_age_seconds <= MAX_READY_AGE_SECONDS
        ),
        'api_ready_no_store': 'no-store' in ready_cache_control.lower(),
        'cors_ok': cors_ok,
        'nginx_port_ok': nginx.get('ok') is True,
        **current_weather_checks,
    }
    issues = [name for name, ok in checks.items() if not ok]
    return {
        'healthy': not issues,
        'issues': issues,
        'checks': checks,
        'root': slim_http(root),
        'istanbul': slim_http(city),
        'english_istanbul': slim_http(english_city),
        'boot_assets': boot_assets,
        'frontend_revision': frontend_revision,
        'api_ready': {
            **slim_http(ready),
            'reported_status': ready_json.get('status'),
            'reported_timestamp': ready_timestamp,
            'age_seconds': ready_age_seconds,
            'cache_control': ready_cache_control or None,
            'provider': provider.get('name'),
            'provider_state': provider.get('state'),
        },
        'current_weather': current_weather_summary,
        'cors': {'allow_origin': cors_value, 'ok': cors_ok},
        'nginx': nginx,
    }


def is_hava81_browser_profile_args(args: str) -> bool:
    for match in HAVA81_BROWSER_PROFILE_ARG.finditer(args):
        profile_name = Path(match.group(1).strip('\"\'')).name
        if profile_name.startswith('hava81-') or profile_name in HAVA81_BROWSER_PROFILE_NAMES:
            return True
    return False


def _browser_process_state(stale: list[dict[str, Any]]) -> dict[str, Any]:
    stale.sort(key=lambda item: item['elapsed_seconds'], reverse=True)
    return {
        'known': True,
        'stale_after_seconds': HAVA81_BROWSER_STALE_SECONDS,
        'stale_count': len(stale),
        'processes': stale[:MAX_STALE_BROWSER_PROCESSES_REPORTED],
        'error': None,
    }


def collect_hava81_browser_processes_from_proc(
    proc_root: Path = Path('/proc'), boot_seconds: float | None = None
) -> dict[str, Any]:
    try:
        if boot_seconds is None:
            boot_seconds = time.clock_gettime(time.CLOCK_BOOTTIME)
        clock_ticks = int(os.sysconf('SC_CLK_TCK'))
    except (OSError, ValueError) as exc:
        return {
            'known': False,
            'stale_after_seconds': HAVA81_BROWSER_STALE_SECONDS,
            'stale_count': 0,
            'processes': [],
            'error': f'{type(exc).__name__}: {exc}',
        }

    stale: list[dict[str, Any]] = []
    try:
        entries = list(proc_root.iterdir())
    except OSError as exc:
        return {
            'known': False,
            'stale_after_seconds': HAVA81_BROWSER_STALE_SECONDS,
            'stale_count': 0,
            'processes': [],
            'error': f'{type(exc).__name__}: {exc}',
        }

    for entry in entries:
        if not entry.name.isdigit():
            continue
        try:
            args = (entry / 'cmdline').read_bytes().replace(b'\0', b' ').decode('utf-8', errors='replace').strip()
            if not is_hava81_browser_profile_args(args):
                continue
            command = (entry / 'comm').read_text(encoding='utf-8').strip()
            browser_identity = f'{command} {args}'.lower()
            if not any(token in browser_identity for token in ('chromium', 'chrome', 'playwright')):
                continue
            stat = (entry / 'stat').read_text(encoding='utf-8')
            stat_fields = stat[stat.rfind(')') + 2 :].split()
            start_ticks = int(stat_fields[19])
            elapsed_seconds = max(0, int(boot_seconds - (start_ticks / clock_ticks)))
            if elapsed_seconds < HAVA81_BROWSER_STALE_SECONDS:
                continue
            status = (entry / 'status').read_text(encoding='utf-8')
            uid_line = next(line for line in status.splitlines() if line.startswith('Uid:'))
            uid = int(uid_line.split()[1])
            try:
                user = pwd.getpwuid(uid).pw_name
            except KeyError:
                user = str(uid)
        except (OSError, ValueError, IndexError, StopIteration):
            continue
        stale.append({
            'pid': int(entry.name),
            'user': user,
            'command': command,
            'elapsed_seconds': elapsed_seconds,
        })

    return _browser_process_state(stale)


def collect_hava81_browser_processes() -> dict[str, Any]:
    try:
        result = subprocess.run(
            ['/usr/bin/ps', '-eo', 'pid=,etimes=,user=,comm=,args='],
            capture_output=True,
            text=True,
            timeout=2.0,
            check=False,
        )
    except (OSError, subprocess.SubprocessError):
        return collect_hava81_browser_processes_from_proc()

    if result.returncode != 0:
        return collect_hava81_browser_processes_from_proc()

    stale: list[dict[str, Any]] = []
    for raw_line in result.stdout.splitlines():
        parts = raw_line.strip().split(None, 4)
        if len(parts) != 5:
            continue
        pid_raw, elapsed_raw, user, command, args = parts
        if not is_hava81_browser_profile_args(args):
            continue
        browser_identity = f'{command} {args}'.lower()
        if not any(token in browser_identity for token in ('chromium', 'chrome', 'playwright')):
            continue
        try:
            pid = int(pid_raw)
            elapsed_seconds = int(elapsed_raw)
        except ValueError:
            continue
        if elapsed_seconds < HAVA81_BROWSER_STALE_SECONDS:
            continue
        stale.append({
            'pid': pid,
            'user': user,
            'command': command,
            'elapsed_seconds': elapsed_seconds,
        })

    return _browser_process_state(stale)


def collect_host() -> dict[str, Any]:
    usage = os.statvfs('/')
    browser_processes = collect_hava81_browser_processes()
    free_bytes = usage.f_bavail * usage.f_frsize
    total_bytes = usage.f_blocks * usage.f_frsize
    used_bytes = max(total_bytes - free_bytes, 0)
    raw_used_percent = (1 - (usage.f_bavail / usage.f_blocks)) * 100 if usage.f_blocks else 0.0
    used_percent = round(raw_used_percent, 1)
    free_ok = free_bytes >= MINIMUM_ROOT_FREE_BYTES
    usage_ok = raw_used_percent <= MAXIMUM_ROOT_USED_PERCENT
    pressure_warning = raw_used_percent >= ROOT_DISK_WARNING_USED_PERCENT
    required_free_bytes_for_usage_ok = math.ceil(
        total_bytes * (100 - MAXIMUM_ROOT_USED_PERCENT) / 100
    )
    bytes_to_free_for_usage_ok = max(required_free_bytes_for_usage_ok - free_bytes, 0)
    required_free_bytes_for_api_build = required_free_bytes_for_usage_ok + API_BUILD_DISK_RESERVE_BYTES
    bytes_to_free_for_api_build = max(required_free_bytes_for_api_build - free_bytes, 0)
    api_build_headroom_ok = bytes_to_free_for_api_build == 0
    bytes_to_free_for_ok = max(
        MINIMUM_ROOT_FREE_BYTES - free_bytes,
        bytes_to_free_for_usage_ok,
        0,
    )
    disk_ok = free_ok and usage_ok
    issues: list[str] = []
    warnings: list[str] = []
    if not free_ok:
        issues.append('root_disk_low')
    if not usage_ok:
        issues.append('root_disk_pressure')
    elif pressure_warning:
        warnings.append('root_disk_pressure_warning')
    if disk_ok and not api_build_headroom_ok:
        warnings.append('api_build_headroom_low')
    if browser_processes['stale_count'] > 0:
        warnings.append('stale_hava81_browser_processes')
    return {
        # Disk and process observations are local to the machine running this collector.
        'hostname': socket.gethostname(),
        'disk': {
            'free_bytes': free_bytes,
            'used_bytes': used_bytes,
            'total_bytes': total_bytes,
            'used_percent': used_percent,
            'minimum_free_bytes': MINIMUM_ROOT_FREE_BYTES,
            'maximum_used_percent': MAXIMUM_ROOT_USED_PERCENT,
            'warning_used_percent': ROOT_DISK_WARNING_USED_PERCENT,
            'required_free_bytes_for_usage_ok': required_free_bytes_for_usage_ok,
            'bytes_to_free_for_usage_ok': bytes_to_free_for_usage_ok,
            'api_build_reserve_bytes': API_BUILD_DISK_RESERVE_BYTES,
            'required_free_bytes_for_api_build': required_free_bytes_for_api_build,
            'bytes_to_free_for_api_build': bytes_to_free_for_api_build,
            'api_build_headroom_ok': api_build_headroom_ok,
            'bytes_to_free_for_ok': bytes_to_free_for_ok,
            'free_ok': free_ok,
            'usage_ok': usage_ok,
            'pressure_warning': pressure_warning,
            'ok': disk_ok,
        },
        'browser_processes': browser_processes,
        'healthy': disk_ok,
        'issues': issues,
        'warnings': warnings,
    }


def read_optional_marker(path: Path) -> str | None:
    try:
        value = path.read_text(encoding='utf-8').strip()
        return value or None
    except OSError:
        return None


def is_api_runtime_path(path: str) -> bool:
    return path in API_RUNTIME_PATHS or path.startswith(API_RUNTIME_PREFIXES)



def collect_api_runtime_snapshot(revision: str) -> dict[str, Any]:
    """Resolve the API runtime inputs for one revision without comparing history."""
    commit_lookup = http_get(
        f'https://api.github.com/repos/{REPO}/git/commits/{revision}',
        timeout=GITHUB_COMPARE_TIMEOUT_SECONDS,
    )
    commit = commit_lookup.get('json') if isinstance(commit_lookup.get('json'), dict) else {}
    root_tree = commit.get('tree') if isinstance(commit.get('tree'), dict) else {}
    root_tree_sha = root_tree.get('sha') if isinstance(root_tree.get('sha'), str) else None
    if not commit_lookup.get('ok') or not root_tree_sha:
        return {
            'ok': False,
            'error': commit_lookup.get('error') or 'GitHub commit response did not include a tree SHA',
            'lookup': slim_http(commit_lookup),
        }

    tree_lookup = http_get(
        f'https://api.github.com/repos/{REPO}/git/trees/{root_tree_sha}?recursive=1',
        timeout=GITHUB_COMPARE_TIMEOUT_SECONDS,
    )
    payload = tree_lookup.get('json') if isinstance(tree_lookup.get('json'), dict) else {}
    entries = payload.get('tree') if isinstance(payload.get('tree'), list) else None
    if not tree_lookup.get('ok') or entries is None or payload.get('truncated') is True:
        if payload.get('truncated') is True:
            error = 'GitHub recursive tree response was truncated'
        else:
            error = tree_lookup.get('error') or 'GitHub tree response did not include entries'
        return {'ok': False, 'error': error, 'lookup': slim_http(tree_lookup)}

    api_tree: str | None = None
    runtime_entries: dict[str, str] = {}
    for item in entries:
        if not isinstance(item, dict):
            continue
        path = item.get('path')
        sha = item.get('sha')
        item_type = item.get('type')
        if path == 'apps/api' and item_type == 'tree' and isinstance(sha, str):
            api_tree = sha
        if (
            item_type == 'blob'
            and isinstance(path, str)
            and isinstance(sha, str)
            and is_api_runtime_path(path)
        ):
            runtime_entries[path] = sha

    return {
        'ok': True,
        'error': None,
        'api_tree': api_tree,
        'runtime_entries': runtime_entries,
        'lookup': slim_http(tree_lookup),
    }


def resolve_api_runtime_snapshot_drift(deployed_revision: str, main_revision: str) -> dict[str, Any]:
    deployed = collect_api_runtime_snapshot(deployed_revision)
    if not deployed.get('ok'):
        return {'ok': False, 'error': f"deployed snapshot: {deployed.get('error') or 'unknown error'}"}
    current = collect_api_runtime_snapshot(main_revision)
    if not current.get('ok'):
        return {'ok': False, 'error': f"main snapshot: {current.get('error') or 'unknown error'}"}

    deployed_entries = deployed.get('runtime_entries') or {}
    current_entries = current.get('runtime_entries') or {}
    changed = sorted(
        path
        for path in set(deployed_entries) | set(current_entries)
        if deployed_entries.get(path) != current_entries.get(path)
    )
    return {
        'ok': True,
        'error': None,
        'main_tree': current.get('api_tree'),
        'runtime_changed_files': changed,
    }

def api_deploy_freshness(
    known: bool,
    pending: bool,
    latest_main: dict[str, Any] | None,
) -> dict[str, Any]:
    """Read-only triage: a green GitHub build never implies Oracle API deploy.

    The timestamp describes the *CI run*, not an attempted Oracle deployment.
    Aging drift means an operator should review the manual deploy; it cannot
    establish that a deployment is stuck.
    """
    age: float | None = None
    if not known:
        state = 'unknown'
    elif not pending:
        state = 'up_to_date'
    elif not latest_main or latest_main.get('status') != 'completed':
        state = 'awaiting_main_ci'
    elif latest_main.get('conclusion') != 'success':
        state = 'main_ci_not_green'
    else:
        age = timestamp_age_seconds(
            latest_main.get('updated_at') or latest_main.get('created_at')
        )
        if age is None or age < -MAX_FUTURE_SKEW_SECONDS:
            state = 'pending_age_unknown'
            age = None
        elif age < API_DEPLOY_REVIEW_AFTER_SECONDS:
            state = 'recent_runtime_drift'
        else:
            state = 'manual_deploy_review'

    return {
        'state': state,
        'ci_age_seconds': round(max(0.0, age)) if age is not None else None,
        'review_required': state == 'manual_deploy_review',
        'ci_is_not_api_deploy': True,
    }


def collect_api_deployment(latest_main: dict[str, Any] | None) -> dict[str, Any]:
    main_sha = latest_main.get('head_sha') if latest_main else None
    deployed_revision = read_optional_marker(DEPLOYED_API_REVISION_FILE)
    deployed_tree = read_optional_marker(DEPLOYED_API_TREE_FILE)
    main_tree: str | None = None
    runtime_changed_files: list[str] = []
    error: str | None = None
    lookup: dict[str, Any] | None = None
    known = False
    pending = False

    if isinstance(main_sha, str) and main_sha and deployed_revision:
        if main_sha == deployed_revision:
            known = True
        else:
            lookup = http_get(
                f'https://api.github.com/repos/{REPO}/compare/{deployed_revision}...{main_sha}?per_page=1&page=1',
                timeout=GITHUB_COMPARE_TIMEOUT_SECONDS,
            )
            comparison = lookup.get('json') if isinstance(lookup.get('json'), dict) else {}
            status = comparison.get('status')
            files = comparison.get('files') if isinstance(comparison.get('files'), list) else None
            if not lookup.get('ok') or files is None:
                compare_error = lookup.get('error') or 'GitHub compare response did not include changed files'
                lookup_status = lookup.get('status')
                fallback_allowed = (
                    lookup.get('ok') is True
                    or lookup_status is None
                    or (isinstance(lookup_status, int) and lookup_status >= 500)
                )
                if fallback_allowed:
                    snapshot = resolve_api_runtime_snapshot_drift(deployed_revision, main_sha)
                    if snapshot.get('ok'):
                        runtime_changed_files = snapshot.get('runtime_changed_files') or []
                        main_tree = snapshot.get('main_tree')
                        known = True
                        pending = bool(runtime_changed_files)
                    else:
                        fallback_error = snapshot.get('error') or 'unknown runtime snapshot error'
                        error = f'{compare_error}; runtime snapshot fallback failed: {fallback_error}'
                else:
                    error = compare_error
            elif status == 'identical':
                known = True
            elif status != 'ahead':
                error = f'API deployed revision is not an ancestor of main (compare status: {status or "unknown"})'
            else:
                filenames = [
                    item.get('filename')
                    for item in files
                    if isinstance(item, dict) and isinstance(item.get('filename'), str)
                ]
                runtime_changed_files = sorted(
                    path for path in filenames if is_api_runtime_path(path)
                )
                compare_truncated = len(files) >= GITHUB_COMPARE_FILE_LIMIT
                if runtime_changed_files:
                    known = True
                    pending = True
                elif compare_truncated:
                    error = (
                        'GitHub compare returned the maximum file count without an API runtime change; '
                        'deployment state is ambiguous'
                    )
                else:
                    known = True
    elif not deployed_revision:
        error = 'deployed API revision marker is missing'

    freshness = api_deploy_freshness(known, pending, latest_main)
    return {
        'main_revision': main_sha,
        'main_tree': main_tree,
        'deployed_revision': deployed_revision,
        'deployed_tree': deployed_tree,
        'runtime_changed_files': runtime_changed_files,
        'known': known,
        'pending': pending,
        'error': error,
        'lookup': slim_http(lookup) if lookup else None,
        'freshness': freshness,
    }


def cached_github_rate_limit_reset(previous: dict[str, Any] | None) -> int | None:
    """Honor a prior anonymous quota reset instead of polling before GitHub allows it."""
    if os.environ.get('HAVA81_GITHUB_TOKEN', '').strip() or not isinstance(previous, dict):
        return None
    github = previous.get('github') if isinstance(previous.get('github'), dict) else {}
    if github.get('auth_mode') != 'anonymous' or str(github.get('rate_limit_remaining')) != '0':
        return None
    try:
        reset_epoch = int(github.get('rate_limit_reset'))
    except (TypeError, ValueError):
        return None
    return reset_epoch if reset_epoch > int(datetime.now(timezone.utc).timestamp()) else None


def collect_github(previous: dict[str, Any] | None = None) -> dict[str, Any]:
    cached_reset = cached_github_rate_limit_reset(previous)
    if cached_reset is not None:
        # The previous snapshot already recorded exhausted anonymous quota. Do
        # not poll any GitHub endpoint until its reset time; remain fail-closed.
        pulls_result = {
            'ok': False,
            'status': 403,
            'elapsed_ms': 0,
            'headers': {
                'x-ratelimit-remaining': '0',
                'x-ratelimit-reset': str(cached_reset),
            },
            'json': None,
            'error': f'GitHub API rate limit exhausted (reset epoch {cached_reset})',
        }
    else:
        pulls_result = http_get(f'https://api.github.com/repos/{REPO}/pulls?state=open&per_page=30')
    pulls_headers = pulls_result.get('headers') or {}
    pulls_rate_limited = (
        not pulls_result.get('ok')
        and str(pulls_headers.get('x-ratelimit-remaining')) == '0'
    )
    if pulls_rate_limited:
        # GitHub explicitly asks clients not to retry while the primary quota is
        # exhausted. Do not spend a second request on Actions after the first
        # endpoint has already reported remaining=0; synthesize the same
        # fail-closed transport state so downstream readiness remains unknown.
        runs_result = {
            'ok': False,
            'status': pulls_result.get('status'),
            'elapsed_ms': 0,
            'headers': pulls_headers,
            'json': None,
            'error': pulls_result.get('error') or 'GitHub API rate limit exhausted',
        }
    else:
        runs_result = http_get(
            f'https://api.github.com/repos/{REPO}/actions/runs?per_page=100',
            timeout=GITHUB_RUNS_TIMEOUT_SECONDS,
        )
    runs_status = runs_result.get('status')
    should_retry_runs = (
        not runs_result.get('ok')
        and (runs_status is None or (isinstance(runs_status, int) and 500 <= runs_status < 600))
    )
    if should_retry_runs:
        # The 100-run response is occasionally slow enough to exceed the observer's
        # bounded timeout. Retry once with a materially smaller payload for transport/5xx
        # failures, but do not spend a second request on deterministic 4xx responses such
        # as GitHub's anonymous rate-limit 403.
        runs_result = http_get(
            f'https://api.github.com/repos/{REPO}/actions/runs?per_page={GITHUB_RUNS_FALLBACK_PAGE_SIZE}',
            timeout=GITHUB_RUNS_TIMEOUT_SECONDS,
        )
    # Read the actual branch ref separately from Actions. The newest successful
    # workflow can lag the branch head (for example, immediately after a merge or
    # when a push run has not been created yet); it is not a source of truth for
    # the current main revision.
    main_branch_result = (
        http_get(f'https://api.github.com/repos/{REPO}/branches/main')
        if runs_result.get('ok')
        else {'ok': False, 'status': runs_result.get('status'), 'error': runs_result.get('error'), 'headers': {}, 'json': None}
    )
    main_branch_json = main_branch_result.get('json') if isinstance(main_branch_result.get('json'), dict) else {}
    main_commit = main_branch_json.get('commit') if isinstance(main_branch_json.get('commit'), dict) else {}
    main_sha = main_commit.get('sha')
    main_commit_details = main_commit.get('commit') if isinstance(main_commit.get('commit'), dict) else {}
    main_committer = main_commit_details.get('committer') if isinstance(main_commit_details.get('committer'), dict) else {}
    main_branch_known = bool(main_branch_result.get('ok') is True and isinstance(main_sha, str) and main_sha)
    main_branch = {
        'sha': main_sha if main_branch_known else None,
        'known': main_branch_known,
        'commit_date': main_committer.get('date'),
    }

    pulls_data = pulls_result.get('json') if isinstance(pulls_result.get('json'), list) else []
    runs_json = runs_result.get('json') if isinstance(runs_result.get('json'), dict) else {}
    runs_data = runs_json.get('workflow_runs') if isinstance(runs_json.get('workflow_runs'), list) else []

    ci_runs_by_sha: dict[str, dict[str, Any]] = {}
    codeql_runs_by_sha: dict[str, dict[str, Any]] = {}
    ops_runs_by_sha: dict[str, dict[str, Any]] = {}
    for run in runs_data:
        sha = run.get('head_sha')
        if not sha:
            continue
        if run.get('name') == 'CI/CD Pipeline' and sha not in ci_runs_by_sha:
            ci_runs_by_sha[sha] = run
        elif run.get('name') == 'CodeQL' and sha not in codeql_runs_by_sha:
            codeql_runs_by_sha[sha] = run
        elif run.get('name') == 'Ops script contracts' and sha not in ops_runs_by_sha:
            ops_runs_by_sha[sha] = run

    main_candidates = [
        run
        for run in runs_data
        if run.get('head_branch') == 'main' and run.get('event') in ('push', 'workflow_dispatch')
    ]
    main_pipeline_candidates = [run for run in main_candidates if run.get('name') == 'CI/CD Pipeline']
    current_main_pipeline = next(
        (run for run in main_pipeline_candidates if main_branch_known and run.get('head_sha') == main_sha),
        None,
    )
    # Keep a useful latest-run snapshot for diagnostics, but make gating depend
    # on a CI/CD run for the *current branch SHA*, never a prior green SHA.
    latest_main: dict[str, Any] | None = current_main_pipeline or (
        main_pipeline_candidates[0] if main_pipeline_candidates else None
    )
    main_pipeline_pending = bool(
        not main_branch_known
        or current_main_pipeline is None
        or current_main_pipeline.get('status') != 'completed'
    )
    main_pipeline_failed = bool(
        current_main_pipeline
        and current_main_pipeline.get('status') == 'completed'
        and current_main_pipeline.get('conclusion') != 'success'
    )
    main_context: dict[str, Any] | None = None
    if main_branch_known:
        main_context = dict(current_main_pipeline or latest_main or {})
        main_context['head_sha'] = main_sha
        if current_main_pipeline is None:
            # Prevent a prior run's success/timestamp from being mistaken for
            # validation of the current commit. API runtime drift remains
            # comparable to the real branch head, but its CI age is unknown.
            main_context['status'] = 'queued'
            main_context['conclusion'] = None
            main_context['updated_at'] = None
            main_context['created_at'] = None

    def failed_ci_job_names(run: dict[str, Any]) -> list[str]:
        run_id = run.get('id')
        if (
            not run_id
            or run.get('status') != 'completed'
            or run.get('conclusion') in (None, 'success')
        ):
            return []
        jobs_result = http_get(
            f'https://api.github.com/repos/{REPO}/actions/runs/{run_id}/jobs?per_page=100',
            timeout=GITHUB_RUNS_TIMEOUT_SECONDS,
        )
        jobs_json = jobs_result.get('json') if isinstance(jobs_result.get('json'), dict) else {}
        jobs = jobs_json.get('jobs') if isinstance(jobs_json.get('jobs'), list) else []
        ignored = {None, 'success', 'skipped', 'neutral'}
        return [
            str(job.get('name'))
            for job in jobs
            if job.get('name') and job.get('status') == 'completed' and job.get('conclusion') not in ignored
        ][:8]

    automation_prs: list[dict[str, Any]] = []
    for pr in pulls_data:
        head = pr.get('head') if isinstance(pr.get('head'), dict) else {}
        ref = head.get('ref') or ''
        if not ref.startswith('automation/hava81-'):
            continue
        sha = head.get('sha')
        ci_run = ci_runs_by_sha.get(sha, {})
        codeql_run = codeql_runs_by_sha.get(sha, {})
        ops_run = ops_runs_by_sha.get(sha, {})
        base = pr.get('base') if isinstance(pr.get('base'), dict) else {}
        automation_prs.append({
            'number': pr.get('number'),
            'title': pr.get('title'),
            'url': pr.get('html_url'),
            'head_ref': ref,
            'head_sha': sha,
            'base_ref': base.get('ref'),
            'base_sha': base.get('sha'),
            'draft': pr.get('draft'),
            'ci': {
                'run_id': ci_run.get('id'),
                'run_number': ci_run.get('run_number'),
                'status': ci_run.get('status'),
                'conclusion': ci_run.get('conclusion'),
                'url': ci_run.get('html_url'),
                'failed_jobs': failed_ci_job_names(ci_run),
            },
            'ops': {
                'run_id': ops_run.get('id'),
                'run_number': ops_run.get('run_number'),
                'status': ops_run.get('status'),
                'conclusion': ops_run.get('conclusion'),
                'url': ops_run.get('html_url'),
            },
            'codeql': {
                'run_id': codeql_run.get('id'),
                'run_number': codeql_run.get('run_number'),
                'status': codeql_run.get('status'),
                'conclusion': codeql_run.get('conclusion'),
                'url': codeql_run.get('html_url'),
            },
            'checks_collected_at': None,
        })

    # The latest 100 Actions runs can omit an older but still-open PR's exact
    # head checks because every PR produces CI/CD, Ops and CodeQL runs. Reuse a
    # recent exact-SHA snapshot for at most 15 minutes; otherwise do one bounded
    # head-SHA lookup per observer cycle. This avoids spending one GitHub request
    # every five minutes on the same older open PR while keeping unknown checks
    # fail-closed when no trustworthy result is available.
    previous_github = previous.get('github') if isinstance(previous, dict) else None
    previous_prs = previous_github.get('open_automation_prs') if isinstance(previous_github, dict) else None
    previous_by_number = {
        item.get('number'): item
        for item in (previous_prs if isinstance(previous_prs, list) else [])
        if isinstance(item, dict) and item.get('number') is not None
    }
    gate_keys = ('ci', 'ops', 'codeql')
    for pr in automation_prs:
        prior = previous_by_number.get(pr.get('number'))
        prior_age = timestamp_age_seconds(prior.get('checks_collected_at')) if isinstance(prior, dict) else None
        prior_gates = [prior.get(key) if isinstance(prior, dict) else None for key in gate_keys]
        prior_complete = (
            isinstance(prior, dict)
            and prior.get('head_sha') == pr.get('head_sha')
            and prior_age is not None
            and 0 <= prior_age <= PR_CHECK_CACHE_SECONDS
            and all(
                isinstance(gate, dict)
                and gate.get('run_id') is not None
                and gate.get('status') == 'completed'
                and gate.get('conclusion') is not None
                for gate in prior_gates
            )
        )
        if prior_complete:
            for key in gate_keys:
                if pr[key].get('run_id') is None:
                    pr[key] = prior[key]
            if all(pr[key].get('run_id') is not None for key in gate_keys):
                pr['checks_collected_at'] = prior.get('checks_collected_at')
        elif all(pr[key].get('run_id') is not None for key in gate_keys):
            pr['checks_collected_at'] = now_iso()

    missing_check_prs = [
        pr for pr in automation_prs
        if any(pr[key].get('run_id') is None for key in gate_keys)
    ]
    rate_headers_for_lookup = runs_result.get('headers') or {}
    remaining_raw = rate_headers_for_lookup.get('x-ratelimit-remaining')
    if remaining_raw is None:
        remaining_raw = (pulls_result.get('headers') or {}).get('x-ratelimit-remaining')
    try:
        remaining_for_lookup = int(remaining_raw) if remaining_raw is not None else None
    except (TypeError, ValueError):
        remaining_for_lookup = None
    can_lookup_missing_head = remaining_for_lookup is None or remaining_for_lookup > 5
    targeted_lookup_headers: dict[str, Any] | None = None
    if (
        previous is not None
        and pulls_result.get('ok') is True
        and runs_result.get('ok') is True
        and missing_check_prs
        and can_lookup_missing_head
    ):
        # Pull requests are returned newest-updated first; prioritize the oldest
        # still-open automation PR whose exact-head gates fell outside page one.
        target_pr = missing_check_prs[-1]
        target_sha = target_pr.get('head_sha')
        targeted = http_get(
            f'https://api.github.com/repos/{REPO}/actions/runs?head_sha={target_sha}&per_page=100',
            timeout=GITHUB_RUNS_TIMEOUT_SECONDS,
        )
        targeted_lookup_headers = targeted.get('headers') or None
        targeted_json = targeted.get('json') if isinstance(targeted.get('json'), dict) else {}
        targeted_runs = targeted_json.get('workflow_runs') if isinstance(targeted_json.get('workflow_runs'), list) else []
        latest_targeted_by_name: dict[str, dict[str, Any]] = {}
        for run in targeted_runs:
            if run.get('head_sha') != target_sha:
                continue
            name = run.get('name')
            if name in ('CI/CD Pipeline', 'Ops script contracts', 'CodeQL') and name not in latest_targeted_by_name:
                latest_targeted_by_name[name] = run
        for workflow_name, key in (
            ('CI/CD Pipeline', 'ci'),
            ('Ops script contracts', 'ops'),
            ('CodeQL', 'codeql'),
        ):
            run = latest_targeted_by_name.get(workflow_name)
            if run is None:
                continue
            target_pr[key] = {
                'run_id': run.get('id'),
                'run_number': run.get('run_number'),
                'status': run.get('status'),
                'conclusion': run.get('conclusion'),
                'url': run.get('html_url'),
                'failed_jobs': failed_ci_job_names(run) if key == 'ci' else [],
            }
        if all(target_pr[key].get('run_id') is not None for key in gate_keys):
            target_pr['checks_collected_at'] = now_iso()

    def slim_run(run: dict[str, Any] | None) -> dict[str, Any] | None:
        if not run:
            return None
        return {
            'run_id': run.get('id'),
            'run_number': run.get('run_number'),
            'head_sha': run.get('head_sha'),
            'status': run.get('status'),
            'conclusion': run.get('conclusion'),
            'url': run.get('html_url'),
            'created_at': run.get('created_at'),
            'updated_at': run.get('updated_at'),
        }

    pending_statuses = {'queued', 'in_progress', 'waiting', 'pending'}

    def pr_gate_state(pr: dict[str, Any]) -> str:
        # A green product pipeline and CodeQL are not enough: the separate Ops
        # workflow owns observer/deploy-shell contract tests and must finish too.
        gates = [pr['ci'], pr['ops'], pr['codeql']]
        if any(
            gate['status'] == 'completed' and gate['conclusion'] not in (None, 'success')
            for gate in gates
        ):
            return 'failed'
        if all(gate['status'] == 'completed' and gate['conclusion'] == 'success' for gate in gates):
            return 'green'
        if any(gate['run_id'] is None for gate in gates):
            return 'unknown'
        if any(gate['status'] in pending_statuses for gate in gates):
            return 'running'
        return 'unknown'

    gate_states = {pr['number']: pr_gate_state(pr) for pr in automation_prs}
    ci_green = [number for number, state in gate_states.items() if state == 'green']
    ci_failed = [number for number, state in gate_states.items() if state == 'failed']
    ci_running = [number for number, state in gate_states.items() if state == 'running']
    ci_unknown = [number for number, state in gate_states.items() if state == 'unknown']
    # This is a bounded candidate signal, not an instruction to merge. The
    # checks are keyed to each PR's exact head SHA; the operator must still
    # query current mergeability, review state and changed-file scope before
    # any GitHub write. Drafts and PRs targeting another base are not candidates.
    ci_merge_candidates = [
        pr['number']
        for pr in automation_prs
        if gate_states.get(pr.get('number')) == 'green'
        and pr.get('draft') is not True
        and pr.get('base_ref') == 'main'
    ]
    api_deployment = collect_api_deployment(main_context)

    rate_headers = targeted_lookup_headers or runs_result.get('headers') or pulls_result.get('headers') or {}
    github_ok = bool(pulls_result.get('ok') and runs_result.get('ok') and main_branch_known)
    github_error = pulls_result.get('error') or runs_result.get('error') or main_branch_result.get('error')
    if not github_error and not main_branch_known:
        github_error = 'main branch SHA unavailable'
    return {
        'ok': github_ok,
        'error': github_error,
        'auth_mode': 'token' if os.environ.get('HAVA81_GITHUB_TOKEN', '').strip() else 'anonymous',
        'rate_limit_remaining': rate_headers.get('x-ratelimit-remaining'),
        'rate_limit_reset': rate_headers.get('x-ratelimit-reset'),
        'open_automation_prs': automation_prs,
        'main_branch': main_branch,
        'main_pipeline': slim_run(current_main_pipeline),
        'latest_main_run': slim_run(latest_main),
        'api_deployment': api_deployment,
        'signals': {
            'ci_green_prs': ci_green,
            'ci_merge_candidates': ci_merge_candidates,
            'ci_failed_prs': ci_failed,
            'ci_running_prs': ci_running,
            'ci_unknown_prs': ci_unknown,
            'main_pipeline_pending': main_pipeline_pending,
            'main_pipeline_failed': main_pipeline_failed,
            'main_pipeline_unknown': not main_branch_known,
            'api_deploy_pending': api_deployment['pending'],
            'api_deploy_unknown': not api_deployment['known'],
        },
    }


def frontend_deployment_state(frontend_revision: dict[str, Any], main_branch: dict[str, Any] | None) -> dict[str, Any]:
    # Prefer the authoritative current branch ref. `head_sha` remains accepted
    # for older callers/tests, but production status must not compare against an
    # arbitrarily older successful Actions run.
    main_revision = None
    if isinstance(main_branch, dict):
        main_revision = main_branch.get('sha') or main_branch.get('head_sha')
    known = frontend_revision.get('known') is True
    consistent = frontend_revision.get('consistent') is True
    deployed_revision = frontend_revision.get('root') if known and consistent else None
    comparable = isinstance(main_revision, str) and bool(main_revision) and isinstance(deployed_revision, str)
    matches_main = bool(comparable and deployed_revision == main_revision)
    return {
        'main_revision': main_revision,
        'matches_main': matches_main,
        'pending': bool(comparable and not matches_main),
    }


def merge_readiness(github: dict[str, Any]) -> dict[str, Any]:
    """Report whether a non-draft, exact-head-green automation PR is a candidate.

    This signal intentionally does not depend on production health, deployment
    propagation, API port, or host disk. It is not merge authorization: before
    a GitHub write, the caller must re-read the PR head and base, verify current
    mergeability/review state and all required checks, and classify changed-file
    scope. Those checks can change between observer snapshots.
    """
    reasons: list[str] = []
    github_signals = github.get('signals') or {}
    if github.get('ok') is not True:
        reasons.append('github_state_unknown')
    elif not github_signals.get('ci_merge_candidates'):
        reasons.append('no_green_merge_candidate')
    return {'ok': not reasons, 'blocking_reasons': reasons}


def frontend_deploy_readiness(
    production: dict[str, Any],
    github: dict[str, Any],
    frontend_revision: dict[str, Any],
) -> dict[str, Any]:
    """Pages rollout readiness, independent of Oracle host disk pressure."""
    reasons: list[str] = []
    github_signals = github.get('signals') or {}
    nginx = production.get('nginx') or {}

    if production.get('healthy') is not True:
        reasons.append('production_unhealthy')
    if github.get('ok') is not True:
        reasons.append('github_state_unknown')
    if frontend_revision.get('pending') is True:
        reasons.append('frontend_deploy_pending')
    if nginx.get('preferred_ok') is False:
        reasons.append('api_primary_port_drift')
    elif nginx.get('preferred_ok') is not True:
        reasons.append('api_primary_port_unknown')
    if github_signals.get('main_pipeline_pending') is True:
        reasons.append('main_pipeline_pending')
    if github_signals.get('main_pipeline_failed') is True:
        reasons.append('main_pipeline_failed')
    if github_signals.get('main_pipeline_unknown') is True:
        reasons.append('main_pipeline_unknown')
    if github_signals.get('api_deploy_pending') is True:
        reasons.append('api_deploy_pending')
    if github_signals.get('api_deploy_unknown') is True:
        reasons.append('api_deploy_unknown')

    return {'ok': not reasons, 'blocking_reasons': reasons}


def api_deploy_readiness(
    production: dict[str, Any],
    host: dict[str, Any],
    github: dict[str, Any],
    frontend_revision: dict[str, Any],
) -> dict[str, Any]:
    """Server-side API deployment readiness, including host and build reserve."""
    base = frontend_deploy_readiness(production, github, frontend_revision)
    reasons = list(base['blocking_reasons'])
    disk = host.get('disk') or {}
    if host.get('healthy') is not True or disk.get('ok') is not True:
        reasons.append('host_unhealthy')
    if disk.get('api_build_headroom_ok') is not True:
        reasons.append('api_build_headroom_low')
    return {'ok': not reasons, 'blocking_reasons': reasons}


def merge_deploy_readiness(
    production: dict[str, Any],
    host: dict[str, Any],
    github: dict[str, Any],
    frontend_revision: dict[str, Any],
) -> dict[str, Any]:
    """Backward-compatible conservative aggregate for older worker versions.

    New callers should use merge_readiness for GitHub PR candidates,
    frontend_deploy_readiness for Pages, and api_deploy_readiness for Oracle.
    """
    return api_deploy_readiness(production, host, github, frontend_revision)


def state_signature(state: dict[str, Any]) -> dict[str, Any]:
    github = state.get('github') or {}
    production = state.get('production') or {}
    host = state.get('host') or {}
    worker = state.get('worker') or {}
    prs = github.get('open_automation_prs') or []
    return {
        'production_healthy': production.get('healthy'),
        'production_issues': production.get('issues'),
        'nginx_port': ((production.get('nginx') or {}).get('port')),
        'nginx_preferred_ok': ((production.get('nginx') or {}).get('preferred_ok')),
        'host_disk_ok': ((host.get('disk') or {}).get('ok')),
        'host_disk_pressure_warning': ((host.get('disk') or {}).get('pressure_warning')),
        'api_build_headroom_ok': ((host.get('disk') or {}).get('api_build_headroom_ok')),
        'worker_readiness': {
            key: worker.get(key)
            for key in (
                'can_merge', 'merge_blocking_reasons',
                'can_deploy_frontend', 'frontend_deploy_blocking_reasons',
                'can_deploy_api', 'api_deploy_blocking_reasons',
                'can_merge_or_deploy', 'merge_deploy_blocking_reasons',
            )
        },
        'ci_merge_candidates': ((github.get('signals') or {}).get('ci_merge_candidates')),
        'stale_hava81_browser_processes': ((host.get('browser_processes') or {}).get('stale_count')),
        'prs': [
            {
                'number': pr.get('number'),
                'sha': pr.get('head_sha'),
                'status': (pr.get('ci') or {}).get('status'),
                'conclusion': (pr.get('ci') or {}).get('conclusion'),
            }
            for pr in prs
        ],
        'main': github.get('latest_main_run'),
        'main_branch': github.get('main_branch'),
        'main_pipeline': github.get('main_pipeline'),
        'frontend_revision': {
            key: (production.get('frontend_revision') or {}).get(key)
            for key in ('root', 'city', 'english_city', 'known', 'consistent', 'main_revision', 'matches_main', 'pending')
        },
        'api_deployment': {
            key: (github.get('api_deployment') or {}).get(key)
            for key in (
                'main_revision',
                'main_tree',
                'runtime_changed_files',
                'deployed_revision',
                'deployed_tree',
                'known',
                'pending',
                'error',
            )
        } | {
            'freshness': {
                key: ((github.get('api_deployment') or {}).get('freshness') or {}).get(key)
                for key in ('state', 'review_required')
            }
        },
    }


def load_previous() -> dict[str, Any] | None:
    try:
        return json.loads(STATE_FILE.read_text(encoding='utf-8'))
    except Exception:
        return None


def atomic_write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix=f'.{path.name}.', dir=str(path.parent), text=True)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2, sort_keys=True)
            handle.write('\n')
            handle.flush()
            os.fsync(handle.fileno())
        os.chmod(temp_name, 0o644)
        os.replace(temp_name, path)
    finally:
        try:
            os.unlink(temp_name)
        except FileNotFoundError:
            pass


def append_jsonl(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('a', encoding='utf-8') as handle:
        handle.write(json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + '\n')
    try:
        if path.stat().st_size > 10 * 1024 * 1024:
            data = path.read_bytes()
            tail = data[-5 * 1024 * 1024:]
            newline = tail.find(b'\n')
            path.write_bytes(tail[newline + 1:] if newline >= 0 else tail)
    except OSError:
        pass


def main() -> int:
    started = time.monotonic()
    previous = load_previous()
    collected_at = now_iso()
    production = collect_production()
    host = collect_host()
    github = collect_github(previous)
    frontend_revision = production.get('frontend_revision') or {}
    frontend_revision.update(frontend_deployment_state(frontend_revision, github.get('main_branch')))
    production['frontend_revision'] = frontend_revision
    merge_ready = merge_readiness(github)
    frontend_deploy_ready = frontend_deploy_readiness(production, github, frontend_revision)
    api_deploy_ready = api_deploy_readiness(production, host, github, frontend_revision)
    merge_deploy = merge_deploy_readiness(production, host, github, frontend_revision)
    state = {
        'schema_version': 1,
        'collected_at': collected_at,
        'production': production,
        'host': host,
        'github': github,
        'signals': {
            'production_incident': not production['healthy'],
            'host_incident': not host['healthy'],
            'frontend_deploy_pending': frontend_revision.get('pending') is True,
            'api_primary_port_drift': (production.get('nginx') or {}).get('preferred_ok') is False,
            **github.get('signals', {}),
        },
        'worker': {
            'mode': 'read-only-observer',
            'writes_repository': False,
            'can_merge': merge_ready['ok'],
            'merge_blocking_reasons': merge_ready['blocking_reasons'],
            'can_deploy_frontend': frontend_deploy_ready['ok'],
            'frontend_deploy_blocking_reasons': frontend_deploy_ready['blocking_reasons'],
            'can_deploy_api': api_deploy_ready['ok'],
            'api_deploy_blocking_reasons': api_deploy_ready['blocking_reasons'],
            'can_merge_or_deploy': merge_deploy['ok'],
            'merge_deploy_blocking_reasons': merge_deploy['blocking_reasons'],
            'duration_ms': round((time.monotonic() - started) * 1000),
        },
    }
    atomic_write_json(STATE_FILE, state)
    append_jsonl(HISTORY_FILE, state)
    if previous is None or state_signature(previous) != state_signature(state):
        append_jsonl(EVENTS_FILE, {
            'at': collected_at,
            'previous': state_signature(previous or {}),
            'current': state_signature(state),
        })
    level = 'OK' if production['healthy'] else 'WARN'
    print(f"{level} collected={collected_at} production_healthy={production['healthy']} disk_ok={host['disk']['ok']} disk_free_gib={host['disk']['free_bytes'] / (1024**3):.1f} open_prs={len(github['open_automation_prs'])} ci_green={github['signals']['ci_green_prs']} merge_candidates={github['signals']['ci_merge_candidates']} ci_running={github['signals']['ci_running_prs']} ci_unknown={github['signals']['ci_unknown_prs']} main_pending={github['signals']['main_pipeline_pending']} api_deploy_pending={github['signals']['api_deploy_pending']} api_deploy_unknown={github['signals']['api_deploy_unknown']}")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
