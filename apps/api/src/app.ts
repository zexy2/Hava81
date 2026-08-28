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
import { ResilientWeatherProvider } from './core/resilient-provider';
import { registerHealthRoutes } from './modules/health/health.routes';
import { registerContextRoutes } from './modules/context/context.routes';
import { ContextSignalsService } from './modules/context/context.service';
import { registerWeatherRoutes } from './modules/weather/weather.routes';
import { registerRouteWeatherRoutes } from './modules/route/route-weather.routes';
import { RouteWeatherService } from './modules/route/route-weather.service';
import { WeatherService } from './modules/weather/weather.service';
import { OpenMeteoHourlyProvider } from './providers/openmeteo/openmeteo-hourly.provider';
import { OpenWeatherProvider } from './providers/openweather/openweather.provider';
import type { HourlyForecastProvider, WeatherProvider } from './providers/weather-provider';

export interface BuildAppOptions {
  env?: AppConfig;
  provider?: WeatherProvider;
  hourlyProvider?: HourlyForecastProvider;
  cache?: AsyncCache;
  logger?: boolean;
}

export const buildApp = async (options: BuildAppOptions = {}): Promise<FastifyInstance> => {
  const env = options.env ?? parseEnv();
  const logger =
    options.logger === false
      ? false
      : {
          level: env.LOG_LEVEL,
          redact: {
            paths: ['req.headers.authorization', 'req.headers.cookie', 'res.headers.set-cookie'],
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
    errorResponseBuilder: request => ({
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
        { name: 'Context', description: 'UV, toz, polen ve deniz karar bağlamı' },
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
        errorMetadata.validation
      );
    }

    const statusCode =
      normalizedError instanceof AppError
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
  const provider =
    options.provider ??
    (() => {
      const primary = new OpenWeatherProvider(env);
      const fallback = env.OPENWEATHER_FALLBACK_API_KEY
        ? new OpenWeatherProvider(
            {
              ...env,
              OPENWEATHER_API_KEY: env.OPENWEATHER_FALLBACK_API_KEY,
              OPENWEATHER_BASE_URL: env.OPENWEATHER_FALLBACK_BASE_URL ?? env.OPENWEATHER_BASE_URL,
            },
            fetch,
            'OpenWeatherFallback'
          )
        : undefined;
      return new ResilientWeatherProvider(primary, fallback, {
        retryCount: env.PROVIDER_RETRY_COUNT,
        failureThreshold: env.PROVIDER_CIRCUIT_FAILURE_THRESHOLD,
        resetMs: env.PROVIDER_CIRCUIT_RESET_MS,
      });
    })();
  const hourlyProvider =
    options.hourlyProvider ?? new OpenMeteoHourlyProvider(fetch, env.OPENWEATHER_TIMEOUT_MS);
  const weatherService = new WeatherService(provider, cache, env, hourlyProvider);
  const contextService = new ContextSignalsService(fetch);
  const routeWeatherService = new RouteWeatherService(weatherService);

  await app.register(
    async api => {
      await registerHealthRoutes(
        api,
        cache,
        provider instanceof ResilientWeatherProvider
          ? () => provider.getHealth()
          : () => ({ name: provider.name ?? 'custom-provider' })
      );
      await registerWeatherRoutes(api, weatherService);
      await registerContextRoutes(api, contextService, cache);
      await registerRouteWeatherRoutes(api, routeWeatherService);
    },
    { prefix: '/api/v1' }
  );

  app.setNotFoundHandler((request, reply) => {
    reply
      .status(404)
      .send(
        toErrorEnvelope(
          new AppError(404, 'ROUTE_NOT_FOUND', 'İstenen API rotası bulunamadı.'),
          request.id
        )
      );
  });

  app.addHook('onClose', async () => {
    cache.clear();
  });

  return app;
};
