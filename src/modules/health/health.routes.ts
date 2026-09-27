import type { FastifyInstance } from 'fastify';
import type { AsyncCache } from '../../core/cache';

export const registerHealthRoutes = async (
  app: FastifyInstance,
  cache: AsyncCache,
  providerHealth?: () => unknown,
): Promise<void> => {
  app.get(
    '/health/live',
    {
      config: { rateLimit: false },
      schema: { tags: ['Health'], summary: 'Process liveness check' },
    },
    async (_request, reply) => {
      reply.header('Cache-Control', 'no-store');
      return { status: 'ok' };
    },
  );

  app.get(
    '/health/ready',
    {
      config: { rateLimit: false },
      schema: { tags: ['Health'], summary: 'API readiness and runtime health' },
    },
    async (_request, reply) => {
      reply.header('Cache-Control', 'no-store');
      return {
        status: 'ready',
        checks: { configuration: 'ok', cache: 'ok' },
        cache: { entries: cache.size, inFlight: cache.inFlightSize },
        provider: providerHealth?.() ?? null,
        timestamp: new Date().toISOString(),
      };
    },
  );
};
