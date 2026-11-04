/**
 * Contract for the batch-1 fixes to the MET Norway + OpenWeather sources (PR #1704).
 * Each test names the issue it closes.
 *
 * FROZEN: written before the implementation and not edited afterwards. If a check is wrong,
 * raise it with the owner instead of changing it.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { envSchema } from '../src/config/env';
import { MemoryTtlCache } from '../src/core/cache';
import { ProvincesService } from '../src/modules/provinces/provinces.service';
import { createDataSources } from '../src/providers/data-sources';
import { MetNorwayHourlyProvider } from '../src/providers/metno/metno-hourly.provider';
import { MetNorwayProvincesProvider } from '../src/providers/metno/metno-provinces.provider';
import { dailyCodeFor, weatherCodeForSymbol } from '../src/providers/metno/metno-symbols';
import { europeanAqiFromComponents } from '../src/providers/openweather/openweather-air-quality-hourly.provider';
import {
  descriptionForCode,
  iconForCode,
} from '../src/providers/openmeteo/openmeteo-hourly.provider';
import type { ProvinceCurrentProvider } from '../src/providers/openmeteo/openmeteo-provinces.provider';

const HOUR = 3_600_000;
const T0 = Date.UTC(2026, 9, 30, 0, 0, 0);
const UA = 'Hava81/2.1 (+https://hava81.zekiakgul.dev)';

type Step = { hour: number; symbol?: string; amount?: number; period?: 'one' | 'six' | 'none' };

/** MET Locationforecast with per-step control over symbols, amounts and missing periods. */
const met = (steps: Step[], updatedAt = new Date(T0 - 2 * HOUR).toISOString()) => ({
  type: 'Feature',
  properties: {
    meta: { updated_at: updatedAt },
    timeseries: steps.map(step => {
      const block =
        step.symbol === undefined && step.amount === undefined
          ? undefined
          : {
              ...(step.symbol === undefined ? {} : { summary: { symbol_code: step.symbol } }),
              ...(step.amount === undefined
                ? {}
                : { details: { precipitation_amount: step.amount } }),
            };
      return {
        time: new Date(T0 + step.hour * HOUR).toISOString().replace('.000', ''),
        data: {
          instant: {
            details: {
              air_temperature: 15,
              wind_speed: 4,
              wind_from_direction: 90,
              cloud_area_fraction: 40,
            },
          },
          ...(step.period === 'none'
            ? {}
            : step.period === 'six'
              ? { next_6_hours: block }
              : { next_1_hours: block }),
        },
      };
    }),
  },
});

const hourlySteps = (overrides: Record<number, Partial<Step>> = {}): Step[] => {
  const steps: Step[] = [];
  for (let hour = 0; hour < 64; hour += 1)
    steps.push({ hour, symbol: 'clearsky_day', amount: 0, ...overrides[hour] });
  for (let hour = 66; hour <= 216; hour += 6)
    steps.push({ hour, symbol: 'cloudy', amount: 0, period: 'six', ...overrides[hour] });
  return steps;
};

const owm = (timezone?: number) => ({
  list: Array.from({ length: 40 }, (_, slot) => ({
    dt: (T0 + slot * 3 * HOUR) / 1_000,
    pop: 0.1,
    visibility: 10_000,
    wind: { gust: 6 },
  })),
  ...(timezone === undefined ? {} : { city: { timezone } }),
});

const fetchFor = (metBody: unknown, owmBody: unknown | null, seen: Request[] = []) =>
  (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const request = new Request(String(input), init);
    seen.push(request);
    const url = new URL(request.url);
    if (url.hostname === 'api.met.no')
      return new Response(JSON.stringify(metBody), { status: 200 });
    if (url.pathname.endsWith('/forecast') && owmBody)
      return new Response(JSON.stringify(owmBody), { status: 200 });
    return new Response('nope', { status: 404 });
  }) as typeof fetch;

const hourly = (metBody: unknown, owmBody: unknown | null = owm(10_800), now = T0 + 20 * 60_000) =>
  new MetNorwayHourlyProvider(fetchFor(metBody, owmBody), {
    userAgent: UA,
    openWeatherApiKey: 'k',
    openWeatherBaseUrl: 'https://api.openweathermap.org/data/2.5',
    now: () => new Date(now),
  });

// #1709
test('#1709 without OpenWeather the offset is Türkiye time (UTC+3), not a longitude guess', async () => {
  for (const lon of [26.4, 28.97, 32.85, 44.0]) {
    const result = await hourly(met(hourlySteps()), owm()).getHourly({
      lat: 39.9,
      lon,
      lang: 'tr',
    });
    assert.equal(result.timezoneOffsetSeconds, 10_800, `lon ${lon}`);
  }
});

// #1729
test('#1729 sleet is rain and snow mixed, never freezing rain', () => {
  for (const symbol of [
    'lightsleet',
    'sleet',
    'heavysleet',
    'sleetshowers_day',
    'lightssleetshowersandthunder',
  ]) {
    const code = weatherCodeForSymbol(symbol);
    assert.ok(code !== 66 && code !== 67, `${symbol} -> ${code}`);
  }
  assert.equal(weatherCodeForSymbol('sleet'), 68);
  assert.equal(weatherCodeForSymbol('heavysleet'), 69);
  assert.match(descriptionForCode(68, 'tr'), /karla karışık/i);
  assert.match(descriptionForCode(69, 'en'), /sleet|rain and snow/i);
  assert.match(iconForCode(68, true), /^13d$/);
});

// #1712 #1726
test('#1712 #1726 an unknown symbol stays unknown: no weather code, no dry or overcast claim', async () => {
  assert.equal(weatherCodeForSymbol('meteorshower_day'), null);
  const result = await hourly(met(hourlySteps({ 2: { symbol: 'meteorshower_day' } }))).getHourly({
    lat: 41,
    lon: 29,
    lang: 'tr',
  });
  const hour = result.hourly[2];
  assert.equal(hour.weatherCode, undefined);
  assert.match(hour.description, /bilinmiyor/i);
  assert.equal(result.hourly.length, 120);
});

// #1731
test('#1731 a missing MET period is not converted into a dry, cloudy hour', async () => {
  const result = await hourly(
    met(hourlySteps({ 3: { period: 'none' }, 4: { symbol: 'rain', amount: undefined } }))
  ).getHourly({ lat: 41, lon: 29, lang: 'tr' });
  assert.equal(result.hourly[3].precipitationMm, undefined, 'absent period: amount unknown');
  assert.equal(result.hourly[3].weatherCode, undefined, 'absent period: no symbol');
  assert.equal(
    result.hourly[4].precipitationMm,
    undefined,
    'summary without amount: amount unknown'
  );
  assert.equal(result.hourly[4].weatherCode, weatherCodeForSymbol('rain'));
});

// #1727
test('#1727 the daily summary picks the most consequential weather, not the biggest number', () => {
  // Thunder outranks heavy snow showers (86) and heavy rain showers (82).
  assert.equal(dailyCodeFor([86, 95, 3]), 95);
  // Heavy snow (75) outranks light rain showers (80) even though 80 > 75.
  assert.equal(dailyCodeFor([80, 75, 2]), 75);
  // Heavy rain (65) outranks snow showers (85).
  assert.equal(dailyCodeFor([65, 85]), 65);
  // Fog (45) outranks overcast (3); clear is the least.
  assert.equal(dailyCodeFor([0, 3, 45]), 45);
  assert.equal(dailyCodeFor([]), null);
});

// #1730
test('#1730 European AQI uses the EEA bands revised in 2024', () => {
  // Interpolated inside the revised bands (Open-Meteo / EEA, hourly concentrations).
  assert.equal(europeanAqiFromComponents({ no2: 90 }), 75);
  assert.equal(europeanAqiFromComponents({ pm2_5: 75 }), 73);
  assert.ok((europeanAqiFromComponents({ o3: 240 }) ?? 0) > 100, 'O3 above 180 is extremely poor');
  assert.ok(
    (europeanAqiFromComponents({ so2: 350 }) ?? 0) > 100,
    'SO2 above 275 is extremely poor'
  );
  assert.equal(europeanAqiFromComponents({ pm2_5: 5, pm10: 15, no2: 10, o3: 60, so2: 20 }), 20);
});

// #1735
test('#1735 the MET credit says the data was processed by Hava81', async () => {
  const provider = hourly(met(hourlySteps()));
  assert.match(provider.attribution ?? '', /MET Norway/);
  assert.match(provider.attribution ?? '', /Hava81/);
  assert.match(provider.attribution ?? '', /CC BY 4\.0/);
});

// #1708 #1733 #1716
test('#1708 #1733 #1716 province readings carry model time and validity, not an observation time', async () => {
  const provider = new MetNorwayProvincesProvider(
    fetchFor(met(hourlySteps({ 0: { amount: 0.6, symbol: 'rain' } })), null),
    {
      userAgent: UA,
      now: () => new Date(T0 + 20 * 60_000),
    }
  );
  const [reading] = await provider.getCurrent([{ lat: 41, lon: 29 }]);
  assert.ok(reading);
  assert.equal(reading.validAt, new Date(T0).toISOString());
  assert.equal(reading.modelUpdatedAt, new Date(T0 - 2 * HOUR).toISOString());
  // The one-hour amount is a forecast for the coming hour, with its window.
  assert.deepEqual(reading.precipitationPeriod, {
    amountMm: 0.6,
    validFrom: new Date(T0).toISOString(),
    validTo: new Date(T0 + HOUR).toISOString(),
  });
  const result = await hourly(met(hourlySteps())).getHourly({ lat: 41, lon: 29, lang: 'tr' });
  assert.equal(result.modelUpdatedAt, new Date(T0 - 2 * HOUR).toISOString());
});

// #1736 #1754
test('#1736 #1754 a failed refresh keeps the last good map until it is too old to show', async () => {
  let now = T0;
  let fail = false;
  const provider: ProvinceCurrentProvider = {
    name: 'MET Norway',
    getCurrent: async points => {
      if (fail) throw new Error('upstream down');
      return points.map(() => ({
        temperature: 15,
        weatherCode: 2,
        isDay: true,
        observedAt: new Date(now).toISOString(),
      }));
    },
  };
  const cache = new MemoryTtlCache(50, () => now);
  const service = new ProvincesService(provider, cache, 30 * 60_000, {
    maxStaleMs: 3 * HOUR,
    now: () => now,
  });
  const fresh = await service.getAll('tr');
  assert.equal(fresh.value.provinces.length > 0, true);

  fail = true;
  now += 45 * 60_000; // past the TTL, within the stale budget
  const stale = await service.getAll('tr');
  assert.equal(stale.value.provinces.length, fresh.value.provinces.length);
  assert.equal(stale.status, 'STALE');

  now += 3 * HOUR; // past the stale budget
  await assert.rejects(() => service.getAll('tr'));
});

// #1710 #1713
test('#1710 #1713 MET requests are paced below 20/s and revalidated with If-Modified-Since', async () => {
  const seen: Request[] = [];
  const lastModified = new Date(T0 - HOUR).toUTCString();
  let calls = 0;
  const fetchImpl = (async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1]
  ) => {
    const request = new Request(String(input), init);
    seen.push(request);
    calls += 1;
    if (request.headers.get('if-modified-since') === lastModified)
      return new Response(null, { status: 304 });
    return new Response(JSON.stringify(met(hourlySteps())), {
      status: 200,
      headers: { 'last-modified': lastModified, expires: new Date(T0 + HOUR).toUTCString() },
    });
  }) as typeof fetch;
  const provider = new MetNorwayProvincesProvider(fetchImpl, {
    userAgent: UA,
    concurrency: 8,
    now: () => new Date(T0 + 20 * 60_000),
    maxRequestsPerSecond: 10,
  });
  const points = Array.from({ length: 20 }, (_, index) => ({
    lat: 36 + index * 0.3,
    lon: 27 + index * 0.8,
  }));

  const started = Date.now();
  await provider.getCurrent(points);
  const elapsed = Date.now() - started;
  assert.equal(calls, 20, 'one request per point');
  assert.ok(elapsed >= 1_700, `20 requests at 10/s take ~2 s, took ${elapsed} ms`);

  // A second refresh revalidates and reuses the stored body on 304.
  const again = await provider.getCurrent(points.slice(0, 2));
  assert.ok(again.every(Boolean));
  assert.ok(
    seen.slice(-2).every(request => request.headers.get('if-modified-since') === lastModified)
  );
});

// #1715
test('#1715 production cannot select the free Open-Meteo endpoint', () => {
  const base = {
    NODE_ENV: 'production',
    OPENWEATHER_API_KEY: 'k',
    CORS_ORIGINS: 'https://hava81.zekiakgul.dev',
  };
  assert.throws(
    () => createDataSources(envSchema.parse({ ...base, WEATHER_DATA_SOURCE: 'openmeteo' })),
    /OPEN_METEO_API_KEY/
  );
  assert.doesNotThrow(() =>
    createDataSources(
      envSchema.parse({ ...base, WEATHER_DATA_SOURCE: 'openmeteo', OPEN_METEO_API_KEY: 'paid' })
    )
  );
  assert.doesNotThrow(() => createDataSources(envSchema.parse(base)));
  assert.doesNotThrow(() =>
    createDataSources(
      envSchema.parse({
        NODE_ENV: 'test',
        OPENWEATHER_API_KEY: 'k',
        WEATHER_DATA_SOURCE: 'openmeteo',
      })
    )
  );
});
