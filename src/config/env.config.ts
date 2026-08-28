/** Browser configuration validated from Vite's public environment. */

type AppMode = 'development' | 'production' | 'test';

interface BrowserEnv {
  VITE_API_BASE_URL?: string;
  VITE_CACHE_TTL: number;
  VITE_MAX_RETRIES: number;
  VITE_ENABLE_ANALYTICS: boolean;
  MODE: AppMode;
}

const parsePositiveInteger = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseMode = (value: string): AppMode =>
  value === 'production' || value === 'test' || value === 'development' ? value : 'development';

const parseEnv = (): BrowserEnv => {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  return {
    VITE_API_BASE_URL: apiBaseUrl || undefined,
    VITE_CACHE_TTL: parsePositiveInteger(import.meta.env.VITE_CACHE_TTL, 300000),
    VITE_MAX_RETRIES: parsePositiveInteger(import.meta.env.VITE_MAX_RETRIES, 3),
    VITE_ENABLE_ANALYTICS: import.meta.env.VITE_ENABLE_ANALYTICS === 'true',
    MODE: parseMode(import.meta.env.MODE),
  };
};

const env = parseEnv();

export const config = {
  api: {
    baseUrl: env.VITE_API_BASE_URL || '/api/v1',
    timeout: 30000,
    maxRetries: env.VITE_MAX_RETRIES,
  },
  cache: {
    ttl: env.VITE_CACHE_TTL,
    staleTime: 60000,
  },
  features: {
    enableAnalytics: env.VITE_ENABLE_ANALYTICS,
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
