import { z } from 'zod';
import type { CacheStatus } from '../../core/cache';

const latitudeSchema = z.coerce.number().min(-90).max(90);
const longitudeSchema = z.coerce.number().min(-180).max(180);
const unitsSchema = z.enum(['metric', 'imperial', 'standard']).default('metric');
const languageSchema = z.enum(['tr', 'en']).default('tr');

export const currentWeatherQuerySchema = z
  .object({
    city: z.string().trim().min(1).max(80).optional(),
    lat: latitudeSchema.optional(),
    lon: longitudeSchema.optional(),
    units: unitsSchema,
    lang: languageSchema,
  })
  .superRefine((query, context) => {
    const hasCity = query.city !== undefined;
    const hasLat = query.lat !== undefined;
    const hasLon = query.lon !== undefined;

    if (hasLat !== hasLon) {
      context.addIssue({
        code: 'custom',
        path: hasLat ? ['lon'] : ['lat'],
        message: 'lat ve lon birlikte gönderilmelidir.',
      });
    }

    if (hasCity === (hasLat && hasLon)) {
      context.addIssue({
        code: 'custom',
        message: 'city veya lat/lon seçeneklerinden yalnızca biri gönderilmelidir.',
      });
    }
  });

export const forecastQuerySchema = z.object({
  lat: latitudeSchema,
  lon: longitudeSchema,
  units: unitsSchema,
  lang: languageSchema,
});

export const airQualityQuerySchema = z.object({
  lat: latitudeSchema,
  lon: longitudeSchema,
  lang: languageSchema,
});

export type CurrentWeatherQueryInput = z.infer<typeof currentWeatherQuerySchema>;
export type ForecastQueryInput = z.infer<typeof forecastQuerySchema>;
export type AirQualityQueryInput = z.infer<typeof airQualityQuerySchema>;

export interface DataMetaDto {
  provider: string;
  fetchedAt: string;
  timezoneOffsetSeconds?: number;
  intervalHours?: number;
  cacheStatus?: CacheStatus;
  freshForSeconds?: number;
}

export interface CurrentWeatherDto {
  cityName: string;
  country: string;
  temperature: number;
  feelsLike: number;
  tempMin: number;
  tempMax: number;
  humidity: number;
  pressure: number;
  visibility: number;
  windSpeed: number;
  windDirection: number;
  description: string;
  icon: string;
  sunrise: string;
  sunset: string;
  timestamp: string;
  coordinates: { lat: number; lon: number };
  clouds: number;
  meta: DataMetaDto;
}

export interface ForecastDto {
  daily: Array<{
    date: string;
    tempMin: number;
    tempMax: number;
    icon: string;
    description: string;
    pop: number;
  }>;
  hourly: Array<{
    time: string;
    temp: number;
    icon: string;
    description: string;
    pop: number;
    windSpeed: number;
  }>;
  meta: DataMetaDto;
}

export interface AirQualityDto {
  aqi: number;
  aqiLabel: string;
  pm25: number;
  pm10: number;
  o3: number;
  meta: DataMetaDto;
}
