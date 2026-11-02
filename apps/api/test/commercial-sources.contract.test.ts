/**
 * Contract for the commercial-use data sources: MET Norway (CC BY 4.0) for the forecast,
 * the 81 provinces and UV; OpenWeather (free plan, commercial use allowed) for the chance
 * of rain, gusts, visibility and air quality. Open-Meteo's free API is non-commercial only,
 * so it is off by default.
 *
 * FROZEN: written before the implementation and not edited afterwards. If a check is wrong,
 * raise it with the owner instead of changing it. Upstream shapes mirror real responses
 * captured on 2026-10-30 for İstanbul.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { envSchema } from '../src/config/env';
import { createDataSources } from '../src/providers/data-sources';
import { MetNorwayContextService } from '../src/providers/metno/metno-context.service';
import { MetNorwayHourlyProvider } from '../src/providers/metno/metno-hourly.provider';
import { MetNorwayProvincesProvider } from '../src/providers/metno/metno-provinces.provider';
import { weatherCodeForSymbol } from '../src/providers/metno/metno-symbols';
import { sunTimes } from '../src/providers/metno/solar';
import {
  europeanAqiFromComponents,
  OpenWeatherAirQualityHourlyProvider,
} from '../src/providers/openweather/openweather-air-quality-hourly.provider';

const USER_AGENT = 'Hava81/2.1 (+https://hava81.zekiakgul.dev)';
const HOUR = 3_600_000;
// 2026-10-30T00:00:00Z, the first full hour of the captured İstanbul response.
const T0 = Date.UTC(2026, 9, 30, 0, 0, 0);

type Request = { url: URL; headers: Headers };

/** MET Norway locationforecast/2.0/complete: hourly for 64 h, then 6-hourly to 10 days. */
const metForecast = (options: { start?: number; temperature?: (hour: number) => number } = {}) => {
  const start = options.start ?? T0;
  const temperature = options.temperature ?? ((hour: number) => 16 - Math.sin(hour / 4));
  const timeseries = [];
  for (let hour = 0; hour < 64; hour += 1) timeseries.push(hour);
  for (let hour = 66; hour <= 216; hour += 6) timeseries.push(hour);
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [28.9784, 41.0082, 40] },
    properties: {
      meta: {
        updated_at: new Date(start - HOUR).toISOString(),
        units: { air_temperature: 'celsius' },
      },
      timeseries: timeseries.map(hour => {
        const hourly = hour < 64;
        return {
          time: new Date(start + hour * HOUR).toISOString().replace('.000', ''),
          data: {
            instant: {
              details: {
                air_temperature: Math.round(temperature(hour) * 10) / 10,
                apparent_air_temperature: Math.round((temperature(hour) - 1) * 10) / 10,
                relative_humidity: 70,
                dew_point_temperature: 10.5,
                wind_speed: 6,
                wind_from_direction: 352,
                cloud_area_fraction: hour === 5 ? 100 : 40,
                fog_area_fraction: 0,
                air_pressure_at_sea_level: 1014,
                ultraviolet_index_clear_sky: hour === 9 ? 4 : 0,
              },
            },
            ...(hourly
              ? {
                  next_1_hours: {
                    summary: {
                      symbol_code:
                        hour === 5
                          ? 'heavyrainandthunder'
                          : hour === 6
                            ? 'rain'
                            : 'partlycloudy_day',
                    },
                    details: { precipitation_amount: hour === 5 ? 3.2 : hour === 6 ? 1.1 : 0 },
                  },
                }
              : {}),
            next_6_hours: {
              summary: { symbol_code: hourly ? 'cloudy' : 'lightrain' },
              details: {
                precipitation_amount: hourly ? 0 : 1.2,
                air_temperature_max: 17,
                air_temperature_min: 14,
              },
            },
            next_12_hours: { summary: { symbol_code: 'cloudy' }, details: {} },
          },
        };
      }),
    },
  };
};

/** OpenWeather /data/2.5/forecast: 40 three-hour slots from T0, İstanbul (UTC+3). */
const openWeatherForecast = () => ({
  cod: '200',
  cnt: 40,
  list: Array.from({ length: 40 }, (_, slot) => ({
    dt: (T0 + slot * 3 * HOUR) / 1_000,
    main: { temp: 16, feels_like: 15, humidity: 70, pressure: 1014 },
    weather: [{ id: 500, main: 'Rain', description: 'hafif yağmur', icon: '10d' }],
    wind: { speed: 3.8, deg: 18, gust: slot === 1 ? 12.4 : 7.9 },
    visibility: slot === 1 ? 4_000 : 10_000,
    pop: slot === 1 ? 0.75 : 0.04,
    dt_txt: new Date(T0 + slot * 3 * HOUR).toISOString().replace('T', ' ').slice(0, 19),
  })),
  city: {
    id: 745044,
    name: 'İstanbul',
    coord: { lat: 41.0082, lon: 28.9784 },
    timezone: 10_800,
    sunrise: 1_793_334_725,
    sunset: 1_793_372_595,
  },
});

/** OpenWeather /data/2.5/air_pollution/forecast: 96 hourly entries. */
const openWeatherAirForecast = () => ({
  coord: { lon: 28.9784, lat: 41.0082 },
  list: Array.from({ length: 96 }, (_, hour) => ({
    dt: (T0 + hour * HOUR) / 1_000,
    main: { aqi: 1 },
    components: {
      co: 186.65,
      no: 0,
      no2: hour === 2 ? 100 : 6.53,
      o3: 40.54,
      so2: 2.04,
      pm2_5: 5.78,
      pm10: 6.31,
      nh3: 0.91,
    },
  })),
});

const router = (routes: {
  met?: (url: URL) => unknown;
  forecast?: () => unknown;
  air?: () => unknown;
}) => {
  const requests: Request[] = [];
  const fetchImpl = (async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1]
  ) => {
    const url = new URL(String(input));
    requests.push({ url, headers: new Headers(init?.headers) });
    let body: unknown;
    if (url.hostname === 'api.met.no' && routes.met) body = routes.met(url);
    else if (url.pathname.endsWith('/forecast') && routes.forecast) body = routes.forecast();
    else if (url.pathname.endsWith('/air_pollution/forecast') && routes.air) body = routes.air();
    if (body === undefined) return new Response('not found', { status: 404 });
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  return { fetchImpl, requests };
};

const hourlyProvider = (fetchImpl: typeof fetch) =>
  new MetNorwayHourlyProvider(fetchImpl, {
    userAgent: USER_AGENT,
    openWeatherApiKey: 'k',
    openWeatherBaseUrl: 'https://api.openweathermap.org/data/2.5',
    now: () => new Date(T0 + 20 * 60_000),
  });

test('MET Norway hourly: identifies itself, trims coordinates and asks both sources once', async () => {
  const { fetchImpl, requests } = router({
    met: () => metForecast(),
    forecast: openWeatherForecast,
  });

  await hourlyProvider(fetchImpl).getHourly({ lat: 41.008237, lon: 28.978359, lang: 'tr' });

  const met = requests.filter(request => request.url.hostname === 'api.met.no');
  const owm = requests.filter(request => request.url.hostname === 'api.openweathermap.org');
  assert.equal(met.length, 1);
  assert.equal(owm.length, 1);
  assert.equal(met[0].url.pathname, '/weatherapi/locationforecast/2.0/complete');
  assert.equal(met[0].url.searchParams.get('lat'), '41.0082');
  assert.equal(met[0].url.searchParams.get('lon'), '28.9784');
  assert.equal(met[0].headers.get('user-agent'), USER_AGENT);
  assert.equal(owm[0].url.searchParams.get('appid'), 'k');
});

test('MET Norway hourly: 120 contiguous hours with temperature from MET and chance of rain from OpenWeather', async () => {
  const { fetchImpl } = router({ met: () => metForecast(), forecast: openWeatherForecast });

  const result = await hourlyProvider(fetchImpl).getHourly({
    lat: 41.0082,
    lon: 28.9784,
    lang: 'tr',
  });

  assert.equal(result.hourly.length, 120);
  assert.equal(result.hourly[0].time, new Date(T0).toISOString());
  for (let index = 1; index < result.hourly.length; index += 1) {
    assert.equal(
      Date.parse(result.hourly[index].time) - Date.parse(result.hourly[index - 1].time),
      HOUR,
      `hour ${index}`
    );
  }
  assert.equal(result.timezoneOffsetSeconds, 10_800);
  const h5 = result.hourly[5];
  assert.equal(h5.temp, Math.round((16 - Math.sin(5 / 4)) * 10) / 10);
  // OpenWeather slot 1 covers 03:00–06:00Z at 75 %. #1706: the value is a 3-hour step
  // probability and every hour says so, with the step it came from.
  assert.equal(h5.pop, 75);
  assert.equal(h5.popIntervalHours, 3);
  assert.equal(h5.popValidFrom, new Date(T0 + 3 * HOUR).toISOString());
  assert.equal(result.hourly[0].pop, 4);
  // #1776: gust and visibility are OpenWeather point values at the slot time only.
  assert.equal(result.hourly[3].windGust, 12.4);
  assert.equal(result.hourly[3].visibility, 4_000);
  assert.equal(result.hourly[4].windGust, undefined);
  assert.equal(h5.windGust, undefined);
  assert.equal(h5.visibility, undefined);
  assert.equal(h5.precipitationMm, 3.2);
  assert.equal(h5.sourceIntervalHours, 1);
  assert.equal(h5.interpolated, undefined);
  assert.equal(h5.humidity, 70);
  assert.equal(h5.dewPoint, 10.5);
  assert.equal(h5.windSpeed, 6);
  assert.equal(h5.weatherCode, weatherCodeForSymbol('heavyrainandthunder'));
  assert.match(h5.icon, /^11[dn]$/);
  assert.equal(result.hourly[6].weatherCode, weatherCodeForSymbol('rain'));
  for (const hour of result.hourly) {
    assert.ok(hour.pop >= 0 && hour.pop <= 100);
    assert.ok(typeof hour.isDay === 'boolean');
    assert.ok(hour.description.length > 0);
  }
});

test('MET Norway hourly: the 6-hourly tail is marked as interpolated and keeps its six-hour amount', async () => {
  const { fetchImpl } = router({
    met: () => metForecast({ temperature: hour => (hour < 64 ? 10 : 22) }),
    forecast: openWeatherForecast,
  });

  const result = await hourlyProvider(fetchImpl).getHourly({
    lat: 41.0082,
    lon: 28.9784,
    lang: 'en',
  });

  // Between 63 h (10 °C) and 66 h (22 °C) the values move monotonically inside the bracket.
  const tail = result.hourly.slice(63, 67).map(hour => hour.temp);
  assert.deepEqual(tail[0], 10);
  assert.deepEqual(tail[3], 22);
  assert.ok(tail[1] > 10 && tail[1] < 22 && tail[2] > tail[1] && tail[2] < 22);
  // #1707: hours between MET steps are filled, and say so; the native hourly part does not.
  assert.equal(result.hourly[10].interpolated, undefined);
  assert.equal(result.hourly[64].interpolated, true);
  assert.equal(result.hourly[66].interpolated, undefined, '66 h is a native MET step');
  assert.equal(result.hourly[67].interpolated, true);
  // A six-hour amount is not split into invented hourly amounts: the hours of the period carry
  // the period total and its length, and the hourly amount stays unknown.
  for (const hour of result.hourly.slice(66, 72)) {
    assert.equal(hour.precipitationMm, undefined, hour.time);
    assert.equal(hour.periodPrecipitationMm, 1.2, hour.time);
    assert.equal(hour.sourceIntervalHours, 6, hour.time);
  }
  // The daily total still adds up the six-hour amounts.
  const day = (result.daily ?? []).find(entry => entry.date === '2026-11-02');
  assert.ok(day && typeof day.precipitationMm === 'number' && day.precipitationMm > 0, 'day total');
});

test('MET Norway hourly: hours before the first OpenWeather step say whose probability they show', async () => {
  // OpenWeather's list starts at the next 3-hour boundary: at 01:20Z the first step is 03:00Z.
  const { fetchImpl } = router({
    met: () => metForecast(),
    forecast: () => {
      const body = openWeatherForecast();
      return { ...body, list: body.list.slice(1) };
    },
  });
  const result = await new MetNorwayHourlyProvider(fetchImpl, {
    userAgent: USER_AGENT,
    openWeatherApiKey: 'k',
    openWeatherBaseUrl: 'https://api.openweathermap.org/data/2.5',
    now: () => new Date(T0 + HOUR + 20 * 60_000),
  }).getHourly({ lat: 41.0082, lon: 28.9784, lang: 'tr' });

  const [first, second, third] = result.hourly;
  assert.equal(first.time, new Date(T0 + HOUR).toISOString());
  // #1706: the 01:00 and 02:00 rows take the 03:00 step's value, and name that step.
  assert.equal(first.pop, 75);
  assert.equal(first.popValidFrom, new Date(T0 + 3 * HOUR).toISOString());
  assert.equal(second.popValidFrom, new Date(T0 + 3 * HOUR).toISOString());
  // #1776: a future point value is not copied back into earlier hours.
  assert.equal(first.windGust, undefined);
  assert.equal(first.visibility, undefined);
  assert.equal(third.windGust, 12.4);
});

test('MET Norway hourly: day/night and daily sunrise/sunset come from the solar position', async () => {
  const { fetchImpl } = router({ met: () => metForecast(), forecast: openWeatherForecast });

  const result = await hourlyProvider(fetchImpl).getHourly({
    lat: 41.0082,
    lon: 28.9784,
    lang: 'tr',
  });

  // İstanbul, 30 Oct: sunrise ≈ 04:32Z, sunset ≈ 15:02Z.
  assert.equal(result.hourly[2].isDay, false);
  assert.equal(result.hourly[9].isDay, true);
  assert.equal(result.hourly[18].isDay, false);
  const daily = result.daily ?? [];
  assert.ok(daily.length >= 5);
  const first = daily[0];
  assert.ok(first.sunrise && first.sunset);
  const sunrise = Date.parse(first.sunrise as string);
  const sunset = Date.parse(first.sunset as string);
  assert.ok(
    Math.abs(sunrise - Date.UTC(2026, 9, 30, 4, 32)) < 6 * 60_000,
    `sunrise ${first.sunrise}`
  );
  assert.ok(Math.abs(sunset - Date.UTC(2026, 9, 30, 15, 2)) < 6 * 60_000, `sunset ${first.sunset}`);
  for (const day of daily) {
    assert.ok(day.tempMax >= day.tempMin);
    assert.ok(day.pop >= 0 && day.pop <= 100);
    assert.match(day.date, /^\d{4}-\d{2}-\d{2}/);
  }
  // The first local day carries the 75 % slot.
  assert.equal(first.pop, 75);
});

test('MET Norway hourly: UV is the clear-sky index damped by cloud, never above it', async () => {
  const { fetchImpl } = router({ met: () => metForecast(), forecast: openWeatherForecast });

  const result = await hourlyProvider(fetchImpl).getHourly({
    lat: 41.0082,
    lon: 28.9784,
    lang: 'tr',
  });

  const uv = result.hourly[9].uvIndex;
  assert.ok(typeof uv === 'number' && uv > 0 && uv <= 4, `uv ${uv}`);
  assert.equal(result.hourly[2].uvIndex ?? 0, 0);
});

test('MET Norway hourly: attribution names both sources; no chance of rain is invented without OpenWeather', async () => {
  const provider = hourlyProvider(router({ met: () => metForecast() }).fetchImpl);

  assert.match(provider.attribution ?? '', /MET Norway/);
  assert.match(provider.attribution ?? '', /OpenWeather/);
  // #1706: MET has no probability for Türkiye. Without OpenWeather the hourly forecast is
  // unavailable rather than showing a percentage made up from the amount.
  await assert.rejects(
    () => provider.getHourly({ lat: 41.0082, lon: 28.9784, lang: 'tr' }),
    (error: { statusCode?: number; code?: string }) =>
      error.statusCode === 502 && error.code === 'HOURLY_PRECIPITATION_PROBABILITY_UNAVAILABLE'
  );
});

test('MET symbol codes map onto the WMO codes the app already understands', () => {
  assert.equal(weatherCodeForSymbol('clearsky_day'), 0);
  assert.equal(weatherCodeForSymbol('fair_night'), 1);
  assert.equal(weatherCodeForSymbol('partlycloudy_day'), 2);
  assert.equal(weatherCodeForSymbol('cloudy'), 3);
  assert.equal(weatherCodeForSymbol('fog'), 45);
  assert.equal(weatherCodeForSymbol('lightrain'), 61);
  assert.equal(weatherCodeForSymbol('heavyrain'), 65);
  assert.equal(weatherCodeForSymbol('rainshowers_day'), 80);
  assert.equal(weatherCodeForSymbol('snow'), 73);
  // #1729: sleet is rain and snow mixed (WMO 68), not freezing rain.
  assert.equal(weatherCodeForSymbol('sleet'), 68);
  assert.equal(weatherCodeForSymbol('rainandthunder'), 95);
  // #1712 #1726: an unknown symbol stays unknown instead of becoming overcast.
  assert.equal(weatherCodeForSymbol('unknown_symbol'), null);
});

test('solar times match MET Norway sunrise/3.0 for İstanbul and Erzurum within five minutes', () => {
  const istanbul = sunTimes(41.0082, 28.9784, new Date(Date.UTC(2026, 9, 30, 12)));
  assert.ok(istanbul.sunrise && istanbul.sunset);
  assert.ok(Math.abs(istanbul.sunrise.getTime() - Date.UTC(2026, 9, 30, 4, 32)) < 5 * 60_000);
  const erzurum = sunTimes(39.9, 41.27, new Date(Date.UTC(2026, 5, 21, 12)));
  assert.ok(erzurum.sunrise && erzurum.sunset);
  // Erzurum, 21 June: sunrise 01:46Z, sunset 16:46Z (MET Norway sunrise/3.0 and NOAA agree).
  assert.ok(Math.abs(erzurum.sunrise.getTime() - Date.UTC(2026, 5, 21, 1, 46)) < 5 * 60_000);
  assert.ok(Math.abs(erzurum.sunset.getTime() - Date.UTC(2026, 5, 21, 16, 46)) < 5 * 60_000);
});

test('European AQI is computed from pollutant concentrations with the EEA bands', () => {
  // #1730: EEA bands revised in 2024. The index is the worst pollutant: PM2.5 5.78 µg/m³ in
  // 5–15 → 20–40 gives 22, above NO2 6.53 (13), O3 40.54 (14), PM10 6.31 (8) and SO2 2.04 (2).
  assert.equal(
    europeanAqiFromComponents({ pm2_5: 5.78, pm10: 6.31, no2: 6.53, o3: 40.54, so2: 2.04 }),
    22
  );
  assert.equal(europeanAqiFromComponents({ pm2_5: 5.78 }), 22);
  // NO2 100 µg/m³ is the top of 60–100 → 80 (poor), above every other pollutant here.
  const no2 = europeanAqiFromComponents({
    pm2_5: 5.78,
    pm10: 6.31,
    no2: 100,
    o3: 40.54,
    so2: 2.04,
  });
  assert.equal(no2, 80, `no2 ${no2}`);
  assert.equal(europeanAqiFromComponents({}), null);
});

test('OpenWeather air pollution forecast feeds the hourly European AQI', async () => {
  const { fetchImpl, requests } = router({ air: openWeatherAirForecast });
  const provider = new OpenWeatherAirQualityHourlyProvider(fetchImpl, {
    apiKey: 'k',
    baseUrl: 'https://api.openweathermap.org/data/2.5',
  });

  const result = await provider.getAirQualityHourly({ lat: 41.0082, lon: 28.9784 });

  assert.equal(requests[0].url.pathname, '/data/2.5/air_pollution/forecast');
  assert.equal(result.hourly.length, 96);
  assert.equal(result.hourly[0].europeanAqi, 22);
  assert.equal(result.hourly[0].pm25, 5.78);
  assert.ok(result.hourly[2].europeanAqi >= 80);
  assert.match(provider.attribution ?? '', /OpenWeather/);
});

test('MET Norway provinces: one identified request per province, bounded concurrency, layer readings', async () => {
  let inFlight = 0;
  let peak = 0;
  const requests: Request[] = [];
  const fetchImpl = (async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1]
  ) => {
    const url = new URL(String(input));
    requests.push({ url, headers: new Headers(init?.headers) });
    inFlight += 1;
    peak = Math.max(peak, inFlight);
    await new Promise(resolve => setTimeout(resolve, 5));
    inFlight -= 1;
    if (url.searchParams.get('lat') === '39.93') return new Response('boom', { status: 500 });
    return new Response(JSON.stringify(metForecast()), { status: 200 });
  }) as typeof fetch;
  const provider = new MetNorwayProvincesProvider(fetchImpl, {
    userAgent: USER_AGENT,
    concurrency: 4,
    now: () => new Date(T0 + 20 * 60_000),
  });
  const points = [
    { lat: 41.01, lon: 28.97 },
    { lat: 39.93, lon: 32.86 },
    ...Array.from({ length: 10 }, (_, index) => ({ lat: 37 + index * 0.3, lon: 30 + index })),
  ];

  const result = await provider.getCurrent(points);

  assert.equal(requests.length, points.length);
  assert.ok(peak <= 4, `peak concurrency ${peak}`);
  assert.ok(requests.every(request => request.headers.get('user-agent') === USER_AGENT));
  assert.equal(result.length, points.length);
  assert.equal(result[1], null);
  const istanbul = result[0];
  assert.ok(istanbul);
  assert.equal(istanbul.temperature, 16);
  assert.equal(istanbul.windSpeed, 6);
  assert.equal(istanbul.windDirection, 352);
  assert.equal(istanbul.cloudCover, 40);
  assert.equal(istanbul.precipitation, 0);
  assert.equal(typeof istanbul.isDay, 'boolean');
  assert.equal(istanbul.observedAt, new Date(T0).toISOString());
  // MET has no chance of rain: the field is absent rather than guessed.
  assert.equal('precipitationProbability' in istanbul, false);
  const outlook = istanbul.outlook ?? [];
  assert.deepEqual(
    outlook.map(point => point.hourOffset),
    [3, 6]
  );
  assert.equal(outlook[0].temperature, Math.round((16 - Math.sin(3 / 4)) * 10) / 10);
  assert.equal(typeof outlook[0].precipitation, 'number');
  assert.match(provider.attribution ?? '', /MET Norway/);
});

test('MET Norway context: UV from the forecast; dust, pollen and sea are honestly absent', async () => {
  const { fetchImpl, requests } = router({ met: () => metForecast() });
  const service = new MetNorwayContextService(fetchImpl, {
    userAgent: USER_AGENT,
    now: () => new Date(T0 + 20 * 60_000),
  });

  const result = await service.get(41.0082, 28.9784, true);

  assert.equal(requests.length, 1);
  assert.equal(result.provider, 'MET Norway');
  assert.match(result.attribution ?? '', /CC BY 4\.0/);
  assert.ok(
    typeof result.uvIndexMax === 'number' && result.uvIndexMax > 0 && result.uvIndexMax <= 4
  );
  assert.equal(result.dustMax, undefined);
  assert.equal(result.grassPollenMax, undefined);
  assert.equal(result.olivePollenMax, undefined);
  assert.equal(result.marine, undefined);
});

test('data sources default to the commercial-use set and keep Open-Meteo behind a switch', () => {
  const base = { NODE_ENV: 'test', OPENWEATHER_API_KEY: 'k' };
  const commercial = createDataSources(envSchema.parse(base));
  assert.equal(commercial.hourlyProvider.name, 'MET Norway');
  assert.equal(commercial.provincesProvider.name, 'MET Norway');
  assert.equal(commercial.airQualityHourlyProvider.name, 'OpenWeather');
  const openMeteo = createDataSources(
    envSchema.parse({ ...base, WEATHER_DATA_SOURCE: 'openmeteo' })
  );
  assert.equal(openMeteo.hourlyProvider.name, 'Open-Meteo');
  assert.equal(openMeteo.provincesProvider.name, 'Open-Meteo');
});
