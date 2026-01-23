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
  WeatherQueryParams,
  ForecastResponse,
  DailyForecast,
  HourlyForecast,
  AirQualityResponse,
  AirQuality,
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
    tempMin: Math.round(raw.main.temp_min),
    tempMax: Math.round(raw.main.temp_max),
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
    clouds: raw.clouds.all,
  };
};

const getAqiLabel = (aqi: number): string => {
  const labels = ['', 'İyi', 'Orta', 'Hassas', 'Sağlıksız', 'Çok Sağlıksız'];
  return labels[aqi] || 'Bilinmiyor';
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
          maximumAge: 300000,
        }
      );
    });
  },

  getForecast: async (lat: number, lon: number): Promise<{ daily: DailyForecast[]; hourly: HourlyForecast[] }> => {
    const response = await httpClient.get<ForecastResponse>(
      API_ENDPOINTS.weather.forecast,
      {
        lat,
        lon,
        appid: config.api.key,
        units: DEFAULT_WEATHER_PARAMS.units,
        lang: DEFAULT_WEATHER_PARAMS.lang,
      }
    );

    const hourly: HourlyForecast[] = response.list.slice(0, 8).map(item => ({
      time: new Date(item.dt * 1000),
      temp: Math.round(item.main.temp),
      icon: item.weather[0]?.icon ?? '01d',
      pop: Math.round(item.pop * 100),
    }));

    const dailyMap = new Map<string, ForecastResponse['list']>();
    response.list.forEach(item => {
      const dateKey = item.dt_txt.split(' ')[0];
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, []);
      }
      dailyMap.get(dateKey)!.push(item);
    });

    const daily: DailyForecast[] = Array.from(dailyMap.entries())
      .slice(0, 5)
      .map(([dateStr, items]) => {
        const temps = items.map(i => i.main.temp);
        const midday = items.find(i => i.dt_txt.includes('12:00')) || items[0];
        return {
          date: new Date(dateStr),
          tempMin: Math.round(Math.min(...temps)),
          tempMax: Math.round(Math.max(...temps)),
          icon: midday.weather[0]?.icon ?? '01d',
          description: midday.weather[0]?.description ?? '',
          pop: Math.round(Math.max(...items.map(i => i.pop)) * 100),
        };
      });

    return { daily, hourly };
  },

  getAirQuality: async (lat: number, lon: number): Promise<AirQuality> => {
    const response = await httpClient.get<AirQualityResponse>(
      '/air_pollution',
      {
        lat,
        lon,
        appid: config.api.key,
      }
    );

    const data = response.list[0];
    return {
      aqi: data.main.aqi,
      aqiLabel: getAqiLabel(data.main.aqi),
      pm25: data.components.pm2_5,
      pm10: data.components.pm10,
      o3: data.components.o3,
    };
  },
};
export default weatherService;
