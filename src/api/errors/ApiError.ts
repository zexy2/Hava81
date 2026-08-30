/**
 * Custom API Error Classes
 * Standardized error handling with retry logic support
 */

import { ErrorCode, type AppError } from '../../types/common.types';

export class ApiError extends Error implements AppError {
  public readonly code: ErrorCode;
  public readonly details?: Record<string, unknown>;
  public readonly timestamp: Date;
  public readonly retryable: boolean;
  public readonly statusCode?: number;

  constructor(
    message: string,
    code: ErrorCode = ErrorCode.UNKNOWN,
    options: {
      statusCode?: number;
      details?: Record<string, unknown>;
      retryable?: boolean;
      cause?: Error;
    } = {}
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.statusCode = options.statusCode;
    this.details = options.details;
    this.timestamp = new Date();
    this.retryable = options.retryable ?? this.isRetryableError(code, options.statusCode);

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    }

    // Preserve original error cause
    if (options.cause) {
      (this as Error & { cause?: Error }).cause = options.cause;
    }
  }

  private isRetryableError(code: ErrorCode, statusCode?: number): boolean {
    const retryableCodes = [ErrorCode.NETWORK_ERROR, ErrorCode.RATE_LIMIT];
    const retryableStatusCodes = [408, 429, 500, 502, 503, 504];

    return (
      retryableCodes.includes(code) ||
      (statusCode !== undefined && retryableStatusCodes.includes(statusCode))
    );
  }

  toJSON(): AppError {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      timestamp: this.timestamp,
      retryable: this.retryable,
    };
  }

  static fromHttpStatus(statusCode: number, message?: string): ApiError {
    const errorMap: Record<number, { code: ErrorCode; defaultMessage: string }> = {
      400: { code: ErrorCode.VALIDATION_ERROR, defaultMessage: 'Geçersiz istek' },
      408: { code: ErrorCode.NETWORK_ERROR, defaultMessage: 'İstek zaman aşımına uğradı' },
      401: { code: ErrorCode.UNAUTHORIZED, defaultMessage: 'Yetkilendirme hatası' },
      404: { code: ErrorCode.NOT_FOUND, defaultMessage: 'Kaynak bulunamadı' },
      429: { code: ErrorCode.RATE_LIMIT, defaultMessage: 'Çok fazla istek gönderildi' },
      500: { code: ErrorCode.API_ERROR, defaultMessage: 'Sunucu hatası' },
    };

    const errorInfo = errorMap[statusCode] || {
      code: ErrorCode.UNKNOWN,
      defaultMessage: 'Beklenmeyen bir hata oluştu',
    };

    return new ApiError(message || errorInfo.defaultMessage, errorInfo.code, { statusCode });
  }

  static networkError(originalError?: Error): ApiError {
    return new ApiError('İnternet bağlantınızı kontrol edin', ErrorCode.NETWORK_ERROR, {
      retryable: true,
      cause: originalError,
    });
  }

  static cityNotFound(city: string): ApiError {
    return new ApiError(
      `"${city}" şehri bulunamadı. Lütfen yazımı kontrol edin.`,
      ErrorCode.NOT_FOUND,
      {
        details: { searchedCity: city },
        retryable: false,
      }
    );
  }
}

export default ApiError;
