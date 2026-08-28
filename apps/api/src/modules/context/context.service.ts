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
      wave_height: z.number().nullable().optional(),
      wave_direction: z.number().nullable().optional(),
      wave_period: z.number().nullable().optional(),
      sea_surface_temperature: z.number().nullable().optional(),
    })
    .optional(),
});

export const parseGmtModelTime = (value: string): number => {
  if (!value) return Number.NaN;
  const hasExplicitZone = /(?:Z|[+-]\d{2}:\d{2})$/.test(value);
  return Date.parse(hasExplicitZone ? value : `${value}Z`);
};

export const finiteMaxForWindow = (
  times: string[],
  values?: Array<number | null>,
  now = new Date(),
  hours = 24
) => {
  const start = now.getTime();
  const end = start + hours * 60 * 60_000;
  const filtered = (values ?? []).filter((value, index): value is number => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return false;
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

export class ContextSignalsService {
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async get(lat: number, lon: number, includeMarine: boolean): Promise<ContextSignals> {
    const airUrl = new URL('https://air-quality-api.open-meteo.com/v1/air-quality');
    airUrl.searchParams.set('latitude', String(lat));
    airUrl.searchParams.set('longitude', String(lon));
    airUrl.searchParams.set('hourly', 'uv_index,dust,grass_pollen,olive_pollen');
    airUrl.searchParams.set('forecast_hours', '25');
    // Keep model timestamps unambiguous for the rolling 24-hour window. Open-Meteo's
    // `auto` timezone returns local wall-clock strings without an offset; GMT plus the
    // explicit parser above avoids shifting the window when the API host runs in UTC.
    airUrl.searchParams.set('timezone', 'GMT');

    const airPromise = getJson(airUrl, this.fetchImpl).then(data => airSchema.parse(data));
    const marinePromise = includeMarine
      ? (() => {
          const marineUrl = new URL('https://marine-api.open-meteo.com/v1/marine');
          marineUrl.searchParams.set('latitude', String(lat));
          marineUrl.searchParams.set('longitude', String(lon));
          marineUrl.searchParams.set(
            'current',
            'wave_height,wave_direction,wave_period,sea_surface_temperature'
          );
          marineUrl.searchParams.set('timezone', 'auto');
          return getJson(marineUrl, this.fetchImpl)
            .then(data => marineSchema.parse(data))
            .catch(() => null);
        })()
      : Promise.resolve(null);

    const [air, marine] = await Promise.all([airPromise, marinePromise]);
    return {
      provider: 'Open-Meteo',
      fetchedAt: new Date().toISOString(),
      attribution: 'Open-Meteo · CC BY 4.0',
      uvIndexMax: finiteMaxForWindow(air.hourly.time, air.hourly.uv_index),
      dustMax: finiteMaxForWindow(air.hourly.time, air.hourly.dust),
      grassPollenMax: finiteMaxForWindow(air.hourly.time, air.hourly.grass_pollen),
      olivePollenMax: finiteMaxForWindow(air.hourly.time, air.hourly.olive_pollen),
      units: {
        dust: air.hourly_units?.dust,
        grassPollen: air.hourly_units?.grass_pollen,
        olivePollen: air.hourly_units?.olive_pollen,
        waveHeight: marine?.current_units?.wave_height,
        waveDirection: marine?.current_units?.wave_direction,
        wavePeriod: marine?.current_units?.wave_period,
        seaSurfaceTemperature: marine?.current_units?.sea_surface_temperature,
      },
      marine: marine?.current
        ? {
            observedAt: marine.current.time,
            waveHeight: marine.current.wave_height ?? undefined,
            waveDirection: marine.current.wave_direction ?? undefined,
            wavePeriod: marine.current.wave_period ?? undefined,
            seaSurfaceTemperature: marine.current.sea_surface_temperature ?? undefined,
          }
        : undefined,
    };
  }
}
