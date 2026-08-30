/**
 * Common/Shared Types
 */

// Generic API response wrapper
export interface ApiResponse<T> {
  data: T | null;
  error: AppError | null;
  isLoading: boolean;
}

// Standardized error structure
export interface AppError {
  code: ErrorCode;
  message: string;
  details?: Record<string, unknown>;
  timestamp: Date;
  retryable: boolean;
}

export enum ErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  API_ERROR = 'API_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  LOCATION_DENIED = 'LOCATION_DENIED',
  LOCATION_UNAVAILABLE = 'LOCATION_UNAVAILABLE',
  LOCATION_TIMEOUT = 'LOCATION_TIMEOUT',
  RATE_LIMIT = 'RATE_LIMIT',
  UNAUTHORIZED = 'UNAUTHORIZED',
  UNKNOWN = 'UNKNOWN',
}

// Loading states for better UX
export enum LoadingState {
  IDLE = 'idle',
  LOADING = 'loading',
  SUCCESS = 'success',
  ERROR = 'error',
}

// Utility types
export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;

// Component props patterns
export interface BaseComponentProps {
  className?: string;
  testId?: string;
}

// Form field state
export interface FieldState<T> {
  value: T;
  error: string | null;
  touched: boolean;
  isValid: boolean;
}
