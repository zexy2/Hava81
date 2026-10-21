import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { ProvincesService } from './provinces.service';

const querySchema = z.object({ lang: z.enum(['tr', 'en']).default('tr') });

const provinceItemJsonSchema = {
  type: 'object',
  required: ['plate', 'name', 'lat', 'lon', 'temperature', 'weatherCode', 'icon', 'description', 'observedAt'],
  properties: {
    plate: { type: 'integer', minimum: 1, maximum: 81 },
    name: { type: 'string' },
    lat: { type: 'number' },
    lon: { type: 'number' },
    temperature: { type: 'number', description: '°C' },
    weatherCode: { type: 'integer', description: 'WMO hava kodu' },
    icon: { type: 'string' },
    description: { type: 'string' },
    windSpeed: { type: 'number', minimum: 0, description: 'm/s' },
    observedAt: { type: 'string', format: 'date-time' },
  },
} as const;

export const provincesResponseJsonSchema = {
  type: 'object',
  required: ['provinces', 'meta'],
  properties: {
    provinces: { type: 'array', items: provinceItemJsonSchema },
    meta: {
      type: 'object',
      required: ['provider', 'fetchedAt', 'units', 'total'],
      properties: {
        provider: { type: 'string' },
        attribution: { type: 'string' },
        fetchedAt: { type: 'string', format: 'date-time' },
        units: { type: 'string', enum: ['metric'] },
        total: { type: 'integer' },
        cacheStatus: { type: 'string', enum: ['HIT', 'MISS', 'COALESCED'] },
        freshForSeconds: { type: 'number' },
      },
    },
  },
} as const;

export const registerProvinceRoutes = async (
  app: FastifyInstance,
  service: ProvincesService,
): Promise<void> => {
  app.get(
    '/weather/provinces',
    {
      schema: {
        tags: ['Weather'],
        summary: '81 ilin güncel sıcaklığını tek yanıtta getirir (harita için)',
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: { lang: { type: 'string', enum: ['tr', 'en'], default: 'tr' } },
        },
        response: { 200: provincesResponseJsonSchema },
      },
    },
    async (request, reply) => {
      const query = querySchema.parse(request.query);
      const result = await service.getAll(query.lang);
      reply.header('x-cache', result.status);
      reply.header('cache-control', `public, max-age=${Math.min(600, result.cacheMaxAgeSeconds)}`);
      return {
        ...result.value,
        meta: {
          ...result.value.meta,
          cacheStatus: result.status,
          freshForSeconds: result.freshForSeconds,
        },
      };
    },
  );
};
