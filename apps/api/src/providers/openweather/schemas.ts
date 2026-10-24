import { z } from 'zod';

const MAX_CURRENT_WEATHER_OBSERVATION_FUTURE_SKEW_MS = 60_000;
const MAX_AIR_QUALITY_OBSERVATION_FUTURE_SKEW_MS = 60_000;
// OpenWeather documents all Air Pollution API component concentrations in μg/m³.
// This deliberately generous ceiling is a payload-sanity guard, not an AQI or health threshold.
const MAX_AIR_QUALITY_COMPONENT_UG_M3 = 100_000;
const airQualityComponentSchema = z.number().min(0).max(MAX_AIR_QUALITY_COMPONENT_UG_M3);
// Guard every provider Unix-seconds field before downstream Date(...).toISOString() calls.
const MAX_DATE_UNIX_SECONDS = 8_640_000_000_000;
const providerUnixTimestampSchema = z.number().int().nonnegative().max(MAX_DATE_UNIX_SECONDS);

const coordinatesSchema = z.object({
  lon: z.number().min(-180).max(180),
  lat: z.number().min(-90).max(90),
});

const nonBlankProviderTextSchema = z
  .string()
  .refine((value) => value.trim().length > 0, 'Provider text must not be blank');

const weatherConditionSchema = z.object({
  id: z.number(),
  main: nonBlankProviderTextSchema,
  description: nonBlankProviderTextSchema,
  icon: z.string().regex(/^(?:0[1-4]|09|10|11|13|50)[dn]$/),
});

// The provider schema is shared by metric (°C), imperial (°F), and standard (K) queries.
// Use a deliberately broad cross-unit physical envelope so malformed finite values cannot
// become plausible-looking guidance without rejecting real terrestrial temperatures.
const providerTemperatureSchema = z.number().min(-150).max(400);

const currentMainWeatherSchema = z.object({
  temp: providerTemperatureSchema,
  feels_like: providerTemperatureSchema,
  temp_min: providerTemperatureSchema,
  temp_max: providerTemperatureSchema,
  // OpenWeather reports surface pressure in hPa; use a broad terrestrial envelope.
  pressure: z.number().min(100).max(1_200),
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
    visibility: z.number().min(0).max(10_000).optional(),
    wind: windSchema,
    clouds: cloudsSchema,
    dt: providerUnixTimestampSchema.refine(
        (value) => value * 1_000 <= Date.now() + MAX_CURRENT_WEATHER_OBSERVATION_FUTURE_SKEW_MS,
        'Current-weather observation timestamp is materially in the future',
      ),
    sys: z.object({
      country: nonBlankProviderTextSchema,
      sunrise: providerUnixTimestampSchema,
      sunset: providerUnixTimestampSchema,
    }),
    timezone: z.number().min(-43_200).max(50_400),
    id: z.number(),
    name: nonBlankProviderTextSchema,
  })
  .refine((data) => data.main.temp_min <= data.main.temp_max, {
    message: 'Current-weather minimum temperature exceeds maximum temperature',
    path: ['main', 'temp_min'],
  })
  .refine((data) => data.sys.sunrise <= data.sys.sunset, {
    message: 'Current-weather sunset precedes sunrise',
    path: ['sys', 'sunset'],
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

const forecastItemSchema = z
  .object({
    dt: providerUnixTimestampSchema,
    main: forecastMainWeatherSchema,
    weather: z.array(weatherConditionSchema).min(1),
    clouds: cloudsSchema,
    wind: windSchema,
    visibility: z.number().min(0).max(10_000).optional(),
    // Missing precipitation probability is unknown, not a zero-percent rain chance.
    pop: z.number().min(0).max(1),
    dt_txt: z.string().min(1),
  })
  .refine((item) => item.main.temp_min <= item.main.temp_max, {
    message: 'Forecast minimum temperature exceeds maximum temperature',
    path: ['main', 'temp_min'],
  });

export const forecastUpstreamSchema = z.object({
  cod: z.union([z.string(), z.number()]),
  list: z.array(forecastItemSchema).min(1),
  city: z.object({
    id: z.number().optional(),
    name: nonBlankProviderTextSchema,
    coord: coordinatesSchema,
    country: nonBlankProviderTextSchema,
    timezone: z.number().min(-43_200).max(50_400),
  }),
});

export const airQualityUpstreamSchema = z.object({
  coord: coordinatesSchema,
  list: z
    .array(
      z.object({
        main: z.object({ aqi: z.number().int().min(1).max(5) }),
        components: z.object({
          co: airQualityComponentSchema,
          no: airQualityComponentSchema,
          no2: airQualityComponentSchema,
          o3: airQualityComponentSchema,
          so2: airQualityComponentSchema,
          pm2_5: airQualityComponentSchema,
          pm10: airQualityComponentSchema,
          nh3: airQualityComponentSchema,
        }),
        dt: providerUnixTimestampSchema.refine(
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
