import { ZodError } from 'zod';

export interface AppErrorOptions extends ErrorOptions {
  /** Positive delay parsed from a trusted upstream Retry-After header. */
  retryAfterSeconds?: number;
}

export class AppError extends Error {
  public readonly retryAfterSeconds: number | undefined;

  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
    options?: AppErrorOptions,
  ) {
    super(message, options);
    this.name = 'AppError';
    this.retryAfterSeconds = options?.retryAfterSeconds;
  }
}

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: unknown;
  };
}

export const toErrorEnvelope = (error: unknown, requestId: string): ErrorEnvelope => {
  if (error instanceof ZodError) {
    return {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'İstek parametreleri geçersiz.',
        requestId,
        details: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    };
  }

  if (error instanceof AppError) {
    return {
      error: {
        code: error.code,
        message: error.message,
        requestId,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
    };
  }

  return {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Beklenmeyen bir sunucu hatası oluştu.',
      requestId,
    },
  };
};
