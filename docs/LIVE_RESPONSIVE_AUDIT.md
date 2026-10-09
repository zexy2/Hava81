# Live responsive audit

Run this **manual, read-only** smoke audit after a GitHub Pages release:

```bash
npm run audit:live-ui
```

The default matrix checks İzmir and Şanlıurfa at 320, 390, 768, 1024 and 1440 px, including 200% text where relevant, **in both light and dark themes**. It verifies each city label, horizontal overflow, and collisions among the header, score/date, score/explanation, and temperature/weather art. An external-weather load gets one retry before a failure is reported. The audit does not alter remote data.

For before/after screenshot evidence and a JSON report:

```bash
npm run audit:live-ui -- --quick --screenshots
```

To check only one theme while debugging, pass `--themes dark` (or `--themes light`). The default checks both; each screenshot and JSON result includes the theme so reports cannot silently overwrite each other.

Screenshots and results are written to `test-results/live-responsive-audit/` (untracked). Set `HAVA81_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser` when Chromium is installed outside Playwright's default browser cache. Run against an isolated local preview with `--base-url http://127.0.0.1:4173`. The local preview must already be running and should have a working API for the city checks.

This command is deliberately **not a required CI gate** because public network availability, weather APIs, and hosted cache state are outside the build's control. CI retains its deterministic mocked Playwright regressions.
