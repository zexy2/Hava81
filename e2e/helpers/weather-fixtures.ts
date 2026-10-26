import type { Page, Route } from '@playwright/test';

/**
 * Deterministic API fixtures shared by every Hava81 e2e spec.
 *
 * `createWeatherFixtures(now)` builds the same payloads the former
 * smoke.spec.ts used, anchored to `now`. The default export (`fixtures`) is
 * anchored to the real clock like before; visual tests pass a fixed instant
 * and also freeze the browser clock (see `VISUAL_FIXED_NOW`).
 */
export function createWeatherFixtures(now = Date.now()) {
  const isoAtHour = (offsetHours: number) =>
    new Date(now + offsetHours * 60 * 60_000).toISOString();
  const localDate = (offsetDays = 0) =>
    new Date(now + 3 * 60 * 60_000 + offsetDays * 24 * 60 * 60_000).toISOString().slice(0, 10);
  const locationDateKey = (date: Date) =>
    new Date(date.getTime() + 3 * 60 * 60_000).toISOString().slice(0, 10);
  const locationTime = (hour: number, minute = 0) => {
    const [year, month, day] = localDate().split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day, hour - 3, minute));
  };
  const todayAtLocation = localDate();
  const sunriseCandidate = new Date(now - 6 * 60 * 60_000);
  const sunrise =
    locationDateKey(sunriseCandidate) === todayAtLocation
      ? sunriseCandidate
      : locationTime(6);
  const sunsetCandidate = new Date(now + 6 * 60 * 60_000);
  const sunset =
    locationDateKey(sunsetCandidate) === todayAtLocation && sunsetCandidate > sunrise
      ? sunsetCandidate
      : locationTime(19, 30);
  const nowIso = new Date(now).toISOString();

  const current = {
    cityName: 'İstanbul',
    country: 'TR',
    temperature: 23,
    feelsLike: 23,
    tempMin: 19,
    tempMax: 27,
    humidity: 58,
    pressure: 1012,
    visibility: 10000,
    windSpeed: 4.2,
    windDirection: 180,
    description: 'açık',
    icon: '01d',
    sunrise: sunrise.toISOString(),
    sunset: sunset.toISOString(),
    timestamp: isoAtHour(0),
    coordinates: { lat: 41.01, lon: 28.97 },
    clouds: 5,
    meta: {
      provider: 'OpenWeather',
      fetchedAt: nowIso,
      timezoneOffsetSeconds: 10800,
      cacheStatus: 'MISS',
      freshForSeconds: 60,
    },
  };

  const forecast = {
    daily: [
      { date: localDate(), tempMin: 19, tempMax: 27, icon: '01d', description: 'açık', pop: 10 },
    ],
    hourly: [
      { time: isoAtHour(1), temp: 23, icon: '01d', description: 'açık', pop: 10, windSpeed: 4 },
      { time: isoAtHour(4), temp: 26, icon: '01d', description: 'açık', pop: 5, windSpeed: 5 },
    ],
    meta: {
      provider: 'OpenWeather',
      fetchedAt: nowIso,
      timezoneOffsetSeconds: 10800,
      intervalHours: 3,
      cacheStatus: 'MISS',
      freshForSeconds: 300,
    },
  };

  const hourlyForecast = {
    // Normal Open-Meteo hourly success carries the same-provider daily series too.
    // Tests that customize daily evidence should override both endpoints together.
    daily: forecast.daily,
    // Starts at the next full hour after `now` (09:00 for VISUAL_FIXED_NOW): the decision layer
    // drops forecast steps that already ended, so a fixed calendar date would be all "past".
    hourly: Array.from({ length: 24 }, (_, index) => ({
      time: new Date(
        Math.ceil(now / (60 * 60_000)) * 60 * 60_000 + index * 60 * 60_000
      ).toISOString(),
      temp: 22 - Math.floor(index / 6),
      icon: index < 3 ? '01d' : '02n',
      description: index < 3 ? 'açık' : 'çoğunlukla açık',
      pop: index === 4 ? 45 : 10,
      precipitationMm: index === 4 ? 0.2 : 0,
      windSpeed: 3 + index * 0.05,
    })),
    meta: {
      provider: 'Open-Meteo',
      attribution: 'Open-Meteo · CC BY 4.0',
      sourceUrl: 'https://open-meteo.com/',
      fetchedAt: nowIso,
      timezoneOffsetSeconds: 10800,
      intervalHours: 1,
      cacheStatus: 'MISS',
      freshForSeconds: 300,
    },
  };

  const air = {
    aqi: 2,
    aqiLabel: 'Orta',
    pm25: 9,
    pm10: 14,
    o3: 42,
    meta: { provider: 'OpenWeather', fetchedAt: nowIso, cacheStatus: 'MISS', freshForSeconds: 120 },
  };

  const context = {
    provider: 'Open-Meteo',
    fetchedAt: nowIso,
    attribution: 'Open-Meteo · CC BY 4.0',
    uvIndexMax: 7.1,
    dustMax: 12,
    grassPollenMax: 4,
    olivePollenMax: 1,
    units: {
      dust: 'μg/m³',
      grassPollen: 'grains/m³',
      olivePollen: 'grains/m³',
      waveHeight: 'm',
      seaSurfaceTemperature: '°C',
    },
    marine: { observedAt: nowIso, waveHeight: 0.3, seaSurfaceTemperature: 24.8 },
  };

  const routeDurationMinutes = 331;
  const routeResult = {
    kind: 'corridor-estimate',
    estimatedDistanceKm: 413,
    estimatedDurationMinutes: routeDurationMinutes,
    requestedDeparture: nowIso,
    score: 84,
    segments: [0, 0.25, 0.5, 0.75, 1].map((fraction, index) => ({
      fraction,
      lat: 41 - index * 0.25,
      lon: 29 + index * 0.9,
      eta: new Date(now + routeDurationMinutes * 60_000 * fraction).toISOString(),
      temperature: 22 + index,
      precipitationProbability: index === 2 ? 30 : 5,
      windSpeed: 4 + index,
      description: index === 2 ? 'hafif yağmur' : 'açık',
      score: index === 2 ? 70 : 88,
      risk: index === 2 ? 'caution' : 'low',
    })),
    disclaimer: 'Bu sonuç gerçek yol/navigasyon rotası değildir.',
  };

  /** Hourly series whose hours start one hour after `now` (needed by commute/routine tests). */
  const hourlyFromNow = () => ({
    ...hourlyForecast,
    hourly: Array.from({ length: 24 }, (_, index) => ({
      ...hourlyForecast.hourly[index],
      time: isoAtHour(index + 1),
    })),
  });

  /**
   * Plan v3 (P1.1): the API now serves five days (120 h) of hourly data with dew point and
   * sunshine. Same first 24 hours as `hourlyForecast`, extended with a mild diurnal cycle.
   */
  const hourlyForecast120 = () => ({
    ...hourlyForecast,
    hourly: Array.from({ length: 120 }, (_, index) => {
      const time = new Date(Date.parse('2026-08-28T09:00:00.000Z') + index * 60 * 60_000);
      const localHour = (time.getUTCHours() + 3) % 24;
      const isDay = localHour >= 7 && localHour < 20;
      const base =
        index < 24
          ? hourlyForecast.hourly[index]
          : {
              temp: 20 + Math.round(5 * Math.sin(((localHour - 9) / 24) * 2 * Math.PI)),
              icon: isDay ? '01d' : '01n',
              description: 'açık',
              pop: 10,
              precipitationMm: 0,
              windSpeed: 3,
            };
      return {
        ...base,
        time: time.toISOString(),
        isDay,
        dewPoint: 12,
        sunshineDuration: isDay ? 3000 : 0,
      };
    }),
  });

  /** Local HH:MM in İstanbul `offsetHours` after `now`. */
  const localClockAt = (offsetHours: number) =>
    new Date(now + current.meta.timezoneOffsetSeconds * 1000 + offsetHours * 60 * 60_000)
      .toISOString()
      .slice(11, 16);

  return {
    now,
    isoAtHour,
    localDate,
    current,
    forecast,
    hourlyForecast,
    air,
    context,
    routeResult,
    hourlyFromNow,
    hourlyForecast120,
    localClockAt,
  };
}

export type WeatherFixtures = ReturnType<typeof createWeatherFixtures>;

/** Default fixtures, anchored to the real clock (same semantics as the old smoke file). */
export const fixtures = createWeatherFixtures();

/** Fixed instant for screenshot tests: 2026-08-28 11:30 in İstanbul, aligned with the hourly fixture. */
export const VISUAL_FIXED_NOW = Date.parse('2026-08-28T08:30:00.000Z');

export const API = {
  current: '**/api/v1/weather/current**',
  forecast: '**/api/v1/weather/forecast**',
  hourly: '**/api/v1/weather/hourly**',
  air: '**/api/v1/weather/air-quality**',
  context: '**/api/v1/weather/context**',
  route: '**/api/v1/weather/route**',
  bundle: '**/api/v1/weather/bundle**',
  provinces: '**/api/v1/weather/provinces**',
} as const;

/** Bugünkü canlı API'deki gibi "rota yok" yanıtı (bundle/provinces henüz deploy edilmemiş). */
const ROUTE_NOT_FOUND = {
  error: { code: 'ROUTE_NOT_FOUND', message: 'İstenen API rotası bulunamadı.', requestId: 'e2e' },
};

/** Mocks every weather endpoint with the given fixtures. */
export async function mockWeatherApi(page: Page, data: WeatherFixtures = fixtures) {
  await page.route(API.current, route => route.fulfill({ json: data.current }));
  await page.route(API.forecast, route => route.fulfill({ json: data.forecast }));
  await page.route(API.hourly, route => route.fulfill({ json: data.hourlyForecast }));
  await page.route(API.air, route => route.fulfill({ json: data.air }));
  await page.route(API.context, route => route.fulfill({ json: data.context }));
  await page.route(API.route, route => route.fulfill({ json: data.routeResult }));
  // Faz 3.2: varsayılan olarak bundle ve 81 il uç noktası yokmuş gibi (eski API) davran;
  // istemci tekil isteklere düşer ve mevcut uç nokta bazlı override'lar çalışmaya devam eder.
  // Yeni yolu test etmek için `mockBundleApi` / `mockProvincesApi` kullan.
  await mockNewEndpointsMissing(page);
}

/**
 * Faz 3.2: `/weather/bundle` ve `/weather/provinces` için bugünkü canlı API gibi 404 döner.
 * Kendi `page.route` mock'larını kuran spec'ler bunu çağırmalı; aksi halde bu istekler
 * mock'lanmadan preview sunucusunun `/api` proxy'sine (127.0.0.1:4000) gider.
 */
export async function mockNewEndpointsMissing(page: Page) {
  await page.route(API.bundle, route => route.fulfill({ status: 404, json: ROUTE_NOT_FOUND }));
  await page.route(API.provinces, route => route.fulfill({ status: 404, json: ROUTE_NOT_FOUND }));
}

/** `/weather/bundle`'ı fixture'lardan, istenen parçalarla (include) sunar. */
export async function mockBundleApi(page: Page, data: WeatherFixtures = fixtures) {
  const parts: Record<string, unknown> = {
    current: data.current,
    forecast: data.forecast,
    hourly: data.hourlyForecast,
    airQuality: data.air,
    context: data.context,
  };
  await overrideApi(page, 'bundle', route => {
    const include = new URL(route.request().url()).searchParams.get('include');
    const requested = include ? include.split(',') : Object.keys(parts);
    const body: Record<string, unknown> = Object.fromEntries(
      requested.map(part => [part, parts[part] ?? null])
    );
    return route.fulfill({
      json: { ...body, errors: {}, meta: { fetchedAt: new Date().toISOString(), parts: requested } },
    });
  });
}

/** `/weather/provinces`'i 81 ilin canlı sıcaklığı için verilen değerlerle sunar. */
export async function mockProvincesApi(
  page: Page,
  provinces: Array<{ plate: number; name: string; lat: number; lon: number; temperature: number }>
) {
  const observedAt = new Date(Date.now() - 10 * 60_000).toISOString();
  await overrideApiJson(page, 'provinces', {
    provinces: provinces.map(province => ({
      ...province,
      weatherCode: 0,
      icon: '01d',
      description: 'açık',
      windSpeed: 2,
      observedAt,
    })),
    meta: {
      provider: 'Open-Meteo',
      attribution: 'Open-Meteo · CC BY 4.0',
      fetchedAt: new Date().toISOString(),
      units: 'metric',
      total: 81,
    },
  });
}

/** Replaces one endpoint mock (unroute + route). */
export async function overrideApi(
  page: Page,
  endpoint: keyof typeof API,
  handler: (route: Route) => Promise<void> | void
) {
  await page.unroute(API[endpoint]);
  await page.route(API[endpoint], handler);
}

/** Replaces one endpoint with a static JSON body (optionally with an HTTP status). */
export async function overrideApiJson(
  page: Page,
  endpoint: keyof typeof API,
  json: unknown,
  status = 200
) {
  await overrideApi(page, endpoint, route => route.fulfill({ status, json }));
}

/** Uses the given daily series for both the OpenWeather forecast and the Open-Meteo hourly payload. */
export async function overrideDaily(
  page: Page,
  daily: unknown[],
  data: WeatherFixtures = fixtures
) {
  await overrideApiJson(page, 'forecast', { ...data.forecast, daily });
  await overrideApiJson(page, 'hourly', { ...data.hourlyForecast, daily });
}

type UserSettings = {
  temperatureUnit?: 'metric' | 'imperial';
  windSpeedUnit?: string;
  themeMode?: 'light' | 'dark' | 'system';
  language?: 'tr' | 'en';
  notificationsEnabled?: boolean;
};

/** Seeds `user-settings` before the app boots. */
export async function seedSettings(page: Page, settings: UserSettings) {
  await page.addInitScript(
    value => {
      localStorage.setItem('user-settings', JSON.stringify(value));
    },
    {
      temperatureUnit: 'metric',
      windSpeedUnit: 'ms',
      themeMode: 'light',
      language: 'tr',
      ...settings,
    }
  );
}

export type Favorite = { name: string; lat?: number; lon?: number };

export const TWO_FAVORITES: Favorite[] = [
  { name: 'İstanbul', lat: 41.01, lon: 28.97 },
  { name: 'İzmir', lat: 38.42, lon: 27.14 },
];

/** Seeds saved cities before the app boots. */
export async function seedFavorites(page: Page, favorites: Favorite[]) {
  await page.addInitScript(value => {
    localStorage.setItem('favorites', JSON.stringify(value));
  }, favorites);
}

/** Valid 1x1 PNG used to answer map tile requests without any external host. */
export const TILE_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==',
  'base64'
);

/** Answers both OSM tile hosts (primary `hot`, backup `osmde`) with a local PNG. */
export async function mockMapTiles(page: Page) {
  await page.route('**/hot/**', route =>
    route.fulfill({ status: 200, contentType: 'image/png', body: TILE_PNG })
  );
  await page.route('**/tiles/osmde/**', route =>
    route.fulfill({ status: 200, contentType: 'image/png', body: TILE_PNG })
  );
}
