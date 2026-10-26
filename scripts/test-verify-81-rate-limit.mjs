import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

test('verify:81 stops on the first HTTP 429 and reports Retry-After without probing another city', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'hava81-verify81-429-'));
  try {
    const preloadPath = join(tempDir, 'mock-fetch.mjs');
    writeFileSync(preloadPath, `
let calls = 0;
globalThis.fetch = async () => {
  calls += 1;
  return new Response(JSON.stringify({ error: 'rate limited' }), {
    status: 429,
    headers: { 'content-type': 'application/json', 'retry-after': '37' },
  });
};
process.on('exit', () => console.log('MOCK_FETCH_CALLS=' + calls));
`);

    const scriptPath = resolve('scripts/verify-81-cities.mjs');
    const result = spawnSync(process.execPath, [scriptPath], {
      encoding: 'utf8',
      timeout: 5_000,
      env: {
        ...process.env,
        BASE_URL: 'https://mock.invalid/api/v1',
        DELAY_MS: '0',
        NODE_OPTIONS: [process.env.NODE_OPTIONS, `--import=${pathToFileURL(preloadPath).href}`]
          .filter(Boolean)
          .join(' '),
      },
    });

    assert.equal(result.error, undefined, result.error?.message);
    assert.equal(result.status, 2, result.stderr || result.stdout);
    assert.match(result.stdout, /RESULT: BLOCKED \(HTTP 429 rate limit at /);
    assert.match(result.stdout, /Retry-After: 37/);
    assert.match(result.stdout, /MOCK_FETCH_CALLS=1/);
    assert.doesNotMatch(result.stdout, /\[02\/81\]/);
    assert.doesNotMatch(result.stdout, /RESULT: PASS 81\/81/);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('verify:81 paces successful city requests below the shared API rate limit by default', () => {
  const tempDir = mkdtempSync(join(tmpdir(), 'hava81-verify81-pacing-'));
  try {
    const preloadPath = join(tempDir, 'mock-fetch.mjs');
    writeFileSync(preloadPath, `
let calls = 0;
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json', ...headers },
});
globalThis.fetch = async (input) => {
  calls += 1;
  const url = String(input);
  const now = new Date().toISOString();
  if (calls === 1 && url.includes('/weather/current?')) {
    return json({ cityName: 'Adana', temperature: 21, timestamp: now, coordinates: { lat: 37, lon: 35.32 } });
  }
  if (calls === 2 && url.includes('/weather/forecast?')) {
    return json({ hourly: [{}], daily: [{}], meta: { intervalHours: 3, timezoneOffsetSeconds: 10800, provider: 'fixture', fetchedAt: now } });
  }
  return json({ error: 'rate limited' }, 429, { 'retry-after': '37' });
};
process.on('exit', () => console.log('MOCK_FETCH_CALLS=' + calls));
`);

    const scriptPath = resolve('scripts/verify-81-cities.mjs');
    const startedAt = Date.now();
    const result = spawnSync(process.execPath, [scriptPath], {
      encoding: 'utf8',
      timeout: 8_000,
      env: {
        ...process.env,
        BASE_URL: 'https://mock.invalid/api/v1',
        DELAY_MS: '',
        NODE_OPTIONS: [process.env.NODE_OPTIONS, `--import=${pathToFileURL(preloadPath).href}`]
          .filter(Boolean)
          .join(' '),
      },
    });
    const elapsedMs = Date.now() - startedAt;

    assert.equal(result.error, undefined, result.error?.message);
    assert.equal(result.status, 2, result.stderr || result.stdout);
    assert.match(result.stdout, /\[01\/81\] Adana \.\.\. OK/);
    assert.match(result.stdout, /\[02\/81\] Adıyaman \.\.\. BLOCKED \(HTTP 429\)/);
    assert.match(result.stdout, /MOCK_FETCH_CALLS=3/);
    assert.ok(elapsedMs >= 3_000, `default request pacing was only ${elapsedMs}ms`);
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test('decision calibration gate shares the conservative 81-city request pacing', () => {
  const source = readFileSync(resolve('scripts/verify-decision-81.ts'), 'utf8');
  assert.match(source, /const delayMs = Number\(process\.env\.DELAY_MS \|\| 1600\);/);
});
