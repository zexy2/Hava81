/**
 * Contract for the remaining PR #1704 review fixes (#1714 #1766).
 *
 * FROZEN: written before the implementation and not edited afterwards. If a check is wrong,
 * raise it with the owner instead of changing it.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { MetNorwayContextService } from '../src/providers/metno/metno-context.service';
import {
  europeanAqiCoverage,
  OpenWeatherAirQualityHourlyProvider,
} from '../src/providers/openweather/openweather-air-quality-hourly.provider';

const HOUR = 3_600_000;
const T0 = Date.UTC(2026, 9, 30, 0, 0, 0);

// #1714
test('#1714 an AQI from fewer than all five pollutants is marked partial with what it used', () => {
  assert.deepEqual(europeanAqiCoverage({ pm2_5: 5, pm10: 10, no2: 8, o3: 40, so2: 2 }), {
    complete: true,
    pollutants: ['pm2_5', 'pm10', 'no2', 'o3', 'so2'],
  });
  assert.deepEqual(europeanAqiCoverage({ pm2_5: 5.78 }), {
    complete: false,
    pollutants: ['pm2_5'],
  });
  assert.deepEqual(europeanAqiCoverage({}), { complete: false, pollutants: [] });
});

test('#1714 hourly AQI rows say when their coverage is partial', async () => {
  const body = {
    list: [
      { dt: T0 / 1_000, components: { pm2_5: 5, pm10: 10, no2: 8, o3: 40, so2: 2 } },
      { dt: (T0 + HOUR) / 1_000, components: { pm2_5: 5 } },
    ],
  };
  const fetchImpl = (async () =>
    new Response(JSON.stringify(body), { status: 200 })) as typeof fetch;
  const provider = new OpenWeatherAirQualityHourlyProvider(fetchImpl, {
    apiKey: 'k',
    baseUrl: 'https://api.openweathermap.org/data/2.5',
  });
  const { hourly } = await provider.getAirQualityHourly({ lat: 41, lon: 29 });
  assert.equal(hourly[0].aqiPartial, undefined);
  assert.equal(hourly[1].aqiPartial, true);
  assert.deepEqual(hourly[1].aqiPollutants, ['pm2_5']);
});

// #1766
test('#1766 context UV carries the MET model run, separate from the fetch time', async () => {
  const updatedAt = new Date(T0 - 5 * HOUR).toISOString();
  const met = {
    type: 'Feature',
    properties: {
      meta: { updated_at: updatedAt },
      timeseries: Array.from({ length: 30 }, (_, hour) => ({
        time: new Date(T0 + hour * HOUR).toISOString().replace('.000', ''),
        data: {
          instant: {
            details: {
              air_temperature: 16,
              wind_speed: 4,
              cloud_area_fraction: 10,
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
  };
  const fetchImpl = (async () =>
    new Response(JSON.stringify(met), { status: 200 })) as typeof fetch;
  const service = new MetNorwayContextService(fetchImpl, {
    userAgent: 'Hava81/test',
    now: () => new Date(T0 + 20 * 60_000),
  });
  const result = await service.get(41, 29, false);
  assert.equal(result.modelUpdatedAt, updatedAt);
  assert.notEqual(result.modelUpdatedAt, result.fetchedAt);
});
