/**
 * API Configuration
 */

import { config } from './env.config';

export const API_ENDPOINTS = {
  weather: {
    current: '/weather',
    forecast: '/forecast',
    oneCall: '/onecall',
  },
} as const;

export const DEFAULT_WEATHER_PARAMS = {
  units: 'metric' as const,
  lang: 'tr',
};

export const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
} as const;

export const RETRY_CONFIG = {
  maxRetries: config.api.maxRetries,
  retryDelay: 1000,
  retryStatusCodes: [408, 429, 500, 502, 503, 504],
} as const;

export const apiConfig = {
  API_ENDPOINTS,
  DEFAULT_WEATHER_PARAMS,
  HTTP_STATUS,
  RETRY_CONFIG,
};

export default apiConfig;
