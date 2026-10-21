import type { FastifyInstance } from 'fastify';
import type { AsyncCache } from '../../core/cache';

export const registerHealthRoutes = async (
  app: FastifyInstance,
  cache: AsyncCache,
  providerHealth?: () => unknown,
  revision = 'unknown',
): Promise<void> => {
  app.get(
    '/health',
    {
      config: { rateLimit: false },
      schema: { tags: ['Health'], summary: 'Liveness plus deployed build revision' },
    },
    async (_request, reply) => {
      reply.header('Cache-Control', 'no-store');
      return { status: 'ok', revision, timestamp: new Date().toISOString() };
    },
  );

  app.get(
    '/health/live',
    {
      config: { rateLimit: false },
      schema: { tags: ['Health'], summary: 'Process liveness check' },
    },
    async (_request, reply) => {
      reply.header('Cache-Control', 'no-store');
      return { status: 'ok', revision };
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
        revision,
        timestamp: new Date().toISOString(),
      };
    },
  );
};
