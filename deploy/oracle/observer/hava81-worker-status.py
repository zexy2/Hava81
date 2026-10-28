#!/usr/bin/env python3
import json
import socket
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

STATE_FILE = Path('/var/lib/hava81-worker/state.json')
MAX_STATE_AGE_SECONDS = 10 * 60
MAX_FUTURE_SKEW_SECONDS = 60
READINESS_FIELDS = (
    'can_merge',
    'merge_blocking_reasons',
    'can_deploy_frontend',
    'frontend_deploy_blocking_reasons',
    'can_deploy_api',
    'api_deploy_blocking_reasons',
)


def readiness_schema(worker: Any) -> dict[str, Any]:
    """Identify snapshots produced before scoped merge/deploy readiness was added."""
    source = worker if isinstance(worker, dict) else {}
    missing = [field for field in READINESS_FIELDS if field not in source]
    return {'current': not missing, 'missing_fields': missing}


def timestamp_age_seconds(value: Any, *, now: datetime | None = None) -> float | None:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        parsed = datetime.fromisoformat(value.strip().replace('Z', '+00:00'))
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        current = now or datetime.now(timezone.utc)
        if current.tzinfo is None:
            current = current.replace(tzinfo=timezone.utc)
        return (current.astimezone(timezone.utc) - parsed.astimezone(timezone.utc)).total_seconds()
    except (OverflowError, TypeError, ValueError):
        return None


def snapshot_freshness(value: Any, *, now: datetime | None = None) -> dict[str, Any]:
    age_seconds = timestamp_age_seconds(value, now=now)
    if age_seconds is None:
        return {'fresh': False, 'age_seconds': None, 'reason': 'missing_or_invalid_timestamp'}
    if age_seconds < -MAX_FUTURE_SKEW_SECONDS:
        return {'fresh': False, 'age_seconds': round(age_seconds, 1), 'reason': 'future_timestamp'}
    if age_seconds > MAX_STATE_AGE_SECONDS:
        return {'fresh': False, 'age_seconds': round(age_seconds, 1), 'reason': 'stale'}
    return {'fresh': True, 'age_seconds': round(age_seconds, 1), 'reason': 'fresh'}


def main() -> int:
    p = STATE_FILE
    if not p.exists():
        print('Hava81 worker state not collected yet.')
        return 1
    s = json.loads(p.read_text(encoding='utf-8'))
    prod = s.get('production', {})
    gh = s.get('github', {})
    sig = s.get('signals', {})
    worker = s.get('worker', {})
    collected_at = s.get('collected_at')
    freshness = snapshot_freshness(collected_at)
    print(f'collected_at: {collected_at}')
    print(
        'snapshot_freshness: '
        f"fresh={freshness['fresh']} age_s={freshness['age_seconds']} "
        f'max_age_s={MAX_STATE_AGE_SECONDS} future_skew_s={MAX_FUTURE_SKEW_SECONDS} '
        f"reason={freshness['reason']}"
    )
    readiness = readiness_schema(worker)
    readiness_state = 'current' if readiness['current'] else 'legacy_or_incomplete'
    print(f"readiness_schema: state={readiness_state} missing={readiness['missing_fields']}")
    print(f"merge_ready: {worker.get('can_merge')} blockers={worker.get('merge_blocking_reasons', [])}")
    print(f"frontend_deploy_ready: {worker.get('can_deploy_frontend')} blockers={worker.get('frontend_deploy_blocking_reasons', [])}")
    print(f"api_deploy_ready: {worker.get('can_deploy_api')} blockers={worker.get('api_deploy_blocking_reasons', [])}")
    print(f"merge_candidates: {sig.get('ci_merge_candidates', [])}")
    owner_policy = gh.get('owner_policy') if isinstance(gh.get('owner_policy'), dict) else {}
    print(
        f"owner_policy: known={owner_policy.get('known')} mode={owner_policy.get('mode', 'unknown')} "
        f"paused={owner_policy.get('paused')} error={owner_policy.get('error')}"
    )
    print(f"merge_deploy_ready: {worker.get('can_merge_or_deploy')} blockers={worker.get('merge_deploy_blocking_reasons', [])} observer_writes={worker.get('writes_repository')}")
    print(f"production: {'HEALTHY' if prod.get('healthy') else 'UNHEALTHY'} issues={prod.get('issues', [])}")
    host = s.get('host', {})
    print(f"status_process_host: hostname={socket.gethostname()}")
    print(
        f"observer_host: snapshot_hostname={host.get('hostname') or 'unknown'} "
        'disk_scope=observer-host-local'
    )
    disk = host.get('disk') or {}
    used_bytes = disk.get('used_bytes')
    free_bytes = disk.get('free_bytes')
    used_gib = round(used_bytes / (1024 ** 3), 1) if isinstance(used_bytes, (int, float)) else None
    free_gib = round(free_bytes / (1024 ** 3), 1) if isinstance(free_bytes, (int, float)) else None
    bytes_to_free = disk.get('bytes_to_free_for_ok')
    recovery_gib = round(bytes_to_free / (1024 ** 3), 2) if isinstance(bytes_to_free, (int, float)) else None
    recovery_mib = round(bytes_to_free / (1024 ** 2), 1) if isinstance(bytes_to_free, (int, float)) else None
    api_build_bytes_to_free = disk.get('bytes_to_free_for_api_build')
    api_build_recovery_gib = (
        round(api_build_bytes_to_free / (1024 ** 3), 2)
        if isinstance(api_build_bytes_to_free, (int, float))
        else None
    )
    print(
        f"host_disk: ok={disk.get('ok')} warning={disk.get('pressure_warning', False)} "
        f"used_pct={disk.get('used_percent')} used_gib={used_gib} free_gib={free_gib} "
        f"recovery_gib={recovery_gib} recovery_mib={recovery_mib} "
        f"api_build_headroom_ok={disk.get('api_build_headroom_ok')} "
        f'api_build_recovery_gib={api_build_recovery_gib} '
        f"issues={host.get('issues', [])} warnings={host.get('warnings', [])}"
    )
    browser_processes = host.get('browser_processes') or {}
    print(
        f"browser_audits: known={browser_processes.get('known')} "
        f"stale_count={browser_processes.get('stale_count')} "
        f"threshold_s={browser_processes.get('stale_after_seconds')} "
        f"processes={browser_processes.get('processes', [])} error={browser_processes.get('error')}"
    )
    nginx = prod.get('nginx') or {}
    print(f"nginx_api_port: {nginx.get('port')} expected={nginx.get('expected')} preferred={nginx.get('preferred')} preferred_ok={nginx.get('preferred_ok')}")
    boot_assets = prod.get('boot_assets') or {}
    print(f"boot_assets: ok={boot_assets.get('ok')} count={boot_assets.get('count')} root={boot_assets.get('root_count')} city={boot_assets.get('city_count')} english_city={boot_assets.get('english_city_count')} failed={[item.get('path') for item in boot_assets.get('failed', [])]}")
    frontend_revision = prod.get('frontend_revision') or {}
    print(f"frontend_revision: known={frontend_revision.get('known')} consistent={frontend_revision.get('consistent')} root={str(frontend_revision.get('root') or '')[:12]} city={str(frontend_revision.get('city') or '')[:12]} english_city={str(frontend_revision.get('english_city') or '')[:12]} main={str(frontend_revision.get('main_revision') or '')[:12]} matches_main={frontend_revision.get('matches_main')} pending={frontend_revision.get('pending')}")
    ready = prod.get('api_ready') or {}
    print(f"api_ready: http={ready.get('status')} reported={ready.get('reported_status')} age_s={ready.get('age_seconds')} cache={ready.get('cache_control')} provider={ready.get('provider')} circuit={ready.get('provider_state')}")
    print(f"cors: {(prod.get('cors') or {}).get('allow_origin')} ok={(prod.get('cors') or {}).get('ok')}")
    for pr in gh.get('open_automation_prs', []):
        ci = pr.get('ci') or {}
        ops = pr.get('ops') or {}
        codeql = pr.get('codeql') or {}
        print(f"pr#{pr.get('number')}: {pr.get('head_ref')} sha={str(pr.get('head_sha') or '')[:8]} ci={ci.get('status')}/{ci.get('conclusion')} failed_jobs={ci.get('failed_jobs', [])} ops={ops.get('status')}/{ops.get('conclusion')} codeql={codeql.get('status')}/{codeql.get('conclusion')}")
    main_branch = gh.get('main_branch') or {}
    main_pipeline = gh.get('main_pipeline') or {}
    print(f"main_branch: known={main_branch.get('known')} sha={str(main_branch.get('sha') or '')[:12]} commit_date={main_branch.get('commit_date')}")
    if main_pipeline:
        print(f"main_ci_current: run#{main_pipeline.get('run_number')} sha={str(main_pipeline.get('head_sha') or '')[:12]} {main_pipeline.get('status')}/{main_pipeline.get('conclusion')}")
    else:
        print('main_ci_current: no CI/CD run found for the current main SHA')
    auth_mode = gh.get('auth_mode') or 'unknown'
    rate_remaining = gh.get('rate_limit_remaining')
    rate_reset = gh.get('rate_limit_reset')
    print(
        f"github_api: auth_mode={auth_mode} "
        f"rate_limit_remaining={rate_remaining if rate_remaining is not None else 'unknown'} "
        f"reset_epoch={rate_reset or 'unknown'}"
    )
    if auth_mode == 'anonymous' and str(rate_remaining) == '0':
        print(
            'github_api_action: configure the documented repository-scoped read-only token '
            'in /etc/hava81-worker/github.env; do not reuse a broad interactive token'
        )
    main = gh.get('latest_main_run') or {}
    if main:
        print(f"main_ci_latest: run#{main.get('run_number')} sha={str(main.get('head_sha') or '')[:12]} {main.get('status')}/{main.get('conclusion')}")
    print(f"signals: green={sig.get('ci_green_prs', [])} running={sig.get('ci_running_prs', [])} unknown={sig.get('ci_unknown_prs', [])} failed={sig.get('ci_failed_prs', [])} main_pipeline_pending={sig.get('main_pipeline_pending')} main_pipeline_failed={sig.get('main_pipeline_failed')} main_pipeline_unknown={sig.get('main_pipeline_unknown')} host_incident={sig.get('host_incident')} production_incident={sig.get('production_incident')} api_primary_port_drift={sig.get('api_primary_port_drift')}")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
