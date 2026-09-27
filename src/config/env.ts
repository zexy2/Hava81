import { z } from 'zod';

const integerFromEnv = (fallback: number, min: number, max: number) =>
  z.preprocess(
    (value) => (value === undefined || value === '' ? fallback : Number(value)),
    z.number().int().min(min).max(max),
  );

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: integerFromEnv(4000, 1, 65_535),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  OPENWEATHER_API_KEY: z.string().min(1, 'OPENWEATHER_API_KEY is required'),
  OPENWEATHER_BASE_URL: z.url().default('https://api.openweathermap.org/data/2.5'),
  OPENWEATHER_TIMEOUT_MS: integerFromEnv(8_000, 500, 30_000),
  OPEN_METEO_FORECAST_BASE_URL: z.url().default('https://api.open-meteo.com'),
  OPEN_METEO_AIR_QUALITY_BASE_URL: z.url().default('https://air-quality-api.open-meteo.com'),
  OPEN_METEO_MARINE_BASE_URL: z.url().default('https://marine-api.open-meteo.com'),
  OPEN_METEO_API_KEY: z.string().min(1).optional(),
  OPENWEATHER_FALLBACK_API_KEY: z.string().min(1).optional(),
  OPENWEATHER_FALLBACK_BASE_URL: z.url().optional(),
  PROVIDER_RETRY_COUNT: integerFromEnv(1, 0, 5),
  PROVIDER_CIRCUIT_FAILURE_THRESHOLD: integerFromEnv(3, 1, 20),
  PROVIDER_CIRCUIT_RESET_MS: integerFromEnv(30_000, 1_000, 300_000),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((value) => value.split(',').map((origin) => origin.trim()).filter(Boolean)),
  RATE_LIMIT_MAX: integerFromEnv(60, 1, 10_000),
  CACHE_MAX_ENTRIES: integerFromEnv(500, 10, 10_000),
  CACHE_CURRENT_TTL_MS: integerFromEnv(300_000, 1_000, 3_600_000),
  CACHE_FORECAST_TTL_MS: integerFromEnv(1_800_000, 1_000, 21_600_000),
  CACHE_AIR_QUALITY_TTL_MS: integerFromEnv(900_000, 1_000, 3_600_000),
});

export type AppConfig = z.infer<typeof envSchema>;

export const parseEnv = (source: NodeJS.ProcessEnv = process.env): AppConfig => {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const summary = result.error.issues
      .map((issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`)
      .join('; ');

    throw new Error(`Invalid API environment: ${summary}`);
  }

  return result.data;
};
