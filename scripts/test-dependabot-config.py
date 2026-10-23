#!/usr/bin/env python3
"""Guard Dependabot cooldown fields to ecosystems that actually support them."""
from pathlib import Path
import re

config = Path('.github/dependabot.yml').read_text(encoding='utf-8')
assert re.search(r'(?m)^version: 2\s*$', config), 'Dependabot config must use version 2'
assert re.search(r'(?m)^updates:\s*$', config), 'Dependabot updates list is missing'
entries = re.split(r'(?m)^  - package-ecosystem:\s*', config)[1:]
assert len(entries) >= 5, f'Expected the five configured Dependabot entries, found {len(entries)}'
seen = set()
for entry in entries:
    lines = entry.splitlines()
    ecosystem = lines[0].strip()
    directory_match = re.search(r'(?m)^    directory:\s*(\S+)\s*$', entry)
    assert directory_match, f'Missing directory for {ecosystem} entry'
    directory = directory_match.group(1)
    key = (ecosystem, directory)
    assert key not in seen, f'Duplicate Dependabot ecosystem/directory entry: {key}'
    seen.add(key)
    has_cooldown = bool(re.search(r'(?m)^    cooldown:\s*$', entry))
    has_major_group = bool(re.search(r'(?m)^      majors:\s*$', entry))
    if ecosystem == 'npm':
        assert has_cooldown, f'npm cooldown should remain configured for {directory}'
        assert re.search(r'(?m)^      semver-major-days: 30\s*$', entry), f'npm major cooldown missing for {directory}'
    elif ecosystem in {'github-actions', 'docker'}:
        assert not has_cooldown, f'{ecosystem} does not support Dependabot cooldown ({directory})'
        assert has_major_group, f'{ecosystem} majors must remain grouped for review ({directory})'
    else:
        raise AssertionError(f'Unexpected ecosystem in policy: {ecosystem}')

print('Dependabot config ecosystem compatibility: PASS')
