#!/usr/bin/env python3
"""Keep Lighthouse JSON reports available for post-run regression diagnosis."""
from pathlib import Path
import re

workflow_path = Path(".github/workflows/ci.yml")
workflow = workflow_path.read_text(encoding="utf-8")
match = re.search(r"(?ms)^  lighthouse:\n(?P<body>.*?)(?=^  [a-zA-Z0-9_-]+:|\Z)", workflow)
assert match, "Lighthouse job is missing from ci.yml"
job = match.group("body")
build_step = re.search(
    r"(?ms)^      - name: Build Lighthouse variant with same-origin API routing\n"
    r"        run: npm run build\n"
    r"        env:\n"
    r"          VITE_API_BASE_URL: /api/v1\s*$",
    job,
)
assert build_step, "Lighthouse must build a separate same-origin API variant"
assert "actions/download-artifact@v8" not in job, "Lighthouse must not overwrite/use the production dist artifact"
assert "needs: build" in job, "Lighthouse must remain gated on the production build"
assert "HAVA81_PREVIEW_API_PROXY_TARGET=http://127.0.0.1:4000" in job, (
    "Lighthouse must proxy same-origin requests to the local API service"
)
assert "OPENWEATHER_API_KEY: ${{ secrets.OPENWEATHER_API_KEY }}" in job, (
    "Lighthouse must use the repository's real provider credential, never synthetic weather"
)
assert "node apps/api/dist/src/server.js" in job, (
    "Lighthouse must start the locally built API before browser measurement"
)
assert "api/v1/health/ready" in job and "api/v1/weather/current?city=Istanbul" in job, (
    "Lighthouse must wait for API readiness and verify a live current-weather response"
)
assert "npm ci --prefix apps/api --no-audit" in job and "npm run api:build" in job, (
    "The local real-weather API must be installed and built from the checked-out source"
)
assert "refusing a synthetic fallback" in job, (
    "Missing provider credentials must fail closed rather than substitute fabricated weather"
)
assert "unset OPENWEATHER_API_KEY" in job, (
    "The provider credential must not be inherited by the Lighthouse/browser process"
)
vite_config = Path("vite.config.ts").read_text(encoding="utf-8")
assert "HAVA81_PREVIEW_API_PROXY_TARGET || 'http://127.0.0.1:4000'" in vite_config, (
    "Ordinary local preview must keep its local API proxy default"
)
production_build = re.search(
    r"(?ms)^  build:\n(?P<body>.*?)(?=^  [a-zA-Z0-9_-]+:|\Z)", workflow
)
assert production_build and "VITE_API_BASE_URL: ${{ vars.API_BASE_URL }}" in production_build.group("body"), (
    "The deployable production build must retain its configured absolute API origin"
)
runner = Path("scripts/run-lighthouse.mjs").read_text(encoding="utf-8")
assert "withLighthouseWeatherReadinessConfirmation(" in runner, (
    "Lighthouse must retry one failed real-weather readiness measurement without bypassing the gate"
)
assert "assertLighthouseWeatherReady(report)" in runner, (
    "Lighthouse performance confirmation must still reject a report that never loaded current weather"
)
assert "run: node scripts/test-lighthouse-weather-readiness.mjs" in job, (
    "The bounded weather-readiness retry contract must run in CI"
)
assert "run: node scripts/test-live-weather-payload.mjs" in job, (
    "Live provider payload integrity regressions must run in CI"
)
assert 'node scripts/lib/live-weather-payload.mjs "$weather_file"' in job, (
    "The real provider response must pass timestamp, city, provider and freshness validation"
)
run_index = job.find("npm run lighthouse")
assert run_index >= 0, "Lighthouse command is missing from the job"
assert build_step.start() < run_index, "Lighthouse variant must build before measurement"
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
