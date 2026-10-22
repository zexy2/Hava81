import { z } from 'zod';
import type { CacheStatus } from '../../core/cache';
import { turkeyLatitudeSchema, turkeyLongitudeSchema } from '../../core/geo';

const latitudeSchema = turkeyLatitudeSchema;
const longitudeSchema = turkeyLongitudeSchema;
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

export const hourlyForecastQuerySchema = z.object({
  lat: latitudeSchema,
  lon: longitudeSchema,
  lang: languageSchema,
});

export const airQualityQuerySchema = z.object({
  lat: latitudeSchema,
  lon: longitudeSchema,
  lang: languageSchema,
});

export type CurrentWeatherQueryInput = z.infer<typeof currentWeatherQuerySchema>;
export type ForecastQueryInput = z.infer<typeof forecastQuerySchema>;
export type HourlyForecastQueryInput = z.infer<typeof hourlyForecastQuerySchema>;
export type AirQualityQueryInput = z.infer<typeof airQualityQuerySchema>;

export interface DataMetaDto {
  provider: string;
  fetchedAt: string;
  timezoneOffsetSeconds?: number;
  intervalHours?: number;
  attribution?: string;
  sourceUrl?: string;
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
  visibility?: number;
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

export interface HourlyForecastDto {
  daily?: Array<{
    date: string;
    tempMin: number;
    tempMax: number;
    icon: string;
    description: string;
    pop: number;
    precipitationMm?: number;
    /** ISO-8601 UTC instant of local sunrise (Open-Meteo); absent on polar days/nights. */
    sunrise?: string;
    /** ISO-8601 UTC instant of local sunset (Open-Meteo); absent on polar days/nights. */
    sunset?: string;
  }>;
  hourly: Array<{
    time: string;
    temp: number;
    icon: string;
    description: string;
    pop: number;
    windSpeed: number;
    apparentTemperature?: number;
    humidity?: number;
    precipitationMm?: number;
    windGust?: number;
    uvIndex?: number;
    visibility?: number;
    weatherCode?: number;
    /** True when the hour is in daylight (Open-Meteo `is_day`). */
    isDay?: boolean;
  }>;
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

export const BUNDLE_PARTS = ['current', 'forecast', 'hourly', 'airQuality', 'context'] as const;
export type BundlePart = (typeof BUNDLE_PARTS)[number];

export const bundleQuerySchema = z.object({
  lat: latitudeSchema,
  lon: longitudeSchema,
  units: unitsSchema,
  lang: languageSchema,
  marine: z
    .enum(['true', 'false'])
    .optional()
    .default('false')
    .transform(value => value === 'true'),
  include: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((value, context): BundlePart[] => {
      if (!value) return [...BUNDLE_PARTS];
      const parts = Array.from(new Set(value.split(',').map(part => part.trim()).filter(Boolean)));
      const unknown = parts.filter(part => !(BUNDLE_PARTS as readonly string[]).includes(part));
      if (unknown.length > 0 || parts.length === 0) {
        context.addIssue({
          code: 'custom',
          message: `include yalnızca şunları içerebilir: ${BUNDLE_PARTS.join(', ')}`,
        });
        return z.NEVER;
      }
      return parts as BundlePart[];
    }),
});

export type BundleQueryInput = z.infer<typeof bundleQuerySchema>;
