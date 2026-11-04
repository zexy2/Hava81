/**
 * Contract for dust, pollen and sea signals from Copernicus, merged with MET Norway's UV.
 *
 * A scheduled job (scripts/context-grid) downloads the Türkiye window of the CAMS European
 * air-quality forecast (CC BY 4.0) and the Copernicus Marine Mediterranean and Black Sea
 * forecasts (free, commercial use with credit), and publishes one compact grid. The API reads
 * that grid; it never calls Copernicus per request.
 *
 * FROZEN: written before the implementation and not edited afterwards. If a check is wrong,
 * raise it with the owner instead of changing it.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { envSchema } from '../src/config/env';
import {
  CopernicusContextGrid,
  type ContextGridDocument,
} from '../src/providers/copernicus/context-grid';
import { createDataSources } from '../src/providers/data-sources';
import { MetNorwayContextService } from '../src/providers/metno/metno-context.service';

const HOUR = 3_600_000;
// 2026-10-30T00:00:00Z; the MET fixture and the grid both start here.
const T0 = Date.UTC(2026, 9, 30, 0, 0, 0);
const USER_AGENT = 'Hava81/2.1 (+https://hava81.zekiakgul.dev)';
const GRID_URL =
  'https://github.com/zexy2/Hava81/releases/download/context-grid-latest/context-grid.json';

/**
 * 0.25° grid over 40.0–41.5°N, 28.0–29.5°E (7 rows × 7 cols), 48 hourly steps.
 * Row 0 is the southern edge. The south-west 3×3 block is land (air quality only); the
 * north-east 3×3 block is sea (marine only); everything else has both, as coasts do.
 */
const ROWS = 7;
const COLS = 7;
const HOURS = 48;
const LAT0 = 40;
const LON0 = 28;
const STEP = 0.25;

const isLand = (row: number, col: number) => row <= 2 && col <= 2;
const isSea = (row: number, col: number) => row >= 4 && col >= 4;

const field = (value: (hour: number, row: number, col: number) => number | null) => {
  const values: Array<number | null> = [];
  for (let hour = 0; hour < HOURS; hour += 1) {
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) values.push(value(hour, row, col));
    }
  }
  return values;
};

const gridDocument = (overrides: Partial<ContextGridDocument> = {}): ContextGridDocument => ({
  version: 1,
  generatedAt: new Date(T0 - 2 * HOUR).toISOString(),
  grid: { lat0: LAT0, lon0: LON0, step: STEP, rows: ROWS, cols: COLS },
  times: Array.from({ length: HOURS }, (_, hour) => new Date(T0 + hour * HOUR).toISOString()),
  fields: {
    // Dust peaks at hour 30, outside a 24-hour window that starts at T0.
    dust: field((hour, row, col) => (isSea(row, col) ? null : hour === 30 ? 400 : 10 + hour / 10)),
    grassPollen: field((hour, row, col) => (isSea(row, col) ? null : hour === 12 ? 42 : 3)),
    olivePollen: field((_hour, row, col) => (isSea(row, col) ? null : 1.5)),
    waveHeight: field((hour, row, col) => (isLand(row, col) ? null : 0.8 + hour / 100)),
    waveDirection: field((_hour, row, col) => (isLand(row, col) ? null : 20)),
    wavePeriod: field((_hour, row, col) => (isLand(row, col) ? null : 4.2)),
    seaSurfaceTemperature: field((_hour, row, col) => (isLand(row, col) ? null : 17.6)),
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
  sources: [
    {
      name: 'CAMS European air quality forecast',
      licence: 'CC BY 4.0',
      run: new Date(T0 - 8 * HOUR).toISOString(),
    },
    {
      name: 'E.U. Copernicus Marine Service',
      licence: 'Copernicus Marine licence',
      dois: [
        '10.48670/mds-00373',
        '10.48670/mds-00359',
        '10.48670/mds-00360',
        '10.48670/mds-00355',
      ],
      run: new Date(T0 - 6 * HOUR).toISOString(),
    },
  ],
  ...overrides,
});

/** Same MET Norway shape the commercial-sources contract uses: UV 4 at hour 9. */
const metForecast = () => ({
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

type Routes = { grid?: () => Response | Promise<Response> };
const router = (routes: Routes = {}) => {
  const requests: URL[] = [];
  const fetchImpl = (async (input: Parameters<typeof fetch>[0]) => {
    const url = new URL(String(input));
    requests.push(url);
    if (url.hostname === 'api.met.no')
      return new Response(JSON.stringify(metForecast()), { status: 200 });
    if (url.href === GRID_URL && routes.grid) return routes.grid();
    return new Response('not found', { status: 404 });
  }) as typeof fetch;
  return { fetchImpl, requests };
};

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

const service = (fetchImpl: typeof fetch, now = T0 + 20 * 60_000) =>
  new MetNorwayContextService(fetchImpl, {
    userAgent: USER_AGENT,
    now: () => new Date(now),
    grid: new CopernicusContextGrid(fetchImpl, { url: GRID_URL, now: () => new Date(now) }),
  });

// Cell centres: row r, col c sits at (LAT0 + r·STEP, LON0 + c·STEP).
const LAND = { lat: 40.25, lon: 28.25 }; // row 1, col 1
const SEA = { lat: 41.25, lon: 29.25 }; // row 5, col 5
const COAST = { lat: 40.75, lon: 28.75 }; // row 3, col 3

test('dust and pollen come back over land as the next 24 hours’ maximum', async () => {
  const { fetchImpl } = router({ grid: () => json(gridDocument()) });

  const result = await service(fetchImpl).get(LAND.lat, LAND.lon, false);

  // The 400 µg/m³ spike at hour 30 lies outside the window; the in-window max is hour 23.
  assert.equal(result.dustMax, 12.3);
  assert.equal(result.grassPollenMax, 42);
  assert.equal(result.olivePollenMax, 1.5);
  assert.equal(result.units.dust, 'µg/m³');
  assert.equal(result.units.grassPollen, 'grains/m³');
  assert.equal(result.units.olivePollen, 'grains/m³');
  // UV still comes from MET Norway.
  assert.ok(
    typeof result.uvIndexMax === 'number' && result.uvIndexMax > 0 && result.uvIndexMax <= 4
  );
  assert.equal(result.marine, undefined);
});

test('the sea comes back over water: current state and a three-day hourly outlook', async () => {
  const { fetchImpl } = router({ grid: () => json(gridDocument()) });

  const result = await service(fetchImpl).get(SEA.lat, SEA.lon, true);

  assert.ok(result.marine);
  assert.equal(result.marine.observedAt, new Date(T0).toISOString());
  assert.equal(result.marine.waveHeight, 0.8);
  assert.equal(result.marine.waveDirection, 20);
  assert.equal(result.marine.wavePeriod, 4.2);
  assert.equal(result.marine.seaSurfaceTemperature, 17.6);
  assert.equal(result.units.waveHeight, 'm');
  assert.equal(result.units.seaSurfaceTemperature, '°C');
  const hourly = result.marineHourly ?? [];
  assert.equal(hourly.length, HOURS);
  assert.equal(hourly[0].time, new Date(T0).toISOString());
  assert.equal(hourly[10].waveHeight, 0.9);
  // Open sea has no dust or pollen reading.
  assert.equal(result.dustMax, undefined);
  assert.equal(result.grassPollenMax, undefined);
});

test('marine data is only included when asked for', async () => {
  const { fetchImpl } = router({ grid: () => json(gridDocument()) });

  const result = await service(fetchImpl).get(COAST.lat, COAST.lon, false);

  assert.equal(result.marine, undefined);
  assert.equal(result.marineHourly, undefined);
  assert.equal(typeof result.dustMax, 'number');
});

test('a coastal point reads land and sea from the nearest cell that has each', async () => {
  const { fetchImpl } = router({ grid: () => json(gridDocument()) });

  // Between the land block and open sea, but snapped to the land block's nearest cell for dust
  // and the sea block's nearest cell for waves when its own cell lacks them.
  const result = await service(fetchImpl).get(40.5, 28.5, true);

  assert.equal(typeof result.dustMax, 'number');
  assert.ok(result.marine);
  assert.equal(typeof result.marine.waveHeight, 'number');
});

test('points outside the grid, or too far from any value, get no reading rather than a guess', async () => {
  const { fetchImpl } = router({ grid: () => json(gridDocument()) });

  const result = await service(fetchImpl).get(37, 35, true);

  assert.equal(result.dustMax, undefined);
  assert.equal(result.marine, undefined);
  assert.ok(typeof result.uvIndexMax === 'number');
});

test('attribution credits MET Norway, CAMS and Copernicus Marine with its DOIs', async () => {
  const { fetchImpl } = router({ grid: () => json(gridDocument()) });

  const result = await service(fetchImpl).get(SEA.lat, SEA.lon, true);

  assert.match(result.provider, /MET Norway/);
  assert.match(result.provider, /Copernicus/);
  assert.match(result.attribution, /MET Norway/);
  assert.match(result.attribution, /CAMS|Copernicus Atmosphere Monitoring Service/);
  assert.match(result.attribution, /Copernicus Marine/);
  assert.match(result.attribution, /10\.48670\/mds-00373/);
});

test('a stale or missing grid degrades to UV only, never to stale pollen', async () => {
  const stale = router({
    grid: () => json(gridDocument({ generatedAt: new Date(T0 - 40 * HOUR).toISOString() })),
  });
  const staleResult = await service(stale.fetchImpl).get(LAND.lat, LAND.lon, true);
  assert.equal(staleResult.dustMax, undefined);
  assert.equal(staleResult.grassPollenMax, undefined);
  assert.equal(staleResult.provider, 'MET Norway');
  assert.ok(typeof staleResult.uvIndexMax === 'number');

  const missing = router();
  const missingResult = await service(missing.fetchImpl).get(LAND.lat, LAND.lon, true);
  assert.equal(missingResult.dustMax, undefined);
  assert.equal(missingResult.provider, 'MET Norway');

  const broken = router({ grid: () => new Response('{"version":1,"grid":', { status: 200 }) });
  const brokenResult = await service(broken.fetchImpl).get(LAND.lat, LAND.lon, true);
  assert.equal(brokenResult.dustMax, undefined);
});

test('a grid whose fields do not match its shape is rejected', async () => {
  const bad = gridDocument();
  bad.fields.dust = bad.fields.dust.slice(1);
  const { fetchImpl } = router({ grid: () => json(bad) });

  const result = await service(fetchImpl).get(LAND.lat, LAND.lon, false);

  assert.equal(result.dustMax, undefined);
});

test('the grid is fetched once and reused while fresh', async () => {
  const { fetchImpl, requests } = router({ grid: () => json(gridDocument()) });
  const grid = new CopernicusContextGrid(fetchImpl, { url: GRID_URL, now: () => new Date(T0) });
  const context = new MetNorwayContextService(fetchImpl, {
    userAgent: USER_AGENT,
    now: () => new Date(T0),
    grid,
  });

  await Promise.all([context.get(LAND.lat, LAND.lon, false), context.get(SEA.lat, SEA.lon, true)]);
  await context.get(COAST.lat, COAST.lon, true);

  assert.equal(requests.filter(url => url.href === GRID_URL).length, 1);
});

test('the default data sources read the published grid', () => {
  const env = envSchema.parse({ NODE_ENV: 'test', OPENWEATHER_API_KEY: 'k' });
  assert.match(env.CONTEXT_GRID_URL, /context-grid/);
  const sources = createDataSources(env);
  assert.ok(sources.contextService instanceof MetNorwayContextService);
  const off = envSchema.parse({ NODE_ENV: 'test', OPENWEATHER_API_KEY: 'k', CONTEXT_GRID_URL: '' });
  assert.equal(off.CONTEXT_GRID_URL, '');
});
