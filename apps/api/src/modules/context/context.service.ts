import { z } from 'zod';
import { AppError } from '../../core/errors';

const airSchema = z.object({
  timezone: z.string().optional(),
  hourly_units: z.record(z.string(), z.string()).optional(),
  hourly: z.object({
    time: z.array(z.string()),
    uv_index: z.array(z.number().nullable()).optional(),
    dust: z.array(z.number().nullable()).optional(),
    grass_pollen: z.array(z.number().nullable()).optional(),
    olive_pollen: z.array(z.number().nullable()).optional(),
  }),
});

const marineSchema = z.object({
  current_units: z.record(z.string(), z.string()).optional(),
  current: z
    .object({
      time: z.string(),
      wave_height: z.number().nonnegative().nullable().optional(),
      wave_direction: z.number().min(0).max(360).nullable().optional(),
      wave_period: z.number().positive().nullable().optional(),
      sea_surface_temperature: z.number().nullable().optional(),
    })
    .optional(),
});

const HOUR_MS = 60 * 60_000;
const CONTEXT_WINDOW_HOURS = 24;

const GMT_MODEL_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})?$/;

export const parseGmtModelTime = (value: string): number => {
  if (typeof value !== 'string' || value.length === 0) return Number.NaN;

  const match = GMT_MODEL_TIME_PATTERN.exec(value);
  if (!match) return Number.NaN;

  const [, yearText, monthText, dayText, hourText, minuteText, secondText, fractionText, zone] =
    match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText ?? '0');
  const millisecond = Number((fractionText ?? '').padEnd(3, '0') || '0');

  if (
    month < 1 || month > 12 ||
    day < 1 || day > 31 ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return Number.NaN;
  }

  // Date.parse normalizes impossible calendar dates (for example, February 30) on some
  // runtimes. Validate the provider's wall-clock fields before parsing the absolute instant.
  const calendar = new Date(0);
  calendar.setUTCFullYear(year, month - 1, day);
  calendar.setUTCHours(hour, minute, second, millisecond);
  if (
    calendar.getUTCFullYear() !== year ||
    calendar.getUTCMonth() !== month - 1 ||
    calendar.getUTCDate() !== day ||
    calendar.getUTCHours() !== hour ||
    calendar.getUTCMinutes() !== minute ||
    calendar.getUTCSeconds() !== second ||
    calendar.getUTCMilliseconds() !== millisecond
  ) {
    return Number.NaN;
  }

  if (zone && zone !== 'Z') {
    const offset = /([+-])(\d{2}):(\d{2})$/.exec(zone);
    if (!offset) return Number.NaN;
    const offsetHours = Number(offset[2]);
    const offsetMinutes = Number(offset[3]);
    if (
      offsetHours > 14 ||
      offsetMinutes > 59 ||
      (offsetHours === 14 && offsetMinutes !== 0)
    ) {
      return Number.NaN;
    }
  }

  const timestamp = Date.parse(zone ? value : `${value}Z`);
  return Number.isFinite(timestamp) ? timestamp : Number.NaN;
};

export const finiteMaxForWindow = (
  times: string[],
  values?: Array<number | null>,
  now = new Date(),
  hours = 24
) => {
  const start = now.getTime();
  const end = start + hours * HOUR_MS;
  const filtered = (values ?? []).filter((value, index): value is number => {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return false;
    const time = parseGmtModelTime(times[index] ?? '');
    return Number.isFinite(time) && time >= start && time < end;
  });
  return filtered.length ? Math.max(...filtered) : undefined;
};

export interface ContextSignals {
  provider: 'Open-Meteo';
  fetchedAt: string;
  attribution: string;
  uvIndexMax?: number;
  dustMax?: number;
  grassPollenMax?: number;
  olivePollenMax?: number;
  units: {
    dust?: string;
    grassPollen?: string;
    olivePollen?: string;
    waveHeight?: string;
    waveDirection?: string;
    wavePeriod?: string;
    seaSurfaceTemperature?: string;
  };
  marine?: {
    observedAt: string;
    waveHeight?: number;
    waveDirection?: number;
    wavePeriod?: number;
    seaSurfaceTemperature?: number;
  };
}

const getJson = async (url: URL, fetchImpl: typeof fetch, timeoutMs = 8_000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {
      headers: { accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok)
      throw new AppError(
        502,
        'CONTEXT_PROVIDER_ERROR',
        'Ek hava bağlamı sağlayıcısı yanıt vermedi.'
      );
    return await response.json();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(502, 'CONTEXT_PROVIDER_ERROR', 'Ek hava bağlamı sağlayıcısına ulaşılamadı.');
  } finally {
    clearTimeout(timeout);
  }
};

interface OpenMeteoContextConfig {
  airQualityBaseUrl: string;
  marineBaseUrl: string;
  apiKey?: string;
}

const defaultOpenMeteoContextConfig: OpenMeteoContextConfig = {
  airQualityBaseUrl: 'https://air-quality-api.open-meteo.com',
  marineBaseUrl: 'https://marine-api.open-meteo.com',
};

export class ContextSignalsService {
  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly openMeteo: OpenMeteoContextConfig = defaultOpenMeteoContextConfig
  ) {}

  async get(lat: number, lon: number, includeMarine: boolean): Promise<ContextSignals> {
    const requestedAt = new Date();
    const airUrl = new URL('/v1/air-quality', this.openMeteo.airQualityBaseUrl);
    airUrl.searchParams.set('latitude', String(lat));
    airUrl.searchParams.set('longitude', String(lon));
    airUrl.searchParams.set('hourly', 'uv_index,dust,grass_pollen,olive_pollen');
    airUrl.searchParams.set('forecast_hours', '25');
    // Keep model timestamps unambiguous for the rolling 24-hour window. Open-Meteo's
    // `auto` timezone returns local wall-clock strings without an offset; GMT plus the
    // explicit parser above avoids shifting the window when the API host runs in UTC.
    airUrl.searchParams.set('timezone', 'GMT');
    if (this.openMeteo.apiKey) airUrl.searchParams.set('apikey', this.openMeteo.apiKey);

    const airPromise = getJson(airUrl, this.fetchImpl).then(data => {
      const parsedAir = airSchema.safeParse(data);
      if (!parsedAir.success) {
        throw new AppError(
          502,
          'INVALID_CONTEXT_PROVIDER_RESPONSE',
          'Ek hava bağlamı sağlayıcısı geçersiz veri döndürdü.'
        );
      }
      const air = parsedAir.data;
      const timelineLength = air.hourly.time.length;
      const modeledSeries = [
        air.hourly.uv_index,
        air.hourly.dust,
        air.hourly.grass_pollen,
        air.hourly.olive_pollen,
      ].filter((series): series is Array<number | null> => series !== undefined);
      const parsedTimes = air.hourly.time.map(parseGmtModelTime);
      const firstRequiredHour = Math.ceil(requestedAt.getTime() / HOUR_MS) * HOUR_MS;
      const lastRequiredHour =
        Math.floor((requestedAt.getTime() + CONTEXT_WINDOW_HOURS * HOUR_MS - 1) / HOUR_MS) * HOUR_MS;
      const timelineInvalid =
        parsedTimes.length === 0 ||
        parsedTimes.some(time => !Number.isFinite(time)) ||
        parsedTimes[0] > firstRequiredHour ||
        parsedTimes[parsedTimes.length - 1] < lastRequiredHour ||
        parsedTimes.some((time, index) => index > 0 && time - parsedTimes[index - 1] !== HOUR_MS);
      if (timelineInvalid || modeledSeries.some(series => series.length !== timelineLength)) {
        throw new AppError(
          502,
          'INVALID_CONTEXT_PROVIDER_RESPONSE',
          'Ek hava bağlamı sağlayıcısı tutarsız zaman serileri döndürdü.'
        );
      }
      return air;
    });
    const marinePromise = includeMarine
      ? (() => {
          const marineUrl = new URL('/v1/marine', this.openMeteo.marineBaseUrl);
          marineUrl.searchParams.set('latitude', String(lat));
          marineUrl.searchParams.set('longitude', String(lon));
          marineUrl.searchParams.set(
            'current',
            'wave_height,wave_direction,wave_period,sea_surface_temperature'
          );
          // Emit an unambiguous source timestamp; the frontend must not guess the provider's
          // location-local wall clock from the browser timezone.
          marineUrl.searchParams.set('timezone', 'GMT');
          if (this.openMeteo.apiKey) marineUrl.searchParams.set('apikey', this.openMeteo.apiKey);
          return getJson(marineUrl, this.fetchImpl)
            .then(data => marineSchema.parse(data))
            .catch(() => null);
        })()
      : Promise.resolve(null);

    const [air, marine] = await Promise.all([airPromise, marinePromise]);
    const marineObservedAtMs = marine?.current ? parseGmtModelTime(marine.current.time) : Number.NaN;
    const marineCurrent =
      marine?.current && Number.isFinite(marineObservedAtMs)
        ? {
            observedAt: new Date(marineObservedAtMs).toISOString(),
            waveHeight: marine.current.wave_height ?? undefined,
            waveDirection: marine.current.wave_direction ?? undefined,
            wavePeriod: marine.current.wave_period ?? undefined,
            seaSurfaceTemperature: marine.current.sea_surface_temperature ?? undefined,
          }
        : undefined;
    return {
      provider: 'Open-Meteo',
      fetchedAt: new Date().toISOString(),
      attribution: 'Open-Meteo · CC BY 4.0',
      uvIndexMax: finiteMaxForWindow(air.hourly.time, air.hourly.uv_index, requestedAt),
      dustMax: finiteMaxForWindow(air.hourly.time, air.hourly.dust, requestedAt),
      grassPollenMax: finiteMaxForWindow(air.hourly.time, air.hourly.grass_pollen, requestedAt),
      olivePollenMax: finiteMaxForWindow(air.hourly.time, air.hourly.olive_pollen, requestedAt),
      units: {
        dust: air.hourly_units?.dust,
        grassPollen: air.hourly_units?.grass_pollen,
        olivePollen: air.hourly_units?.olive_pollen,
        waveHeight: marine?.current_units?.wave_height,
        waveDirection: marine?.current_units?.wave_direction,
        wavePeriod: marine?.current_units?.wave_period,
        seaSurfaceTemperature: marine?.current_units?.sea_surface_temperature,
      },
      marine: marineCurrent,
    };
  }
}
