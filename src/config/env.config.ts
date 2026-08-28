/** Browser configuration validated from Vite's public environment. */
import { z } from 'zod';

const envSchema = z.object({
  VITE_API_BASE_URL: z.string().min(1).optional(),
  VITE_CACHE_TTL: z
    .string()
    .optional()
    .transform(value => (value ? Number.parseInt(value, 10) : 300000)),
  VITE_MAX_RETRIES: z
    .string()
    .optional()
    .transform(value => (value ? Number.parseInt(value, 10) : 3)),
  VITE_ENABLE_ANALYTICS: z
    .string()
    .optional()
    .transform(value => value === 'true'),
  MODE: z.enum(['development', 'production', 'test']).catch('development'),
});

type BrowserEnv = z.infer<typeof envSchema>;

const parseEnv = (): BrowserEnv => {
  const result = envSchema.safeParse({
    VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL,
    VITE_CACHE_TTL: import.meta.env.VITE_CACHE_TTL,
    VITE_MAX_RETRIES: import.meta.env.VITE_MAX_RETRIES,
    VITE_ENABLE_ANALYTICS: import.meta.env.VITE_ENABLE_ANALYTICS,
    MODE: import.meta.env.MODE,
  });
  if (!result.success) {
    console.error('Environment validation failed:', result.error.flatten().fieldErrors);
    return { MODE: import.meta.env.MODE as BrowserEnv['MODE'] } as BrowserEnv;
  }
  return result.data;
};

const env = parseEnv();

export const config = {
  api: {
    baseUrl: env.VITE_API_BASE_URL || '/api/v1',
    timeout: 30000,
    maxRetries: env.VITE_MAX_RETRIES || 3,
  },
  cache: {
    ttl: env.VITE_CACHE_TTL || 300000,
    staleTime: 60000,
  },
  features: {
    enableAnalytics: env.VITE_ENABLE_ANALYTICS || false,
    enableOfflineMode: false,
  },
  app: {
    name: 'Hava81',
    version: '2.1.0',
    environment: env.MODE,
    isDevelopment: env.MODE === 'development',
    isProduction: env.MODE === 'production',
    isTest: env.MODE === 'test',
  },
} as const;

export type AppConfig = typeof config;

export const validateConfig = (): boolean => Boolean(config.api.baseUrl);
export default config;
