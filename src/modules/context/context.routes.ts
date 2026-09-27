import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AsyncCache } from '../../core/cache';
import type { ContextSignalsService } from './context.service';

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  marine: z
    .enum(['true', 'false'])
    .optional()
    .default('false')
    .transform(value => value === 'true'),
});

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
            lat: { type: 'number', minimum: -90, maximum: 90 },
            lon: { type: 'number', minimum: -180, maximum: 180 },
            marine: { type: 'string', enum: ['true', 'false'] },
          },
        },
      },
    },
    async (request, reply) => {
      const query = querySchema.parse(request.query);
      const key = `context:${query.lat.toFixed(3)}:${query.lon.toFixed(3)}:${query.marine ? 1 : 0}`;
      const result = await cache.getOrLoad(key, 30 * 60 * 1000, () =>
        service.get(query.lat, query.lon, query.marine)
      );
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
