/**
 * HTTP Client
 * Axios instance with interceptors, retry logic, and error handling
 */

import { config, RETRY_CONFIG } from '../config';
import { ApiError } from './errors/ApiError';
import { ErrorCode } from '../types';

interface RequestConfig extends RequestInit {
  params?: Record<string, string | number | boolean>;
  timeout?: number;
  retries?: number;
}

interface RetryState {
  count: number;
  lastError: Error | null;
}

// Simple in-memory request cache
const requestCache = new Map<string, { data: unknown; timestamp: number }>();

/**
 * Sleep utility for retry delays
 */
const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Calculate exponential backoff delay
 */
const getRetryDelay = (retryCount: number): number => {
  return Math.min(
    RETRY_CONFIG.retryDelay * Math.pow(2, retryCount),
    30000 // Max 30 seconds
  );
};

/**
 * Build URL with query parameters
 */
const buildUrl = (endpoint: string, params?: Record<string, string | number | boolean>): string => {
  // For relative URLs (proxy), just append to baseUrl
  // For absolute URLs, use them directly
  let fullUrl: string;

  if (endpoint.startsWith('http')) {
    fullUrl = endpoint;
  } else if (config.api.baseUrl.startsWith('http')) {
    fullUrl = `${config.api.baseUrl}${endpoint}`;
  } else {
    // Relative URL for proxy - construct manually
    fullUrl = `${config.api.baseUrl}${endpoint}`;

    if (params) {
      const searchParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      fullUrl += `?${searchParams.toString()}`;
    }

    return fullUrl;
  }

  const url = new URL(fullUrl);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  return url.toString();
};

/**
 * Get cache key for request
 */
const getCacheKey = (url: string, options?: RequestConfig): string => {
  return `${options?.method || 'GET'}-${url}`;
};

/**
 * Check if cached response is still valid
 */
const isCacheValid = (timestamp: number): boolean => {
  const age = Date.now() - timestamp;
  return age >= 0 && age < config.cache.ttl;
};

/**
 * Core fetch with retry logic
 */
const fetchWithRetry = async <T>(
  url: string,
  options: RequestConfig = {},
  retryState: RetryState = { count: 0, lastError: null }
): Promise<T> => {
  const {
    timeout = config.api.timeout,
    retries = RETRY_CONFIG.maxRetries,
    ...fetchOptions
  } = options;

  // Check cache first for GET requests
  const cacheKey = getCacheKey(url, options);
  if (fetchOptions.method === undefined || fetchOptions.method === 'GET') {
    const cached = requestCache.get(cacheKey);
    if (cached && isCacheValid(cached.timestamp)) {
      console.debug('[HTTP] Cache hit:', cacheKey);
      return cached.data as T;
    }
  }

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  // Only add Content-Type for non-GET requests (POST, PUT, etc.)
  const isGetRequest = !fetchOptions.method || fetchOptions.method === 'GET';

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        ...(isGetRequest ? {} : { 'Content-Type': 'application/json' }),
        ...fetchOptions.headers,
      },
    });

    clearTimeout(timeoutId);

    // Handle non-OK responses
    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      const errorMessage = errorBody?.error?.message ?? errorBody?.message;

      // Check if this is a retryable status
      if (
        (RETRY_CONFIG.retryStatusCodes as readonly number[]).includes(response.status) &&
        retryState.count < retries
      ) {
        const delay = getRetryDelay(retryState.count);
        console.warn(
          `[HTTP] Retrying request (${retryState.count + 1}/${retries}) after ${delay}ms`
        );
        await sleep(delay);

        return fetchWithRetry<T>(url, options, {
          count: retryState.count + 1,
          lastError: ApiError.fromHttpStatus(response.status, errorMessage),
        });
      }

      throw ApiError.fromHttpStatus(response.status, errorMessage);
    }

    const data = await response.json();

    // Cache successful GET responses
    if (fetchOptions.method === undefined || fetchOptions.method === 'GET') {
      requestCache.set(cacheKey, { data, timestamp: Date.now() });
    }

    return data;
  } catch (error) {
    clearTimeout(timeoutId);

    // Handle abort (timeout)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError('İstek zaman aşımına uğradı', ErrorCode.NETWORK_ERROR, {
        retryable: true,
      });
    }

    // Handle network errors with retry
    if (
      error instanceof TypeError &&
      error.message.includes('fetch') &&
      retryState.count < retries
    ) {
      const delay = getRetryDelay(retryState.count);
      console.warn(
        `[HTTP] Network error, retrying (${retryState.count + 1}/${retries}) after ${delay}ms`
      );
      await sleep(delay);

      return fetchWithRetry<T>(url, options, {
        count: retryState.count + 1,
        lastError: error,
      });
    }

    // Re-throw ApiErrors as-is
    if (error instanceof ApiError) {
      throw error;
    }

    console.error('[HTTP] Unknown error caught:', error);

    // Wrap unknown errors
    throw ApiError.networkError(error instanceof Error ? error : undefined);
  }
};

/**
 * HTTP Client API
 */
export const httpClient = {
  get: <T>(endpoint: string, params?: Record<string, string | number | boolean>): Promise<T> => {
    const url = buildUrl(endpoint, params);
    return fetchWithRetry<T>(url);
  },

  post: <T>(endpoint: string, data?: unknown): Promise<T> => {
    const url = buildUrl(endpoint);
    return fetchWithRetry<T>(url, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  },

  clearCache: (): void => {
    requestCache.clear();
    console.debug('[HTTP] Cache cleared');
  },

  getCacheSize: (): number => requestCache.size,
};

export default httpClient;
