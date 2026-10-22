import type { FastifyInstance } from 'fastify';
import type { AsyncCache, CacheResult, CacheStatus } from '../../core/cache';
import { AppError } from '../../core/errors';
import { loadContextSignals } from '../context/context.routes';
import type { ContextSignalsService } from '../context/context.service';
import { bundleQuerySchema, type BundlePart } from './contracts';
import { bundleQueryJsonSchema, bundleResponseJsonSchema } from './openapi';
import type { WeatherService } from './weather.service';

/** Tekil uç noktalardaki Cache-Control üst sınırlarıyla aynı (saniye). */
const DESIRED_MAX_AGE: Record<BundlePart, number> = {
  current: 60,
  forecast: 300,
  hourly: 300,
  airQuality: 120,
  context: 900,
  airQualityHourly: 900,
};

interface PartError {
  code: string;
  message: string;
  statusCode: number;
}

const toPartError = (error: unknown): PartError =>
  error instanceof AppError
    ? { code: error.code, message: error.message, statusCode: error.statusCode }
    : { code: 'INTERNAL_ERROR', message: 'Beklenmeyen bir sunucu hatası oluştu.', statusCode: 500 };

export interface BundleDependencies {
  weather: WeatherService;
  context: ContextSignalsService;
  cache: AsyncCache;
}

/**
 * `/weather/bundle`: istemcinin şehir başına attığı current + forecast + hourly +
 * air-quality + context isteklerini tek yanıtta toplar. Her parça tekil uç noktayla
 * aynı servis/cache anahtarını kullanır; böylece Türkiye sınır kontrolü, 2 haneli
 * cache anahtarı ve upstream bütçesi aynen geçerlidir (cache kaçıran her parça bütçeden
 * bir hak düşer). Bir parça başarısız olursa yanıt yine 200 döner, parça `null` olur
 * ve nedeni `errors` içinde yer alır.
 */
export const registerBundleRoutes = async (
  app: FastifyInstance,
  deps: BundleDependencies,
): Promise<void> => {
  app.get(
    '/weather/bundle',
    {
      schema: {
        tags: ['Weather'],
        summary: 'Bir konum için güncel, tahmin, saatlik, hava kalitesi ve bağlamı tek yanıtta getirir',
        querystring: bundleQueryJsonSchema,
        response: { 200: bundleResponseJsonSchema },
      },
    },
    async (request, reply) => {
      const query = bundleQuerySchema.parse(request.query);
      const { lat, lon, units, lang, marine } = query;

      const loaders: Record<BundlePart, () => Promise<CacheResult<unknown>>> = {
        current: () => deps.weather.getCurrent({ lat, lon, units, lang }),
        forecast: () => deps.weather.getForecast({ lat, lon, units, lang }),
        hourly: () => deps.weather.getHourlyForecast({ lat, lon, lang }),
        airQuality: () => deps.weather.getAirQuality({ lat, lon, lang }),
        context: () => loadContextSignals(deps.cache, deps.context, lat, lon, marine),
        airQualityHourly: () => deps.weather.getAirQualityHourly({ lat, lon, lang }),
      };

      const settled = await Promise.allSettled(query.include.map(part => loaders[part]()));

      const body: Record<string, unknown> = {};
      const errors: Partial<Record<BundlePart, PartError>> = {};
      const statuses: CacheStatus[] = [];
      let maxAge = Number.POSITIVE_INFINITY;
      let firstFailure: unknown;

      settled.forEach((outcome, index) => {
        const part = query.include[index] as BundlePart;
        if (outcome.status === 'rejected') {
          firstFailure ??= outcome.reason;
          errors[part] = toPartError(outcome.reason);
          body[part] = null;
          if (!(outcome.reason instanceof AppError)) {
            request.log.error({ err: outcome.reason, part }, 'Bundle part failed');
          }
          return;
        }
        const result = outcome.value;
        statuses.push(result.status);
        maxAge = Math.min(maxAge, DESIRED_MAX_AGE[part], result.cacheMaxAgeSeconds);
        const value = result.value as Record<string, unknown>;
        // Tekil uç noktalarla aynı şekil: hava parçalarında cache bilgisi meta içinde,
        // bağlamda (tarihsel olarak) üst düzeyde.
        body[part] =
          part === 'context'
            ? { ...value, cacheStatus: result.status, freshForSeconds: result.freshForSeconds }
            : {
                ...value,
                meta: {
                  ...(value.meta as object),
                  cacheStatus: result.status,
                  freshForSeconds: result.freshForSeconds,
                },
              };
      });

      // Hiçbir parça alınamadıysa tekil uç noktalar gibi gerçek hata kodunu döndür
      // (ör. 503 UPSTREAM_BUDGET_EXHAUSTED), istemci de buna göre davranır.
      if (statuses.length === 0) throw firstFailure;

      const hasErrors = Object.keys(errors).length > 0;
      reply.header('x-cache', statuses.every(status => status === 'HIT') ? 'HIT' : 'MISS');
      reply.header(
        'cache-control',
        hasErrors ? 'no-store' : `public, max-age=${Number.isFinite(maxAge) ? maxAge : 0}`,
      );

      return {
        ...body,
        errors,
        meta: { fetchedAt: new Date().toISOString(), parts: query.include },
      };
    },
  );
};
