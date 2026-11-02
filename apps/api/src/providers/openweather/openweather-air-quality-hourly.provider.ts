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

// European Air Quality Index, EEA bands revised in 2024 (https://airindex.eea.europa.eu/AQI/;
// the same table Open-Meteo documents for `european_aqi`). Upper bounds in µg/m³ of hourly
// concentrations for index 20, 40, 60, 80 and 100.
const BANDS: Record<Pollutant, readonly number[]> = {
  pm2_5: [5, 15, 50, 90, 140],
  pm10: [15, 45, 120, 195, 270],
  no2: [10, 25, 60, 100, 150],
  o3: [60, 100, 120, 160, 180],
  so2: [20, 40, 125, 190, 275],
};
const INDEX_STEPS = [20, 40, 60, 80, 100] as const;

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
  // Extremely poor has no upper bound: keep rising at the slope of the last band, so the
  // index exceeds 100 instead of being clipped to it.
  const last = bands[bands.length - 1];
  const previous = bands[bands.length - 2];
  return 100 + ((concentration - last) / (last - previous)) * 20;
};

/**
 * European AQI from hourly concentrations: the worst pollutant's sub-index, linearly
 * interpolated inside its band; above 100 when a pollutant is extremely poor. `null` when no
 * pollutant is reported.
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

/**
 * Which pollutants a European AQI was computed from. The index is the worst pollutant, so a
 * missing one could be higher: anything short of all five is a partial, lower-bound value.
 */
export const europeanAqiCoverage = (
  components: Partial<Record<Pollutant, number | null | undefined>>
): { complete: boolean; pollutants: Pollutant[] } => {
  const pollutants = (Object.keys(BANDS) as Pollutant[]).filter(pollutant => {
    const value = components[pollutant];
    return typeof value === 'number' && Number.isFinite(value) && value >= 0;
  });
  return { complete: pollutants.length === Object.keys(BANDS).length, pollutants };
};

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
        const coverage = europeanAqiCoverage(entry.components);
        hourly.push({
          time: new Date(entry.dt * 1_000).toISOString(),
          europeanAqi,
          pm25: entry.components.pm2_5,
          ...(coverage.complete ? {} : { aqiPartial: true, aqiPollutants: coverage.pollutants }),
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
