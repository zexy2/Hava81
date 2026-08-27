import type { FastifyInstance } from 'fastify';
import type { CacheStatus } from '../../core/cache';
import {
  airQualityQuerySchema,
  currentWeatherQuerySchema,
  forecastQuerySchema,
} from './contracts';
import {
  airQualityQueryJsonSchema,
  airQualityResponseJsonSchema,
  currentQueryJsonSchema,
  currentResponseJsonSchema,
  forecastQueryJsonSchema,
  forecastResponseJsonSchema,
} from './openapi';
import type { WeatherService } from './weather.service';

const cacheHeaders = (reply: { header(name: string, value: string): unknown }, status: string, maxAge: number) => {
  reply.header('x-cache', status);
  reply.header('cache-control', `public, max-age=${maxAge}`);
};

const withCacheMeta = <T extends { meta: object }>(
  value: T,
  cacheStatus: CacheStatus,
  freshForSeconds: number,
): T => ({
  ...value,
  meta: { ...value.meta, cacheStatus, freshForSeconds },
});

export const registerWeatherRoutes = async (
  app: FastifyInstance,
  service: WeatherService,
): Promise<void> => {
  app.get(
    '/weather/current',
    {
      schema: {
        tags: ['Weather'],
        summary: 'Şehir veya koordinata göre güncel hava durumunu getirir',
        querystring: currentQueryJsonSchema,
        response: { 200: currentResponseJsonSchema },
      },
    },
    async (request, reply) => {
      const query = currentWeatherQuerySchema.parse(request.query);
      const result = await service.getCurrent(query);
      cacheHeaders(reply, result.status, 60);
      return withCacheMeta(result.value, result.status, 60);
    },
  );

  app.get(
    '/weather/forecast',
    {
      schema: {
        tags: ['Weather'],
        summary: 'Koordinata göre üç saatlik ve beş günlük tahmini getirir',
        querystring: forecastQueryJsonSchema,
        response: { 200: forecastResponseJsonSchema },
      },
    },
    async (request, reply) => {
      const query = forecastQuerySchema.parse(request.query);
      const result = await service.getForecast(query);
      cacheHeaders(reply, result.status, 300);
      return withCacheMeta(result.value, result.status, 300);
    },
  );

  app.get(
    '/weather/air-quality',
    {
      schema: {
        tags: ['Weather'],
        summary: 'Koordinata göre güncel hava kalitesini getirir',
        querystring: airQualityQueryJsonSchema,
        response: { 200: airQualityResponseJsonSchema },
      },
    },
    async (request, reply) => {
      const query = airQualityQuerySchema.parse(request.query);
      const result = await service.getAirQuality(query);
      cacheHeaders(reply, result.status, 120);
      return withCacheMeta(result.value, result.status, 120);
    },
  );
};
