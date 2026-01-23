/**
 * Environment Configuration
 * Centralized, validated configuration management
 */

import { z } from 'zod';

// Environment schema with validation
const envSchema = z.object({
  REACT_APP_OPENWEATHER_KEY: z.string().min(1, 'OpenWeather API key is required'),
  REACT_APP_API_BASE_URL: z.string().url().optional(),
  REACT_APP_CACHE_TTL: z.string().optional().transform(val => val ? parseInt(val, 10) : 300000),
  REACT_APP_MAX_RETRIES: z.string().optional().transform(val => val ? parseInt(val, 10) : 3),
  REACT_APP_ENABLE_ANALYTICS: z.string().optional().transform(val => val === 'true'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

type EnvConfig = z.infer<typeof envSchema>;

// Parse and validate environment
const parseEnv = (): EnvConfig => {
  const result = envSchema.safeParse(process.env);
  
  if (!result.success) {
    const errors = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`);
    console.error('Environment validation failed:');
    errors.forEach(err => console.error(`  - ${err}`));
    
    // In development, we want to see the error but not crash
    if (process.env.NODE_ENV === 'development') {
      console.warn('Running with invalid config in development mode');
    }
  }
  
  return result.success ? result.data : (process.env as unknown as EnvConfig);
};

const env = parseEnv();

// Application configuration
export const config = {
  api: {
    // In development, use relative URL to leverage CRA proxy
    // In production, use the full API URL
    baseUrl: process.env.NODE_ENV === 'development' 
      ? '/data/2.5' 
      : (process.env.REACT_APP_API_BASE_URL || 'https://api.openweathermap.org/data/2.5'),
    key: process.env.REACT_APP_OPENWEATHER_KEY || '',
    timeout: 30000, // Increased timeout to 30 seconds
    maxRetries: Number(process.env.REACT_APP_MAX_RETRIES) || 3,
  },
  cache: {
    ttl: Number(process.env.REACT_APP_CACHE_TTL) || 300000,
    staleTime: 60000, // 1 minute
  },
  features: {
    enableAnalytics: process.env.REACT_APP_ENABLE_ANALYTICS === 'true',
    enableOfflineMode: true,
  },
  app: {
    name: 'Weather Dashboard',
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    isDevelopment: process.env.NODE_ENV === 'development',
    isProduction: process.env.NODE_ENV === 'production',
    isTest: env.NODE_ENV === 'test',
  },
} as const;

// Type for config
export type AppConfig = typeof config;

// Validate critical config on app start
export const validateConfig = (): boolean => {
  const requiredKeys = ['api.key'] as const;
  const missing: string[] = [];
  
  requiredKeys.forEach(key => {
    const value = key.split('.').reduce((obj: any, k) => obj?.[k], config);
    if (!value) {
      missing.push(key);
    }
  });
  
  if (missing.length > 0) {
    console.error('Missing required configuration:', missing);
    return false;
  }
  
  return true;
};

export default config;
