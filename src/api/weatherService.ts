/**
 * Weather API Service
 * Handles all weather-related API calls
 */

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
} from '../types';

type SerializedWeatherData = Omit<NormalizedWeatherData, 'sunrise' | 'sunset' | 'timestamp'> & {
  sunrise: string;
  sunset: string;
  timestamp: string;
};

type SerializedForecast = {
  daily: Array<Omit<DailyForecast, 'date'> & { date: string }>;
  hourly: Array<Omit<HourlyForecast, 'time'> & { time: string }>;
};

const reviveWeatherDates = (data: SerializedWeatherData): NormalizedWeatherData => ({
  ...data,
  sunrise: new Date(data.sunrise),
  sunset: new Date(data.sunset),
  timestamp: new Date(data.timestamp),
});

/**
 * Weather API Service
 */
export const weatherService = {
  /**
   * Get current weather for a city
   */
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
      // Transform 404 to user-friendly city not found error
      if (error instanceof ApiError && error.statusCode === 404) {
        throw ApiError.cityNotFound(city);
      }
      throw error;
    }
  },

  /**
   * Get weather by coordinates
   */
  getWeatherByCoords: async (lat: number, lon: number): Promise<NormalizedWeatherData> => {
    const response = await httpClient.get<SerializedWeatherData>(API_ENDPOINTS.weather.current, {
      lat,
      lon,
      units: DEFAULT_WEATHER_PARAMS.units,
      lang: DEFAULT_WEATHER_PARAMS.lang,
    });

    return reviveWeatherDates(response);
  },

  /**
   * Get user's current location weather
   */
  getCurrentLocationWeather: async (): Promise<NormalizedWeatherData> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new ApiError('Konum servisi desteklenmiyor', undefined, { retryable: false }));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async position => {
          try {
            const weather = await weatherService.getWeatherByCoords(
              position.coords.latitude,
              position.coords.longitude
            );
            resolve(weather);
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
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000,
        }
      );
    });
  },

  getForecast: async (
    lat: number,
    lon: number,
    lang = DEFAULT_WEATHER_PARAMS.lang
  ): Promise<{ daily: DailyForecast[]; hourly: HourlyForecast[] }> => {
    const response = await httpClient.get<SerializedForecast>(API_ENDPOINTS.weather.forecast, {
      lat,
      lon,
      units: DEFAULT_WEATHER_PARAMS.units,
      lang,
    });

    return {
      daily: response.daily.map(item => ({
        ...item,
        date: new Date(item.date),
        pop: normalizePrecipitationProbability(item.pop),
      })),
      hourly: response.hourly.map(item => ({
        ...item,
        time: new Date(item.time),
        pop: normalizePrecipitationProbability(item.pop),
      })),
    };
  },

  getAirQuality: async (
    lat: number,
    lon: number,
    lang = DEFAULT_WEATHER_PARAMS.lang
  ): Promise<AirQuality> => {
    return httpClient.get<AirQuality>(API_ENDPOINTS.weather.airQuality, {
      lat,
      lon,
      lang,
    });
  },
};
export default weatherService;
