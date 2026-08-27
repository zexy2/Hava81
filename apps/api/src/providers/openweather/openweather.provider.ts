import type { ZodType } from 'zod';
import type { AppConfig } from '../../config/env';
import { AppError } from '../../core/errors';
import type {
  AirQualityQuery,
  CurrentWeatherQuery,
  ForecastQuery,
  WeatherProvider,
} from '../weather-provider';
import {
  airQualityUpstreamSchema,
  currentWeatherUpstreamSchema,
  forecastUpstreamSchema,
  type AirQualityUpstream,
  type CurrentWeatherUpstream,
  type ForecastUpstream,
} from './schemas';

type FetchImplementation = typeof fetch;

export class OpenWeatherProvider implements WeatherProvider {
  readonly name: string;
  private readonly baseUrl: string;

  constructor(
    private readonly config: Pick<
      AppConfig,
      'OPENWEATHER_API_KEY' | 'OPENWEATHER_BASE_URL' | 'OPENWEATHER_TIMEOUT_MS'
    >,
    private readonly fetchImpl: FetchImplementation = fetch,
    name = 'OpenWeather',
  ) {
    this.name = name;
    this.baseUrl = config.OPENWEATHER_BASE_URL.replace(/\/$/, '');
  }

  getCurrent(query: CurrentWeatherQuery): Promise<CurrentWeatherUpstream> {
    const params: Record<string, string | number> = {
      appid: this.config.OPENWEATHER_API_KEY,
      units: query.units,
      lang: query.lang,
    };

    if ('city' in query) {
      params.q = query.city.includes(',') ? query.city : `${query.city},TR`;
    } else {
      params.lat = query.lat;
      params.lon = query.lon;
    }

    return this.request('/weather', params, currentWeatherUpstreamSchema);
  }

  getForecast(query: ForecastQuery): Promise<ForecastUpstream> {
    return this.request(
      '/forecast',
      {
        lat: query.lat,
        lon: query.lon,
        appid: this.config.OPENWEATHER_API_KEY,
        units: query.units,
        lang: query.lang,
      },
      forecastUpstreamSchema,
    );
  }

  getAirQuality(query: AirQualityQuery): Promise<AirQualityUpstream> {
    return this.request(
      '/air_pollution',
      {
        lat: query.lat,
        lon: query.lon,
        appid: this.config.OPENWEATHER_API_KEY,
      },
      airQualityUpstreamSchema,
    );
  }

  private async request<T>(
    path: string,
    params: Record<string, string | number>,
    schema: ZodType<T>,
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.OPENWEATHER_TIMEOUT_MS);

    try {
      const response = await this.fetchImpl(url, {
        headers: { accept: 'application/json' },
        signal: controller.signal,
      });
      const payload: unknown = await response.json().catch(() => null);

      if (!response.ok) {
        if (response.status === 404) {
          throw new AppError(404, 'LOCATION_NOT_FOUND', 'Şehir bulunamadı.');
        }

        const statusCode = response.status === 429 ? 503 : 502;
        throw new AppError(
          statusCode,
          response.status === 429 ? 'PROVIDER_RATE_LIMITED' : 'PROVIDER_ERROR',
          'Hava durumu sağlayıcısına şu anda ulaşılamıyor.',
        );
      }

      const parsed = schema.safeParse(payload);
      if (!parsed.success) {
        throw new AppError(
          502,
          'INVALID_PROVIDER_RESPONSE',
          'Hava durumu sağlayıcısı beklenmeyen bir cevap döndürdü.',
          parsed.error.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        );
      }

      return parsed.data;
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      if (controller.signal.aborted) {
        throw new AppError(504, 'PROVIDER_TIMEOUT', 'Hava durumu sağlayıcısı zaman aşımına uğradı.');
      }

      throw new AppError(
        503,
        'PROVIDER_UNAVAILABLE',
        'Hava durumu sağlayıcısına bağlanılamadı.',
        undefined,
        { cause: error },
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
