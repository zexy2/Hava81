#!/usr/bin/env python3
"""Keep Lighthouse JSON reports available for post-run regression diagnosis."""
from pathlib import Path
import re

workflow_path = Path(".github/workflows/ci.yml")
workflow = workflow_path.read_text(encoding="utf-8")
match = re.search(r"(?ms)^  lighthouse:\n(?P<body>.*?)(?=^  [a-zA-Z0-9_-]+:|\Z)", workflow)
assert match, "Lighthouse job is missing from ci.yml"
job = match.group("body")
run_index = job.find("- run: npm run lighthouse")
assert run_index >= 0, "Lighthouse command is missing from the job"
artifact_index = job.find("- name: Preserve Lighthouse JSON reports (including failed budgets)")
assert artifact_index > run_index, "Lighthouse reports must upload after the command runs"
artifact = job[artifact_index:]
checks = {
    "always() upload": r"(?m)^\s+if: always\(\)\s*$",
    "artifact action": r"(?m)^\s+uses: actions/upload-artifact@v7\s*$",
    "named artifact": r"(?m)^\s+name: lighthouse-reports\s*$",
    "JSON report glob": r"(?m)^\s+path: \.lighthouse-results/\*.json\s*$",
    "include hidden result directory": r"(?m)^\s+include-hidden-files: true\s*$",
    "missing reports warn without masking the job result": r"(?m)^\s+if-no-files-found: warn\s*$",
    "seven-day retention": r"(?m)^\s+retention-days: 7\s*$",
}
for label, pattern in checks.items():
    assert re.search(pattern, artifact), f"Lighthouse artifact contract missing: {label}"

print("Lighthouse artifact retention contract: PASS")
