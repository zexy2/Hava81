import { z } from 'zod';

const MAX_CURRENT_WEATHER_OBSERVATION_FUTURE_SKEW_MS = 60_000;
const MAX_AIR_QUALITY_OBSERVATION_FUTURE_SKEW_MS = 60_000;

const coordinatesSchema = z.object({
  lon: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90),
});

const weatherConditionSchema = z.object({
  id: z.number(),
  main: z.string(),
  description: z.string(),
  icon: z.string().min(1),
});

const currentMainWeatherSchema = z.object({
  temp: z.number(),
  feels_like: z.number(),
  temp_min: z.number(),
  temp_max: z.number(),
  pressure: z.number().positive(),
  humidity: z.number().min(0).max(100),
});

const windSchema = z.object({
  speed: z.number().nonnegative(),
  deg: z.number().min(0).max(360),
  gust: z.number().nonnegative().optional(),
});

const cloudsSchema = z.object({ all: z.number().min(0).max(100) });

export const currentWeatherUpstreamSchema = z
  .object({
    coord: coordinatesSchema,
    weather: z.array(weatherConditionSchema).min(1),
    main: currentMainWeatherSchema,
    visibility: z.number().nonnegative().optional(),
    wind: windSchema,
    clouds: cloudsSchema,
    dt: z
      .number()
      .int()
      .nonnegative()
      .refine(
        (value) => value * 1_000 <= Date.now() + MAX_CURRENT_WEATHER_OBSERVATION_FUTURE_SKEW_MS,
        'Current-weather observation timestamp is materially in the future',
      ),
    sys: z.object({
      country: z.string(),
      sunrise: z.number().int().nonnegative(),
      sunset: z.number().int().nonnegative(),
    }),
    timezone: z.number().min(-43_200).max(50_400),
    id: z.number(),
    name: z.string(),
  })
  .refine((data) => data.main.temp_min <= data.main.temp_max, {
    message: 'Current-weather minimum temperature exceeds maximum temperature',
    path: ['main', 'temp_min'],
  });

// Forecast models occasionally overshoot relative humidity by a single percentage point
// because of interpolation/rounding. Keep current observations strict, but normalize a small
// forecast-only numerical overshoot instead of failing the entire multi-day forecast.
const forecastHumiditySchema = z
  .number()
  .min(0)
  .max(105)
  .transform((value) => Math.min(100, value));

const forecastMainWeatherSchema = currentMainWeatherSchema.extend({
  humidity: forecastHumiditySchema,
});

const forecastItemSchema = z.object({
  dt: z.number().int().nonnegative(),
  main: forecastMainWeatherSchema,
  weather: z.array(weatherConditionSchema).min(1),
  clouds: cloudsSchema,
  wind: windSchema,
  visibility: z.number().nonnegative().optional(),
  pop: z.number().min(0).max(1).default(0),
  dt_txt: z.string().min(1),
});

export const forecastUpstreamSchema = z.object({
  cod: z.union([z.string(), z.number()]),
  list: z.array(forecastItemSchema).min(1),
  city: z.object({
    id: z.number().optional(),
    name: z.string(),
    coord: coordinatesSchema,
    country: z.string(),
    timezone: z.number().min(-43_200).max(50_400).default(0),
  }),
});

export const airQualityUpstreamSchema = z.object({
  coord: coordinatesSchema,
  list: z
    .array(
      z.object({
        main: z.object({ aqi: z.number().int().min(1).max(5) }),
        components: z.object({
          co: z.number().nonnegative(),
          no: z.number().nonnegative(),
          no2: z.number().nonnegative(),
          o3: z.number().nonnegative(),
          so2: z.number().nonnegative(),
          pm2_5: z.number().nonnegative(),
          pm10: z.number().nonnegative(),
          nh3: z.number().nonnegative(),
        }),
        dt: z
          .number()
          .int()
          .nonnegative()
          .refine(
            (value) => value * 1_000 <= Date.now() + MAX_AIR_QUALITY_OBSERVATION_FUTURE_SKEW_MS,
            'Air-quality observation timestamp is materially in the future',
          ),
      }),
    )
    .min(1),
});

export type CurrentWeatherUpstream = z.infer<typeof currentWeatherUpstreamSchema>;
export type ForecastUpstream = z.infer<typeof forecastUpstreamSchema>;
export type AirQualityUpstream = z.infer<typeof airQualityUpstreamSchema>;
