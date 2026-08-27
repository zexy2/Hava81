/** Weather API service: browser -> Hava81 BFF only. */
import { httpClient } from './httpClient';
import { ApiError } from './errors/ApiError';
import { API_ENDPOINTS, DEFAULT_WEATHER_PARAMS } from '../config';
import { normalizePrecipitationProbability } from '../utils/precipitation';
import type {
  NormalizedWeatherData,
  WeatherQueryParams,
  DailyForecast,
  HourlyForecast,
  AirQuality,
  ForecastMeta,
  WeatherDataMeta,
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

type SerializedAirQuality = Omit<AirQuality, 'meta'> & { meta: SerializedMeta };

const reviveMeta = (meta: SerializedMeta): WeatherDataMeta => ({
  ...meta,
  fetchedAt: new Date(meta.fetchedAt),
});

const reviveWeatherDates = (data: SerializedWeatherData): NormalizedWeatherData => ({
  ...data,
  sunrise: new Date(data.sunrise),
  sunset: new Date(data.sunset),
  timestamp: new Date(data.timestamp),
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
      const response = await httpClient.get<SerializedWeatherData>(API_ENDPOINTS.weather.current, {
        city: city.trim(),
        units,
        lang,
      });
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
        date: new Date(`${item.date}T12:00:00.000Z`),
        pop: normalizePrecipitationProbability(item.pop),
      })),
      hourly: response.hourly.map(item => ({
        ...item,
        time: new Date(item.time),
        pop: normalizePrecipitationProbability(item.pop),
      })),
      meta: {
        ...response.meta,
        fetchedAt: new Date(response.meta.fetchedAt),
      },
    };
  },

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
