#!/usr/bin/env python3
import json
from pathlib import Path
p = Path('/var/lib/hava81-worker/state.json')
if not p.exists():
    print('Hava81 worker state not collected yet.')
    raise SystemExit(1)
s = json.loads(p.read_text(encoding='utf-8'))
prod = s.get('production', {})
gh = s.get('github', {})
sig = s.get('signals', {})
print(f"collected_at: {s.get('collected_at')}")
print(f"production: {'HEALTHY' if prod.get('healthy') else 'UNHEALTHY'} issues={prod.get('issues', [])}")
host = s.get('host', {})
disk = host.get('disk') or {}
used_bytes = disk.get('used_bytes')
free_bytes = disk.get('free_bytes')
used_gib = round(used_bytes / (1024 ** 3), 1) if isinstance(used_bytes, (int, float)) else None
free_gib = round(free_bytes / (1024 ** 3), 1) if isinstance(free_bytes, (int, float)) else None
print(f"host_disk: ok={disk.get('ok')} warning={disk.get('pressure_warning', False)} used_pct={disk.get('used_percent')} used_gib={used_gib} free_gib={free_gib} warnings={host.get('warnings', [])}")
print(f"nginx_api_port: {(prod.get('nginx') or {}).get('port')} expected={(prod.get('nginx') or {}).get('expected')}")
boot_assets = prod.get('boot_assets') or {}
print(f"boot_assets: ok={boot_assets.get('ok')} count={boot_assets.get('count')} root={boot_assets.get('root_count')} city={boot_assets.get('city_count')} failed={[item.get('path') for item in boot_assets.get('failed', [])]}")
ready = prod.get('api_ready') or {}
print(f"api_ready: http={ready.get('status')} reported={ready.get('reported_status')} age_s={ready.get('age_seconds')} cache={ready.get('cache_control')} provider={ready.get('provider')} circuit={ready.get('provider_state')}")
print(f"cors: {(prod.get('cors') or {}).get('allow_origin')} ok={(prod.get('cors') or {}).get('ok')}")
for pr in gh.get('open_automation_prs', []):
    ci = pr.get('ci') or {}
    print(f"pr#{pr.get('number')}: {pr.get('head_ref')} sha={str(pr.get('head_sha') or '')[:8]} ci={ci.get('status')}/{ci.get('conclusion')}")
main = gh.get('latest_main_run') or {}
if main:
    print(f"main_ci: run#{main.get('run_number')} sha={str(main.get('head_sha') or '')[:8]} {main.get('status')}/{main.get('conclusion')}")
print(f"signals: green={sig.get('ci_green_prs', [])} running={sig.get('ci_running_prs', [])} unknown={sig.get('ci_unknown_prs', [])} failed={sig.get('ci_failed_prs', [])} production_incident={sig.get('production_incident')}")
