import { z } from 'zod';
import { AppError } from '../../core/errors';
import type {
  AirQualityHourlyProvider,
  AirQualityHourlyProviderResult,
  CoordinateQuery,
} from '../weather-provider';

// OpenWeather Air Pollution API, forecast endpoint (free plan, commercial use allowed):
// https://openweathermap.org/api/air-pollution. It reports concentrations in µg/m³ plus its
// own 1–5 index; the app speaks the European AQI (0–100+), so it is computed here.

const DEFAULT_TIMEOUT_MS = 8_000;
export const OPENWEATHER_ATTRIBUTION = 'Weather data provided by OpenWeather';
export const OPENWEATHER_SOURCE_URL = 'https://openweathermap.org/';

type Pollutant = 'pm2_5' | 'pm10' | 'no2' | 'o3' | 'so2';

// European Air Quality Index bands (EEA; the same breakpoints Open-Meteo's `european_aqi`
// uses), µg/m³ upper bounds for index 20, 40, 60, 80, 100 and the extremely-poor ceiling.
const BANDS: Record<Pollutant, readonly number[]> = {
  pm2_5: [10, 20, 25, 50, 75, 800],
  pm10: [20, 40, 50, 100, 150, 1_200],
  no2: [40, 90, 120, 230, 340, 1_000],
  o3: [50, 100, 130, 240, 380, 800],
  so2: [100, 200, 350, 500, 750, 1_250],
};
const INDEX_STEPS = [20, 40, 60, 80, 100, 200] as const;

const subIndex = (pollutant: Pollutant, concentration: number) => {
  const bands = BANDS[pollutant];
  let lower = 0;
  let lowerIndex = 0;
  for (let band = 0; band < bands.length; band += 1) {
    const upper = bands[band];
    const upperIndex = INDEX_STEPS[band];
    if (concentration <= upper) {
      return lowerIndex + ((concentration - lower) / (upper - lower)) * (upperIndex - lowerIndex);
    }
    lower = upper;
    lowerIndex = upperIndex;
  }
  return INDEX_STEPS[INDEX_STEPS.length - 1];
};

/**
 * European AQI from hourly concentrations: the worst pollutant's sub-index, linearly
 * interpolated inside its band. `null` when no pollutant is reported.
 */
export function europeanAqiFromComponents(components: Record<Pollutant, number>): number;
export function europeanAqiFromComponents(
  components: Partial<Record<Pollutant, number | null | undefined>>
): number | null;
export function europeanAqiFromComponents(
  components: Partial<Record<Pollutant, number | null | undefined>>
): number | null {
  let worst: number | null = null;
  for (const pollutant of Object.keys(BANDS) as Pollutant[]) {
    const value = components[pollutant];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) continue;
    const index = subIndex(pollutant, value);
    worst = worst === null ? index : Math.max(worst, index);
  }
  return worst === null ? null : Math.round(worst);
}

const concentration = z.number().finite().min(0).max(100_000).optional();
const airForecastSchema = z.object({
  list: z.array(
    z.object({
      dt: z.number().int().nonnegative(),
      components: z.object({
        pm2_5: concentration,
        pm10: concentration,
        no2: concentration,
        o3: concentration,
        so2: concentration,
      }),
    })
  ),
});

export interface OpenWeatherAirQualityOptions {
  apiKey: string;
  baseUrl: string;
  timeoutMs?: number;
}

export class OpenWeatherAirQualityHourlyProvider implements AirQualityHourlyProvider {
  readonly name = 'OpenWeather';
  readonly attribution = OPENWEATHER_ATTRIBUTION;
  readonly sourceUrl = OPENWEATHER_SOURCE_URL;

  constructor(
    private readonly fetchImpl: typeof fetch,
    private readonly options: OpenWeatherAirQualityOptions
  ) {}

  async getAirQualityHourly(query: CoordinateQuery): Promise<AirQualityHourlyProviderResult> {
    const url = new URL(`${this.options.baseUrl.replace(/\/+$/, '')}/air_pollution/forecast`);
    url.searchParams.set('lat', String(query.lat));
    url.searchParams.set('lon', String(query.lon));
    url.searchParams.set('appid', this.options.apiKey);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    try {
      const response = await this.fetchImpl(url, {
        headers: { accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new AppError(502, 'AIR_QUALITY_PROVIDER_ERROR', 'Hava kalitesi sağlayıcısı yanıt vermedi.');
      }
      const parsed = airForecastSchema.safeParse(await response.json());
      if (!parsed.success) {
        throw new AppError(
          502,
          'INVALID_AIR_QUALITY_PROVIDER_RESPONSE',
          'Hava kalitesi sağlayıcısı beklenmeyen bir cevap döndürdü.'
        );
      }
      const hourly: AirQualityHourlyProviderResult['hourly'] = [];
      for (const entry of parsed.data.list) {
        const europeanAqi = europeanAqiFromComponents(entry.components);
        if (europeanAqi === null) continue;
        hourly.push({
          time: new Date(entry.dt * 1_000).toISOString(),
          europeanAqi,
          pm25: entry.components.pm2_5,
        });
      }
      return { hourly };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(502, 'AIR_QUALITY_PROVIDER_ERROR', 'Hava kalitesi sağlayıcısına ulaşılamadı.');
    } finally {
      clearTimeout(timeout);
    }
  }
}
