import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { parseEnv, type AppConfig } from './config/env';
import { MemoryTtlCache, type AsyncCache } from './core/cache';
import { AppError, toErrorEnvelope } from './core/errors';
import { registerHealthRoutes } from './modules/health/health.routes';
import { registerWeatherRoutes } from './modules/weather/weather.routes';
import { WeatherService } from './modules/weather/weather.service';
import { OpenWeatherProvider } from './providers/openweather/openweather.provider';
import type { WeatherProvider } from './providers/weather-provider';

export interface BuildAppOptions {
  env?: AppConfig;
  provider?: WeatherProvider;
  cache?: AsyncCache;
  logger?: boolean;
}

export const buildApp = async (options: BuildAppOptions = {}): Promise<FastifyInstance> => {
  const env = options.env ?? parseEnv();
  const logger = options.logger === false
    ? false
    : {
        level: env.LOG_LEVEL,
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'res.headers.set-cookie',
          ],
          censor: '[REDACTED]',
        },
      };
  const app = Fastify({
    logger,
    trustProxy: env.NODE_ENV === 'production' ? 1 : false,
    requestIdHeader: 'x-request-id',
  });

  await app.register(cors, {
    origin: env.CORS_ORIGINS.includes('*') ? true : env.CORS_ORIGINS,
    methods: ['GET', 'OPTIONS'],
  });
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
      },
    },
  });
  await app.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: '1 minute',
    errorResponseBuilder: (request) => ({
      statusCode: 429,
      error: {
        code: 'RATE_LIMITED',
        message: 'Çok fazla istek gönderildi. Lütfen kısa süre sonra tekrar deneyin.',
        requestId: request.id,
      },
    }),
  });
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Turkey Weather API',
        description: 'OpenWeather anahtarını tarayıcıdan gizleyen, doğrulamalı weather BFF.',
        version: '1.0.0',
      },
      tags: [
        { name: 'Weather', description: 'Normalize edilmiş hava durumu verileri' },
        { name: 'Health', description: 'Container health kontrolleri' },
      ],
    },
  });
  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: false },
  });

  app.setErrorHandler((error, request, reply) => {
    let normalizedError: unknown = error;
    const errorMetadata = error as { code?: string; validation?: unknown };

    if (!(error instanceof AppError) && !(error instanceof ZodError) && errorMetadata.validation) {
      normalizedError = new AppError(
        400,
        'VALIDATION_ERROR',
        'İstek parametreleri geçersiz.',
        errorMetadata.validation,
      );
    }

    const statusCode = normalizedError instanceof AppError
      ? normalizedError.statusCode
      : normalizedError instanceof ZodError
        ? 400
        : typeof (normalizedError as { statusCode?: unknown })?.statusCode === 'number'
          ? (normalizedError as { statusCode: number }).statusCode
          : 500;

    if (statusCode >= 500) {
      request.log.error({ err: error }, 'Request failed');
    } else {
      request.log.warn({ code: errorMetadata.code, statusCode }, 'Request rejected');
    }

    if (statusCode === 429 && 'error' in (error as object)) {
      reply.status(statusCode).send(error);
      return;
    }

    reply.status(statusCode).send(toErrorEnvelope(normalizedError, request.id));
  });

  const cache = options.cache ?? new MemoryTtlCache(env.CACHE_MAX_ENTRIES);
  const provider = options.provider ?? new OpenWeatherProvider(env);
  const weatherService = new WeatherService(provider, cache, env);

  await app.register(
    async (api) => {
      await registerHealthRoutes(api, cache);
      await registerWeatherRoutes(api, weatherService);
    },
    { prefix: '/api/v1' },
  );

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send(
      toErrorEnvelope(
        new AppError(404, 'ROUTE_NOT_FOUND', 'İstenen API rotası bulunamadı.'),
        request.id,
      ),
    );
  });

  app.addHook('onClose', async () => {
    cache.clear();
  });

  return app;
};
