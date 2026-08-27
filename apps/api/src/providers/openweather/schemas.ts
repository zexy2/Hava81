import { z } from 'zod';

const coordinatesSchema = z.object({
  lon: z.number(),
  lat: z.number(),
});

const weatherConditionSchema = z.object({
  id: z.number(),
  main: z.string(),
  description: z.string(),
  icon: z.string().min(1),
});

const mainWeatherSchema = z.object({
  temp: z.number(),
  feels_like: z.number(),
  temp_min: z.number(),
  temp_max: z.number(),
  pressure: z.number(),
  humidity: z.number(),
});

const windSchema = z.object({
  speed: z.number(),
  deg: z.number(),
  gust: z.number().optional(),
});

const cloudsSchema = z.object({ all: z.number() });

export const currentWeatherUpstreamSchema = z.object({
  coord: coordinatesSchema,
  weather: z.array(weatherConditionSchema).min(1),
  main: mainWeatherSchema,
  visibility: z.number(),
  wind: windSchema,
  clouds: cloudsSchema,
  dt: z.number(),
  sys: z.object({
    country: z.string(),
    sunrise: z.number(),
    sunset: z.number(),
  }),
  timezone: z.number(),
  id: z.number(),
  name: z.string(),
});

const forecastItemSchema = z.object({
  dt: z.number(),
  main: mainWeatherSchema,
  weather: z.array(weatherConditionSchema).min(1),
  clouds: cloudsSchema,
  wind: windSchema,
  visibility: z.number().optional(),
  pop: z.number().min(0).max(1).default(0),
  dt_txt: z.string().min(1),
});

export const forecastUpstreamSchema = z.object({
  cod: z.union([z.string(), z.number()]),
  list: z.array(forecastItemSchema),
  city: z.object({
    id: z.number().optional(),
    name: z.string(),
    coord: coordinatesSchema,
    country: z.string(),
    timezone: z.number().default(0),
  }),
});

export const airQualityUpstreamSchema = z.object({
  coord: coordinatesSchema,
  list: z
    .array(
      z.object({
        main: z.object({ aqi: z.number().int().min(1).max(5) }),
        components: z.object({
          co: z.number(),
          no: z.number(),
          no2: z.number(),
          o3: z.number(),
          so2: z.number(),
          pm2_5: z.number(),
          pm10: z.number(),
          nh3: z.number(),
        }),
        dt: z.number(),
      }),
    )
    .min(1),
});

export type CurrentWeatherUpstream = z.infer<typeof currentWeatherUpstreamSchema>;
export type ForecastUpstream = z.infer<typeof forecastUpstreamSchema>;
export type AirQualityUpstream = z.infer<typeof airQualityUpstreamSchema>;
