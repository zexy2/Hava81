#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import pwd
import re
import ssl
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
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
ALLOWED_API_PORTS = {4000, 4001, 4002}
REPO = 'zexy2/Hava81'
MINIMUM_ROOT_FREE_BYTES = 2 * 1024 * 1024 * 1024
MAXIMUM_ROOT_USED_PERCENT = 92.0
ROOT_DISK_WARNING_USED_PERCENT = 85.0
MAX_READY_AGE_SECONDS = 180
MAX_FUTURE_SKEW_SECONDS = 60
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
GITHUB_RUNS_TIMEOUT_SECONDS = 12.0
GITHUB_RUNS_FALLBACK_PAGE_SIZE = 30
HAVA81_BROWSER_STALE_SECONDS = 2 * 60 * 60
MAX_STALE_BROWSER_PROCESSES_REPORTED = 8


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


def http_get(url: str, *, headers: dict[str, str] | None = None, timeout: float = 6.0) -> dict[str, Any]:
    request_headers = {'User-Agent': USER_AGENT, 'Accept': 'application/json,text/html;q=0.9,*/*;q=0.8'}
    if headers:
        request_headers.update(headers)
    req = urllib.request.Request(url, headers=request_headers, method='GET')
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
        return {
            'ok': False,
            'status': exc.code,
            'elapsed_ms': round((time.monotonic() - started) * 1000),
            'headers': {
                'access-control-allow-origin': exc.headers.get('access-control-allow-origin') if exc.headers else None,
                'cache-control': exc.headers.get('cache-control') if exc.headers else None,
                'x-ratelimit-remaining': exc.headers.get('x-ratelimit-remaining') if exc.headers else None,
                'x-ratelimit-reset': exc.headers.get('x-ratelimit-reset') if exc.headers else None,
            },
            'json': None,
            'error': f'HTTP {exc.code}',
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
        return {'port': port, 'expected': expected, 'ok': port == expected, 'error': None}
    except Exception as exc:
        return {'port': None, 'expected': expected, 'ok': False, 'error': f'{type(exc).__name__}: {exc}'}


def slim_http(result: dict[str, Any]) -> dict[str, Any]:
    return {
        'ok': result.get('ok'),
        'status': result.get('status'),
        'elapsed_ms': result.get('elapsed_ms'),
        'error': result.get('error'),
    }


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


def collect_boot_assets(root: dict[str, Any], city: dict[str, Any] | None = None) -> dict[str, Any]:
    root_paths = extract_boot_asset_paths(root.get('text'))
    city_paths = extract_boot_asset_paths(city.get('text')) if city is not None else root_paths
    paths = sorted(set(root_paths) | set(city_paths))
    failed: list[dict[str, Any]] = []
    for path in paths[:32]:
        result = http_get(f'https://hava81.zekiakgul.dev{path}', timeout=4.0)
        if result.get('status') != 200:
            failed.append({'path': path, **slim_http(result)})
    return {
        'ok': bool(root_paths) and bool(city_paths) and not failed and len(paths) <= 32,
        'count': len(paths),
        'root_count': len(root_paths),
        'city_count': len(city_paths),
        'failed': failed,
        'truncated': len(paths) > 32,
    }


def timestamp_age_seconds(value: Any) -> float | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return round((datetime.now(timezone.utc) - parsed.astimezone(timezone.utc)).total_seconds(), 1)
    except ValueError:
        return None


def collect_production() -> dict[str, Any]:
    root = http_get('https://hava81.zekiakgul.dev/')
    city = http_get('https://hava81.zekiakgul.dev/istanbul/')
    ready = http_get(
        'https://api.hava81.zekiakgul.dev/api/v1/health/ready',
        headers={'Origin': 'https://hava81.zekiakgul.dev'},
    )
    boot_assets = collect_boot_assets(root, city)
    root_revision = extract_build_revision(root.get('text'))
    city_revision = extract_build_revision(city.get('text'))
    frontend_revision = {
        'known': root_revision is not None and city_revision is not None,
        'consistent': root_revision is not None and root_revision == city_revision,
        'root': root_revision,
        'city': city_revision,
    }
    ready_json = ready.get('json') if isinstance(ready.get('json'), dict) else {}
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
    }
    issues = [name for name, ok in checks.items() if not ok]
    provider = ready_json.get('provider') if isinstance(ready_json.get('provider'), dict) else {}
    return {
        'healthy': not issues,
        'issues': issues,
        'checks': checks,
        'root': slim_http(root),
        'istanbul': slim_http(city),
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
        'cors': {'allow_origin': cors_value, 'ok': cors_ok},
        'nginx': nginx,
    }


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
            if '/tmp/hava81-' not in args:
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
        if '/tmp/hava81-' not in args:
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
    disk_ok = free_ok and usage_ok
    issues: list[str] = []
    warnings: list[str] = []
    if not free_ok:
        issues.append('root_disk_low')
    if not usage_ok:
        issues.append('root_disk_pressure')
    elif pressure_warning:
        warnings.append('root_disk_pressure_warning')
    if browser_processes['stale_count'] > 0:
        warnings.append('stale_hava81_browser_processes')
    return {
        'disk': {
            'free_bytes': free_bytes,
            'used_bytes': used_bytes,
            'total_bytes': total_bytes,
            'used_percent': used_percent,
            'minimum_free_bytes': MINIMUM_ROOT_FREE_BYTES,
            'maximum_used_percent': MAXIMUM_ROOT_USED_PERCENT,
            'warning_used_percent': ROOT_DISK_WARNING_USED_PERCENT,
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
                f'https://api.github.com/repos/{REPO}/compare/{deployed_revision}...{main_sha}?per_page=1&page=1'
            )
            comparison = lookup.get('json') if isinstance(lookup.get('json'), dict) else {}
            status = comparison.get('status')
            files = comparison.get('files') if isinstance(comparison.get('files'), list) else None
            if not lookup.get('ok') or files is None:
                error = lookup.get('error') or 'GitHub compare response did not include changed files'
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
    }


def collect_github() -> dict[str, Any]:
    pulls_result = http_get(f'https://api.github.com/repos/{REPO}/pulls?state=open&per_page=30')
    runs_result = http_get(
        f'https://api.github.com/repos/{REPO}/actions/runs?per_page=100',
        timeout=GITHUB_RUNS_TIMEOUT_SECONDS,
    )
    if not runs_result.get('ok'):
        # The 100-run response is occasionally slow enough to exceed the observer's
        # bounded timeout. Retry once with a materially smaller payload so a transient
        # GitHub read does not erase otherwise actionable PR/main CI state.
        runs_result = http_get(
            f'https://api.github.com/repos/{REPO}/actions/runs?per_page={GITHUB_RUNS_FALLBACK_PAGE_SIZE}',
            timeout=GITHUB_RUNS_TIMEOUT_SECONDS,
        )
    pulls_data = pulls_result.get('json') if isinstance(pulls_result.get('json'), list) else []
    runs_json = runs_result.get('json') if isinstance(runs_result.get('json'), dict) else {}
    runs_data = runs_json.get('workflow_runs') if isinstance(runs_json.get('workflow_runs'), list) else []

    ci_runs_by_sha: dict[str, dict[str, Any]] = {}
    codeql_runs_by_sha: dict[str, dict[str, Any]] = {}
    for run in runs_data:
        sha = run.get('head_sha')
        if not sha:
            continue
        if run.get('name') == 'CI/CD Pipeline' and sha not in ci_runs_by_sha:
            ci_runs_by_sha[sha] = run
        elif run.get('name') == 'CodeQL' and sha not in codeql_runs_by_sha:
            codeql_runs_by_sha[sha] = run

    latest_main_candidates = [
        run
        for run in runs_data
        if run.get('head_branch') == 'main' and run.get('event') in ('push', 'workflow_dispatch')
    ]
    latest_main: dict[str, Any] | None = None
    if latest_main_candidates:
        latest_main_sha = latest_main_candidates[0].get('head_sha')
        same_sha = [run for run in latest_main_candidates if run.get('head_sha') == latest_main_sha]
        latest_main = next(
            (run for run in same_sha if run.get('name') == 'CI/CD Pipeline'),
            same_sha[0] if same_sha else latest_main_candidates[0],
        )

    automation_prs: list[dict[str, Any]] = []
    for pr in pulls_data:
        head = pr.get('head') if isinstance(pr.get('head'), dict) else {}
        ref = head.get('ref') or ''
        if not ref.startswith('automation/hava81-'):
            continue
        sha = head.get('sha')
        ci_run = ci_runs_by_sha.get(sha, {})
        codeql_run = codeql_runs_by_sha.get(sha, {})
        automation_prs.append({
            'number': pr.get('number'),
            'title': pr.get('title'),
            'url': pr.get('html_url'),
            'head_ref': ref,
            'head_sha': sha,
            'draft': pr.get('draft'),
            'ci': {
                'run_id': ci_run.get('id'),
                'run_number': ci_run.get('run_number'),
                'status': ci_run.get('status'),
                'conclusion': ci_run.get('conclusion'),
                'url': ci_run.get('html_url'),
            },
            'codeql': {
                'run_id': codeql_run.get('id'),
                'run_number': codeql_run.get('run_number'),
                'status': codeql_run.get('status'),
                'conclusion': codeql_run.get('conclusion'),
                'url': codeql_run.get('html_url'),
            },
        })

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
        gates = [pr['ci'], pr['codeql']]
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
    api_deployment = collect_api_deployment(latest_main)

    rate_headers = runs_result.get('headers') or pulls_result.get('headers') or {}
    return {
        'ok': pulls_result.get('ok') and runs_result.get('ok'),
        'error': pulls_result.get('error') or runs_result.get('error'),
        'rate_limit_remaining': rate_headers.get('x-ratelimit-remaining'),
        'open_automation_prs': automation_prs,
        'latest_main_run': slim_run(latest_main),
        'api_deployment': api_deployment,
        'signals': {
            'ci_green_prs': ci_green,
            'ci_failed_prs': ci_failed,
            'ci_running_prs': ci_running,
            'ci_unknown_prs': ci_unknown,
            'main_pipeline_pending': bool(latest_main and latest_main.get('status') != 'completed'),
            'api_deploy_pending': api_deployment['pending'],
            'api_deploy_unknown': not api_deployment['known'],
        },
    }


def frontend_deployment_state(frontend_revision: dict[str, Any], latest_main: dict[str, Any] | None) -> dict[str, Any]:
    main_revision = latest_main.get('head_sha') if isinstance(latest_main, dict) else None
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


def state_signature(state: dict[str, Any]) -> dict[str, Any]:
    github = state.get('github') or {}
    production = state.get('production') or {}
    host = state.get('host') or {}
    prs = github.get('open_automation_prs') or []
    return {
        'production_healthy': production.get('healthy'),
        'production_issues': production.get('issues'),
        'nginx_port': ((production.get('nginx') or {}).get('port')),
        'host_disk_ok': ((host.get('disk') or {}).get('ok')),
        'host_disk_pressure_warning': ((host.get('disk') or {}).get('pressure_warning')),
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
        'frontend_revision': {
            key: (production.get('frontend_revision') or {}).get(key)
            for key in ('root', 'city', 'known', 'consistent', 'main_revision', 'matches_main', 'pending')
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
    github = collect_github()
    frontend_revision = production.get('frontend_revision') or {}
    frontend_revision.update(frontend_deployment_state(frontend_revision, github.get('latest_main_run')))
    production['frontend_revision'] = frontend_revision
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
            **github.get('signals', {}),
        },
        'worker': {
            'mode': 'read-only-observer',
            'writes_repository': False,
            'can_merge_or_deploy': False,
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
    print(f"{level} collected={collected_at} production_healthy={production['healthy']} disk_ok={host['disk']['ok']} disk_free_gib={host['disk']['free_bytes'] / (1024**3):.1f} open_prs={len(github['open_automation_prs'])} ci_green={github['signals']['ci_green_prs']} ci_running={github['signals']['ci_running_prs']} ci_unknown={github['signals']['ci_unknown_prs']} main_pending={github['signals']['main_pipeline_pending']} api_deploy_pending={github['signals']['api_deploy_pending']} api_deploy_unknown={github['signals']['api_deploy_unknown']}")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
