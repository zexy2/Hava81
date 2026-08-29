/** Weather API service: browser -> Hava81 BFF only. */
import { httpClient } from './httpClient';
import { ApiError } from './errors/ApiError';
import { API_ENDPOINTS, DEFAULT_WEATHER_PARAMS } from '../config';
import { normalizePrecipitationProbability } from '../utils/precipitation';
import { ErrorCode } from '../types';
import type {
  NormalizedWeatherData,
  WeatherQueryParams,
  DailyForecast,
  HourlyForecast,
  AirQuality,
  ForecastMeta,
  WeatherDataMeta,
  ContextSignals,
  RouteWeatherResult,
} from '../types';

type SerializedMeta = Omit<WeatherDataMeta, 'fetchedAt'> & { fetchedAt: string };
type SerializedWeatherData = Omit<
  NormalizedWeatherData,
  'sunrise' | 'sunset' | 'timestamp' | 'meta'
> & {
  sunrise: string;
  sunset: string;
  timestamp: string;
  meta: SerializedMeta;
};

type SerializedForecast = {
  daily: Array<Omit<DailyForecast, 'date'> & { date: string }>;
  hourly: Array<Omit<HourlyForecast, 'time'> & { time: string }>;
  meta: Omit<ForecastMeta, 'fetchedAt'> & { fetchedAt: string };
};

type SerializedHourlyForecast = {
  daily?: Array<Omit<DailyForecast, 'date'> & { date: string }>;
  hourly: Array<Omit<HourlyForecast, 'time'> & { time: string }>;
  meta: Omit<ForecastMeta, 'fetchedAt'> & { fetchedAt: string };
};

type SerializedAirQuality = Omit<AirQuality, 'meta'> & { meta: SerializedMeta };

type BootstrapWeatherRequest = {
  city: string;
  lang: string;
  units: string;
  promise: Promise<SerializedWeatherData | null>;
};

declare global {
  interface Window {
    __HAVA81_BOOTSTRAP_WEATHER__?: BootstrapWeatherRequest;
  }
}

const invalidWeatherPayload = (field: string): never => {
  throw new ApiError('Hava verisi doğrulanamadı', ErrorCode.API_ERROR, {
    retryable: true,
    details: { field },
  });
};

const reviveWeatherDate = (value: string, field: string): Date => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return invalidWeatherPayload(field);
  return date;
};

const invalidForecastPayload = (field: string): never => {
  throw new ApiError('Tahmin verisi doğrulanamadı', ErrorCode.API_ERROR, {
    retryable: true,
    details: { field },
  });
};

const reviveForecastDate = (value: string, field: string, dateOnly = false): Date => {
  const date = new Date(dateOnly ? `${value}T12:00:00.000Z` : value);
  if (Number.isNaN(date.getTime())) return invalidForecastPayload(field);
  return date;
};

const normalizeBffPrecipitationProbability = (value: number, field: string): number => {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    return invalidForecastPayload(field);
  }
  return normalizePrecipitationProbability(value);
};

const cityKey = (value: string) => value.trim().toLocaleLowerCase('tr-TR');
const takeBootstrapWeather = (
  city: string,
  lang: string,
  units: string
): Promise<SerializedWeatherData | null> | null => {
  if (typeof window === 'undefined') return null;
  const bootstrap = window.__HAVA81_BOOTSTRAP_WEATHER__;
  if (
    !bootstrap ||
    cityKey(bootstrap.city) !== cityKey(city) ||
    bootstrap.lang !== lang ||
    bootstrap.units !== units
  ) {
    return null;
  }
  delete window.__HAVA81_BOOTSTRAP_WEATHER__;
  return bootstrap.promise;
};

const reviveMeta = (meta: SerializedMeta): WeatherDataMeta => ({
  ...meta,
  fetchedAt: reviveWeatherDate(meta.fetchedAt, 'current.meta.fetchedAt'),
});

const reviveWeatherDates = (data: SerializedWeatherData): NormalizedWeatherData => ({
  ...data,
  sunrise: reviveWeatherDate(data.sunrise, 'current.sunrise'),
  sunset: reviveWeatherDate(data.sunset, 'current.sunset'),
  timestamp: reviveWeatherDate(data.timestamp, 'current.timestamp'),
  meta: reviveMeta(data.meta),
});

export const weatherService = {
  getCurrentWeather: async (params: WeatherQueryParams): Promise<NormalizedWeatherData> => {
    const {
      city,
      units = DEFAULT_WEATHER_PARAMS.units,
      lang = DEFAULT_WEATHER_PARAMS.lang,
    } = params;

    if (!city.trim()) {
      throw new ApiError('Şehir adı gereklidir', undefined, { retryable: false });
    }

    try {
      const normalizedCity = city.trim();
      const bootstrapPromise = takeBootstrapWeather(normalizedCity, lang, units);
      const bootstrapResponse = bootstrapPromise ? await bootstrapPromise : null;
      const response =
        bootstrapResponse ??
        (await httpClient.get<SerializedWeatherData>(API_ENDPOINTS.weather.current, {
          city: normalizedCity,
          units,
          lang,
        }));
      return reviveWeatherDates(response);
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 404) {
        throw ApiError.cityNotFound(city);
      }
      throw error;
    }
  },

  getWeatherByCoords: async (
    lat: number,
    lon: number,
    lang = DEFAULT_WEATHER_PARAMS.lang
  ): Promise<NormalizedWeatherData> => {
    const response = await httpClient.get<SerializedWeatherData>(API_ENDPOINTS.weather.current, {
      lat,
      lon,
      units: DEFAULT_WEATHER_PARAMS.units,
      lang,
    });
    return reviveWeatherDates(response);
  },

  getCurrentLocationWeather: async (
    lang = DEFAULT_WEATHER_PARAMS.lang
  ): Promise<NormalizedWeatherData> =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new ApiError('Konum servisi desteklenmiyor', undefined, { retryable: false }));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async position => {
          try {
            resolve(
              await weatherService.getWeatherByCoords(
                position.coords.latitude,
                position.coords.longitude,
                lang
              )
            );
          } catch (error) {
            reject(error);
          }
        },
        error => {
          const messages: Record<number, string> = {
            1: 'Konum izni reddedildi',
            2: 'Konum bilgisi alınamadı',
            3: 'Konum isteği zaman aşımına uğradı',
          };
          reject(
            new ApiError(messages[error.code] || 'Konum hatası', undefined, { retryable: false })
          );
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
      );
    }),

  getForecast: async (
    lat: number,
    lon: number,
    lang = DEFAULT_WEATHER_PARAMS.lang
  ): Promise<{ daily: DailyForecast[]; hourly: HourlyForecast[]; meta: ForecastMeta }> => {
    const response = await httpClient.get<SerializedForecast>(API_ENDPOINTS.weather.forecast, {
      lat,
      lon,
      units: DEFAULT_WEATHER_PARAMS.units,
      lang,
    });

    return {
      daily: response.daily.map(item => ({
        ...item,
        // Noon UTC prevents a date-only forecast from shifting a calendar day in western/eastern clients.
        date: reviveForecastDate(item.date, 'forecast.daily.date', true),
        pop: normalizeBffPrecipitationProbability(item.pop, 'forecast.daily.pop'),
      })),
      hourly: response.hourly.slice(0, 8).map(item => ({
        ...item,
        time: reviveForecastDate(item.time, 'forecast.hourly.time'),
        pop: normalizeBffPrecipitationProbability(item.pop, 'forecast.hourly.pop'),
      })),
      meta: {
        ...response.meta,
        fetchedAt: reviveForecastDate(response.meta.fetchedAt, 'forecast.meta.fetchedAt'),
      },
    };
  },

  getHourlyForecast: async (
    lat: number,
    lon: number,
    lang = DEFAULT_WEATHER_PARAMS.lang
  ): Promise<{ daily?: DailyForecast[]; hourly: HourlyForecast[]; meta: ForecastMeta }> => {
    const response = await httpClient.get<SerializedHourlyForecast>(API_ENDPOINTS.weather.hourly, {
      lat,
      lon,
      lang,
    });
    return {
      ...(response.daily?.length
        ? {
            daily: response.daily.slice(0, 5).map(item => ({
              ...item,
              date: reviveForecastDate(item.date, 'hourly.daily.date', true),
              pop: normalizeBffPrecipitationProbability(item.pop, 'hourly.daily.pop'),
            })),
          }
        : {}),
      hourly: response.hourly.slice(0, 48).map(item => ({
        ...item,
        time: reviveForecastDate(item.time, 'hourly.hourly.time'),
        pop: normalizeBffPrecipitationProbability(item.pop, 'hourly.hourly.pop'),
      })),
      meta: {
        ...response.meta,
        fetchedAt: reviveForecastDate(response.meta.fetchedAt, 'hourly.meta.fetchedAt'),
      },
    };
  },

  getContextSignals: async (lat: number, lon: number, marine = false): Promise<ContextSignals> => {
    const response = await httpClient.get<
      Omit<ContextSignals, 'fetchedAt'> & { fetchedAt: string }
    >(API_ENDPOINTS.weather.context, { lat, lon, marine: marine ? 'true' : 'false' });
    return { ...response, fetchedAt: new Date(response.fetchedAt) };
  },

  getRouteWeather: async (
    origin: { lat: number; lon: number },
    destination: { lat: number; lon: number },
    departure: Date,
    lang = DEFAULT_WEATHER_PARAMS.lang
  ): Promise<RouteWeatherResult> =>
    httpClient.get<RouteWeatherResult>(API_ENDPOINTS.weather.route, {
      originLat: origin.lat,
      originLon: origin.lon,
      destinationLat: destination.lat,
      destinationLon: destination.lon,
      departure: departure.toISOString(),
      lang,
    }),

  getAirQuality: async (
    lat: number,
    lon: number,
    lang = DEFAULT_WEATHER_PARAMS.lang
  ): Promise<AirQuality> => {
    const response = await httpClient.get<SerializedAirQuality>(API_ENDPOINTS.weather.airQuality, {
      lat,
      lon,
      lang,
    });
    return { ...response, meta: reviveMeta(response.meta) };
  },
};

export default weatherService;
