/**
 * Weather API Service
 * Handles all weather-related API calls
 */

import { httpClient } from './httpClient';
import { ApiError } from './errors/ApiError';
import { config, API_ENDPOINTS, DEFAULT_WEATHER_PARAMS } from '../config';
import type { 
  WeatherResponse, 
  NormalizedWeatherData, 
  WeatherQueryParams 
} from '../types';

/**
 * Normalize raw API response to UI-friendly format
 */
const normalizeWeatherData = (raw: WeatherResponse): NormalizedWeatherData => {
  const [primaryWeather] = raw.weather;
  
  return {
    cityName: raw.name,
    country: raw.sys.country,
    temperature: Math.round(raw.main.temp),
    feelsLike: Math.round(raw.main.feels_like),
    humidity: raw.main.humidity,
    pressure: raw.main.pressure,
    visibility: raw.visibility,
    windSpeed: raw.wind.speed,
    windDirection: raw.wind.deg,
    description: primaryWeather?.description ?? 'Bilgi yok',
    icon: primaryWeather?.icon ?? '01d',
    sunrise: new Date(raw.sys.sunrise * 1000),
    sunset: new Date(raw.sys.sunset * 1000),
    timestamp: new Date(raw.dt * 1000),
    coordinates: raw.coord,
  };
};

/**
 * Weather API Service
 */
export const weatherService = {
  /**
   * Get current weather for a city
   */
  getCurrentWeather: async (
    params: WeatherQueryParams
  ): Promise<NormalizedWeatherData> => {
    const { city, units = DEFAULT_WEATHER_PARAMS.units, lang = DEFAULT_WEATHER_PARAMS.lang } = params;

    if (!city.trim()) {
      throw new ApiError('Şehir adı gereklidir', undefined, { retryable: false });
    }

    if (!config.api.key) {
      throw new ApiError(
        'API anahtarı yapılandırılmamış. Lütfen .env dosyasını kontrol edin.',
        undefined,
        { retryable: false }
      );
    }

    try {
      // Add ,TR to ensure we get Turkish cities (e.g., "Adana,TR" instead of "Ada,US")
      const cityQuery = `${city.trim()},TR`;
      
      const response = await httpClient.get<WeatherResponse>(
        API_ENDPOINTS.weather.current,
        {
          q: cityQuery,
          appid: config.api.key,
          units,
          lang,
        }
      );

      return normalizeWeatherData(response);
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
  getWeatherByCoords: async (
    lat: number,
    lon: number
  ): Promise<NormalizedWeatherData> => {
    if (!config.api.key) {
      throw new ApiError(
        'API anahtarı yapılandırılmamış',
        undefined,
        { retryable: false }
      );
    }

    const response = await httpClient.get<WeatherResponse>(
      `${config.api.baseUrl}${API_ENDPOINTS.weather.current}`,
      {
        lat,
        lon,
        appid: config.api.key,
        units: DEFAULT_WEATHER_PARAMS.units,
        lang: DEFAULT_WEATHER_PARAMS.lang,
      }
    );

    return normalizeWeatherData(response);
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
        async (position) => {
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
        (error) => {
          const messages: Record<number, string> = {
            1: 'Konum izni reddedildi',
            2: 'Konum bilgisi alınamadı',
            3: 'Konum isteği zaman aşımına uğradı',
          };
          reject(new ApiError(messages[error.code] || 'Konum hatası', undefined, { retryable: false }));
        },
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000, // 5 minutes cache
        }
      );
    });
  },
};

export default weatherService;
