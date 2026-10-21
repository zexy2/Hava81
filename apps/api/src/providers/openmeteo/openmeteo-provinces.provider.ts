import { z } from 'zod';
import { AppError } from '../../core/errors';

export interface ProvincePoint {
  readonly lat: number;
  readonly lon: number;
}

export interface ProvinceCurrentObservation {
  /** Sıcaklık, °C. */
  temperature: number;
  weatherCode: number;
  isDay: boolean;
  /** Rüzgâr hızı, m/s. */
  windSpeed?: number;
  /** Gözlem zamanı (ISO 8601, UTC). */
  observedAt: string;
}

/** 81 il gibi çok sayıda nokta için tek upstream çağrısıyla güncel durum getirir. */
export interface ProvinceCurrentProvider {
  readonly name: string;
  readonly attribution?: string;
  getCurrent(points: readonly ProvincePoint[]): Promise<Array<ProvinceCurrentObservation | null>>;
}

const nullableNumber = z.number().nullable().optional();
const locationSchema = z.object({
  current: z
    .object({
      time: z.number().int().nonnegative(),
      temperature_2m: nullableNumber,
      weather_code: nullableNumber,
      is_day: nullableNumber,
      wind_speed_10m: nullableNumber,
    })
    .optional(),
});

/**
 * Open-Meteo birden çok koordinatı virgülle ayrılmış tek istekte kabul eder ve her
 * konum için bir nesne içeren dizi döndürür. 81 il = 1 HTTP isteği (Open-Meteo
 * kotasında konum başına sayılır; bu yüzden sonuç uzun süre cache'lenir).
 */
export class OpenMeteoProvincesProvider implements ProvinceCurrentProvider {
  readonly name = 'Open-Meteo';
  readonly attribution = 'Open-Meteo · CC BY 4.0';

  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = 8_000,
    private readonly baseUrl = 'https://api.open-meteo.com',
    private readonly apiKey?: string,
  ) {}

  async getCurrent(points: readonly ProvincePoint[]): Promise<Array<ProvinceCurrentObservation | null>> {
    if (points.length === 0) return [];
    const url = new URL('/v1/forecast', this.baseUrl);
    url.searchParams.set('latitude', points.map(point => String(point.lat)).join(','));
    url.searchParams.set('longitude', points.map(point => String(point.lon)).join(','));
    url.searchParams.set('current', 'temperature_2m,weather_code,is_day,wind_speed_10m');
    url.searchParams.set('timeformat', 'unixtime');
    url.searchParams.set('timezone', 'GMT');
    url.searchParams.set('temperature_unit', 'celsius');
    url.searchParams.set('wind_speed_unit', 'ms');
    if (this.apiKey) url.searchParams.set('apikey', this.apiKey);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, {
        headers: { accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new AppError(502, 'PROVINCES_PROVIDER_ERROR', 'İl sıcaklıkları sağlayıcısı yanıt vermedi.');
      }
      const body: unknown = await response.json();
      // Tek konum istendiğinde Open-Meteo dizi yerine tek nesne döndürür.
      const list = Array.isArray(body) ? body : [body];
      const parsed = z.array(locationSchema).safeParse(list);
      if (!parsed.success || parsed.data.length !== points.length) {
        throw new AppError(
          502,
          'INVALID_PROVINCES_PROVIDER_RESPONSE',
          'İl sıcaklıkları sağlayıcısı beklenmeyen bir cevap döndürdü.',
        );
      }
      return parsed.data.map(location => {
        const current = location.current;
        const temperature = current?.temperature_2m;
        const code = current?.weather_code;
        if (
          !current ||
          typeof temperature !== 'number' ||
          !Number.isFinite(temperature) ||
          temperature < -100 ||
          temperature > 100 ||
          typeof code !== 'number' ||
          !Number.isInteger(code)
        ) {
          return null;
        }
        const wind = current.wind_speed_10m;
        return {
          temperature: Math.round(temperature * 10) / 10,
          weatherCode: code,
          isDay: current.is_day !== 0,
          ...(typeof wind === 'number' && Number.isFinite(wind) && wind >= 0 ? { windSpeed: wind } : {}),
          observedAt: new Date(current.time * 1_000).toISOString(),
        };
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (controller.signal.aborted) {
        throw new AppError(504, 'PROVINCES_PROVIDER_TIMEOUT', 'İl sıcaklıkları sağlayıcısı zaman aşımına uğradı.');
      }
      throw new AppError(502, 'PROVINCES_PROVIDER_ERROR', 'İl sıcaklıkları sağlayıcısına ulaşılamadı.');
    } finally {
      clearTimeout(timeout);
    }
  }
}
