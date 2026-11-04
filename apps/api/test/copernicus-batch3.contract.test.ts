/**
 * Contract for the batch-3 fixes to the Copernicus context grid (PR #1741). Each test names
 * the issue it closes.
 *
 * FROZEN: written before the implementation and not edited afterwards. If a check is wrong,
 * raise it with the owner instead of changing it.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CopernicusContextGrid,
  type ContextGridDocument,
} from '../src/providers/copernicus/context-grid';
import { MetNorwayContextService } from '../src/providers/metno/metno-context.service';

const HOUR = 3_600_000;
const T0 = Date.UTC(2026, 9, 30, 0, 0, 0);
const USER_AGENT = 'Hava81/2.1 (+https://hava81.zekiakgul.dev)';
const GRID_URL = 'https://example.test/context-grid.json';
const ROWS = 3;
const COLS = 3;
const HOURS = 48;
const POINT = { lat: 40.25, lon: 28.25 }; // the centre cell (row 1, col 1)

const field = (value: number | null) => Array.from({ length: HOURS * ROWS * COLS }, () => value);

const CAMS = (run: number) => ({
  name: 'CAMS European air quality forecast',
  licence: 'CC BY 4.0',
  run: new Date(run).toISOString(),
});
const MARINE = (run?: number) => ({
  name: 'E.U. Copernicus Marine Service',
  licence: 'Copernicus Marine licence',
  dois: ['10.48670/mds-00373', '10.48670/mds-00359'],
  ...(run === undefined ? {} : { run: new Date(run).toISOString() }),
});

const grid = (
  sources: ContextGridDocument['sources'],
  generatedAt = T0 - HOUR
): ContextGridDocument => ({
  version: 1,
  generatedAt: new Date(generatedAt).toISOString(),
  grid: { lat0: 40, lon0: 28, step: 0.25, rows: ROWS, cols: COLS },
  times: Array.from({ length: HOURS }, (_, hour) => new Date(T0 + hour * HOUR).toISOString()),
  fields: {
    dust: field(12),
    grassPollen: field(4),
    olivePollen: field(1),
    waveHeight: field(0.9),
    waveDirection: field(20),
    wavePeriod: field(4),
    seaSurfaceTemperature: field(17),
  },
  units: {
    dust: 'µg/m³',
    grassPollen: 'grains/m³',
    olivePollen: 'grains/m³',
    waveHeight: 'm',
    waveDirection: '°',
    wavePeriod: 's',
    seaSurfaceTemperature: '°C',
  },
  sources,
});

const met = () => ({
  type: 'Feature',
  properties: {
    timeseries: Array.from({ length: 64 }, (_, hour) => ({
      time: new Date(T0 + hour * HOUR).toISOString().replace('.000', ''),
      data: {
        instant: {
          details: {
            air_temperature: 16,
            wind_speed: 5,
            cloud_area_fraction: 20,
            ultraviolet_index_clear_sky: hour === 9 ? 4 : 0,
          },
        },
        next_1_hours: {
          summary: { symbol_code: 'fair_day' },
          details: { precipitation_amount: 0 },
        },
      },
    })),
  },
});

type Handler = () => Response | Promise<Response>;
const router = (routes: { grid?: Handler; met?: Handler }) => {
  const calls = { grid: 0, met: 0 };
  const fetchImpl = (async (input: Parameters<typeof fetch>[0]) => {
    const url = new URL(String(input));
    if (url.hostname === 'api.met.no') {
      calls.met += 1;
      return routes.met ? routes.met() : new Response(JSON.stringify(met()), { status: 200 });
    }
    if (url.href === GRID_URL && routes.grid) {
      calls.grid += 1;
      return routes.grid();
    }
    return new Response('not found', { status: 404 });
  }) as typeof fetch;
  return { fetchImpl, calls };
};

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

const context = (fetchImpl: typeof fetch, now: () => number, gridOptions = {}) =>
  new MetNorwayContextService(fetchImpl, {
    userAgent: USER_AGENT,
    now: () => new Date(now()),
    grid: new CopernicusContextGrid(fetchImpl, {
      url: GRID_URL,
      now: () => new Date(now()),
      ...gridOptions,
    }),
  });

// #1742
test('#1742 freshness follows each source run, not the time the grid was built', async () => {
  // A grid built an hour ago that wraps a CAMS run from three days ago is not fresh pollen.
  const { fetchImpl } = router({
    grid: () => json(grid([CAMS(T0 - 72 * HOUR), MARINE(T0 - 6 * HOUR)])),
  });
  const result = await context(fetchImpl, () => T0 + 20 * 60_000).get(POINT.lat, POINT.lon, true);
  assert.equal(result.dustMax, undefined, 'old CAMS run');
  assert.equal(result.grassPollenMax, undefined, 'old CAMS run');
  // The Marine source ran recently, so its values still come back, on their own.
  assert.equal(result.marine?.waveHeight, 0.9);
});

test('#1742 a source without a verifiable run time is not shown as fresh', async () => {
  const { fetchImpl } = router({ grid: () => json(grid([CAMS(T0 - 8 * HOUR), MARINE()])) });
  const result = await context(fetchImpl, () => T0 + 20 * 60_000).get(POINT.lat, POINT.lon, true);
  assert.equal(result.marine, undefined, 'marine without a run time');
  assert.equal(result.dustMax, 12, 'CAMS is independent');
});

// #1768
test('#1768 sea values are a model valid time and model run, not an observation', async () => {
  const { fetchImpl } = router({
    grid: () => json(grid([CAMS(T0 - 8 * HOUR), MARINE(T0 - 6 * HOUR)])),
  });
  const result = await context(fetchImpl, () => T0 + 20 * 60_000).get(POINT.lat, POINT.lon, true);
  assert.equal(result.marine?.validAt, new Date(T0).toISOString());
  assert.equal(result.marine?.modelRunAt, new Date(T0 - 6 * HOUR).toISOString());
});

// #1771
test('#1771 Copernicus values survive a MET Norway outage; UV is then unknown', async () => {
  const { fetchImpl } = router({
    grid: () => json(grid([CAMS(T0 - 8 * HOUR), MARINE(T0 - 6 * HOUR)])),
    met: () => new Response('down', { status: 503 }),
  });
  const result = await context(fetchImpl, () => T0 + 20 * 60_000).get(POINT.lat, POINT.lon, true);
  assert.equal(result.uvIndexMax, undefined);
  assert.equal(result.dustMax, 12);
  assert.equal(result.marine?.waveHeight, 0.9);
  assert.match(result.attribution ?? '', /Copernicus/);
});

test('#1771 with both sources down the context fails instead of returning nothing as calm', async () => {
  const { fetchImpl } = router({
    grid: () => new Response('down', { status: 503 }),
    met: () => new Response('down', { status: 503 }),
  });
  await assert.rejects(() =>
    context(fetchImpl, () => T0 + 20 * 60_000).get(POINT.lat, POINT.lon, true)
  );
});

// #1767
test('#1767 a failed grid fetch is retried soon, not after the full refresh interval', async () => {
  let now = T0 + 20 * 60_000;
  let up = false;
  const { fetchImpl, calls } = router({
    grid: () =>
      up
        ? json(grid([CAMS(T0 - 8 * HOUR), MARINE(T0 - 6 * HOUR)]))
        : new Response('down', { status: 503 }),
  });
  const service = context(fetchImpl, () => now, { refreshMs: 30 * 60_000 });

  assert.equal((await service.get(POINT.lat, POINT.lon, false)).dustMax, undefined);
  up = true;
  now += 3 * 60_000; // well inside the 30-minute refresh interval
  const recovered = await service.get(POINT.lat, POINT.lon, false);
  assert.equal(recovered.dustMax, 12);
  assert.equal(calls.grid, 2);
});

test('#1767 a failure does not renew the age of the last good grid', async () => {
  let now = T0 + 20 * 60_000;
  let up = true;
  const { fetchImpl } = router({
    grid: () =>
      up
        ? json(grid([CAMS(T0 - 8 * HOUR), MARINE(T0 - 6 * HOUR)]))
        : new Response('down', { status: 503 }),
  });
  const service = context(fetchImpl, () => now, { refreshMs: 30 * 60_000 });
  assert.equal((await service.get(POINT.lat, POINT.lon, false)).dustMax, 12);

  up = false;
  // Beyond the CAMS run's freshness (run at T0-8h, 36 h budget) with every refresh failing.
  for (let step = 0; step < 40; step += 1) {
    now += HOUR;
    await service.get(POINT.lat, POINT.lon, false);
  }
  assert.equal((await service.get(POINT.lat, POINT.lon, false)).dustMax, undefined);
});
