#!/usr/bin/env python3
"""Prevent accidentally weakening the Hava81 release dependency graph."""
from pathlib import Path
import re

workflow = (Path(__file__).resolve().parent.parent / '.github/workflows/ci.yml').read_text()
parts = re.findall(r'(?ms)^  ([a-z][a-z0-9_-]*):\n(.*?)(?=^  [a-z][a-z0-9_-]*:\n|\Z)', workflow)
jobs = dict(parts)
required = {'quality', 'api', 'build', 'browser', 'lighthouse', 'docker', 'deploy'}
assert required <= jobs.keys(), f'Missing jobs: {required - jobs.keys()}'

def dependencies(job: str) -> set[str]:
    matches = re.findall(r'(?m)^    needs:\s*(\[[^]]*\]|[^\n#]+)\s*$', jobs[job])
    assert len(matches) <= 1, f'{job} has ambiguous needs declaration'
    if not matches:
        return set()
    raw = matches[0].strip().strip('[]')
    return {item.strip() for item in raw.split(',') if item.strip()}

assert not dependencies('build'), 'Build must run in parallel with API/frontend quality'
assert dependencies('browser') == {'build'}, 'Browser tests must test the production build'
assert dependencies('lighthouse') == {'build'}, 'Lighthouse must audit the production build'
assert {'quality', 'api', 'build', 'browser'} <= dependencies('docker'), (
    'Docker publication must wait for passing security, API, build and browser gates'
)
assert {'quality', 'api', 'build', 'browser', 'lighthouse'} <= dependencies('deploy'), (
    'Pages publication must wait for passing security, API, build, browser and Lighthouse gates'
)
for job in ('docker', 'deploy'):
    assert "github.ref == 'refs/heads/main'" in jobs[job], (
        f'{job} must not run on PR branches'
    )
assert 'python3 scripts/test-ci-parallel-build-gates.py' in jobs['quality'], (
    'The quality job must exercise this release-gate contract'
)
print('CI parallel-build and strict publication gates verified')
