import {
  coordinateCacheKey,
  turkeyLatJsonSchema,
  turkeyLatitudeSchema,
  turkeyLonJsonSchema,
  turkeyLongitudeSchema,
} from '../../core/geo';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AsyncCache } from '../../core/cache';
import type { ContextSignalsService } from './context.service';

const querySchema = z.object({
  lat: turkeyLatitudeSchema,
  lon: turkeyLongitudeSchema,
  marine: z
    .enum(['true', 'false'])
    .optional()
    .default('false')
    .transform(value => value === 'true'),
});

export const CONTEXT_CACHE_TTL_MS = 30 * 60 * 1000;

/** Bağlam sinyallerini cache + upstream bütçesi üzerinden yükler (tekil uç nokta ve bundle ortak). */
export const loadContextSignals = (
  cache: AsyncCache,
  service: ContextSignalsService,
  lat: number,
  lon: number,
  marine: boolean
) =>
  cache.getOrLoad(`context:${coordinateCacheKey(lat, lon)}:${marine ? 1 : 0}`, CONTEXT_CACHE_TTL_MS, () =>
    service.get(lat, lon, marine)
  );

export const registerContextRoutes = async (
  app: FastifyInstance,
  service: ContextSignalsService,
  cache: AsyncCache
) => {
  app.get(
    '/weather/context',
    {
      schema: {
        tags: ['Weather'],
        summary: 'UV, toz, polen ve isteğe bağlı deniz bağlamını getirir',
        querystring: {
          type: 'object',
          required: ['lat', 'lon'],
          additionalProperties: false,
          properties: {
            lat: turkeyLatJsonSchema,
            lon: turkeyLonJsonSchema,
            marine: { type: 'string', enum: ['true', 'false'] },
          },
        },
      },
    },
    async (request, reply) => {
      const query = querySchema.parse(request.query);
      const result = await loadContextSignals(cache, service, query.lat, query.lon, query.marine);
      reply.header('x-cache', result.status);
      reply.header(
        'cache-control',
        `public, max-age=${Math.min(900, result.cacheMaxAgeSeconds)}`
      );
      return {
        ...result.value,
        cacheStatus: result.status,
        freshForSeconds: result.freshForSeconds,
      };
    }
  );
};
