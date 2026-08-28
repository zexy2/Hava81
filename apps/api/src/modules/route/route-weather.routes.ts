import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AppError } from '../../core/errors';
import { haversine, type RouteWeatherService } from './route-weather.service';

export const validateRouteDistance = (distanceKm: number) => {
  if (distanceKm < 1) throw new AppError(400, 'ROUTE_TOO_SHORT', 'Rota başlangıç ve varış noktaları farklı olmalıdır.');
  if (distanceKm > 2_000) throw new AppError(400, 'ROUTE_TOO_LONG', 'Rota hava tahmini en fazla 2000 km kuş uçuşu mesafe için kullanılabilir.');
};

const querySchema = z.object({
  originLat: z.coerce.number().min(-90).max(90),
  originLon: z.coerce.number().min(-180).max(180),
  destinationLat: z.coerce.number().min(-90).max(90),
  destinationLon: z.coerce.number().min(-180).max(180),
  departure: z.string().datetime(),
  lang: z.enum(['tr', 'en']).default('tr'),
});

export const registerRouteWeatherRoutes = async (
  app: FastifyInstance,
  service: RouteWeatherService
) => {
  app.get(
    '/weather/route',
    {
      schema: {
        tags: ['Weather'],
        summary: 'İki şehir arasındaki yaklaşık hava koridorunu değerlendirir',
      },
    },
    async (request, reply) => {
      const q = querySchema.parse(request.query);
      const departure = new Date(q.departure);
      const directDistanceKm = haversine(
        { lat: q.originLat, lon: q.originLon },
        { lat: q.destinationLat, lon: q.destinationLon }
      );
      validateRouteDistance(directDistanceKm);
      const now = Date.now();
      if (departure.getTime() < now - 60 * 60_000 || departure.getTime() > now + 18 * 60 * 60_000) {
        throw new AppError(
          400,
          'ROUTE_DEPARTURE_RANGE',
          'Rota hava tahmini için kalkış zamanı şimdi ile önümüzdeki 18 saat arasında olmalıdır.'
        );
      }
      const result = await service.evaluate({
        origin: { lat: q.originLat, lon: q.originLon },
        destination: { lat: q.destinationLat, lon: q.destinationLon },
        departure,
        lang: q.lang,
      });
      reply.header('cache-control', 'private, max-age=300');
      return result;
    }
  );
};
