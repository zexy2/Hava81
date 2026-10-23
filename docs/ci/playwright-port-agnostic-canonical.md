# Playwright canonical URL assertion

The Playwright config intentionally allows `HAVA81_PLAYWRIGHT_PORT` to isolate concurrent preview servers. The browser-history test used to hard-code port 4173, so a correct app on an alternate configured port failed only because of the test fixture. The assertion now derives the expected canonical root from the actual page origin; it still checks that returning to `/` resets canonical metadata to the root URL.
