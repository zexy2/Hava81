import type { AsyncCache, CacheResult } from '../../core/cache';
import { AppError } from '../../core/errors';
import {
  descriptionForCode,
  iconForCode,
} from '../../providers/openmeteo/openmeteo-hourly.provider';
import type {
  ProvinceCurrentObservation,
  ProvinceOutlookPoint,
  ProvinceCurrentProvider,
  ProvincePrecipitationPeriod,
} from '../../providers/openmeteo/openmeteo-provinces.provider';
import type { WeatherLanguage } from '../../providers/weather-provider';
import { PROVINCES } from './provinces.data';

export interface ProvinceTemperatureDto {
  plate: number;
  name: string;
  lat: number;
  lon: number;
  temperature: number;
  weatherCode: number;
  icon: string;
  description: string;
  windSpeed?: number;
  windDirection?: number;
  cloudCover?: number;
  precipitation?: number;
  precipitationProbability?: number;
  outlook?: ProvinceOutlookPoint[];
  observedAt: string;
  validAt?: string;
  modelUpdatedAt?: string;
  precipitationPeriod?: ProvincePrecipitationPeriod;
}

export interface ProvinceTemperaturesDto {
  provinces: ProvinceTemperatureDto[];
  meta: {
    provider: string;
    attribution?: string;
    fetchedAt: string;
    units: 'metric';
    total: number;
  };
}

interface RawProvinceSnapshot {
  fetchedAt: string;
  observations: Array<ProvinceCurrentObservation | null>;
}

export interface ProvincesServiceOptions {
  /** How long after its fetch the last good map may still be served when a refresh fails. */
  maxStaleMs?: number;
  now?: () => number;
}

const DEFAULT_MAX_STALE_MS = 3 * 60 * 60 * 1_000;
/** Browsers retry soon while the map is stale. */
const STALE_MAX_AGE_SECONDS = 60;

/**
 * 81 ilin güncel sıcaklığını tek upstream çağrısıyla getirir. Ham sonuç dile bağlı
 * değildir; bu yüzden tek bir cache anahtarı tutulur ve açıklama/ikon istek dilinde
 * üretilir. Cache kaçırıldığında upstream bütçesinden yalnızca 1 hak düşer.
 */
export class ProvincesService {
  private lastGood: RawProvinceSnapshot | null = null;
  private readonly maxStaleMs: number;
  private readonly now: () => number;

  constructor(
    private readonly provider: ProvinceCurrentProvider,
    private readonly cache: AsyncCache,
    private readonly ttlMs: number,
    options: ProvincesServiceOptions = {},
  ) {
    this.maxStaleMs = options.maxStaleMs ?? DEFAULT_MAX_STALE_MS;
    this.now = options.now ?? Date.now;
  }

  /**
   * A failed refresh keeps serving the last good map (status `STALE`) until it is older than
   * `maxStaleMs`; only then does the error reach the client.
   */
  private async snapshot(): Promise<CacheResult<RawProvinceSnapshot>> {
    try {
      const result = await this.cache.getOrLoad<RawProvinceSnapshot>(
        'provinces:current:v1',
        this.ttlMs,
        async () => {
          const observations = await this.provider.getCurrent(PROVINCES);
          if (!observations.some(Boolean)) {
            throw new AppError(
              502,
              'EMPTY_PROVINCES_PROVIDER_RESPONSE',
              'İl sıcaklıkları şu anda kullanılamıyor.',
            );
          }
          return { fetchedAt: new Date(this.now()).toISOString(), observations };
        },
      );
      this.lastGood = result.value;
      return result;
    } catch (error) {
      const lastGood = this.lastGood;
      if (lastGood && this.now() - Date.parse(lastGood.fetchedAt) <= this.maxStaleMs) {
        return {
          value: lastGood,
          status: 'STALE',
          freshForSeconds: 0,
          cacheMaxAgeSeconds: STALE_MAX_AGE_SECONDS,
        };
      }
      throw error;
    }
  }

  async getAll(lang: WeatherLanguage): Promise<CacheResult<ProvinceTemperaturesDto>> {
    const result = await this.snapshot();

    const provinces = PROVINCES.flatMap((province, index) => {
      const observation = result.value.observations[index];
      if (!observation) return [];
      return [
        {
          plate: province.plate,
          name: province.name,
          lat: province.lat,
          lon: province.lon,
          temperature: observation.temperature,
          weatherCode: observation.weatherCode,
          icon: iconForCode(observation.weatherCode, observation.isDay),
          description: descriptionForCode(observation.weatherCode, lang),
          ...(observation.windSpeed === undefined ? {} : { windSpeed: observation.windSpeed }),
          ...(observation.windDirection === undefined ? {} : { windDirection: observation.windDirection }),
          ...(observation.cloudCover === undefined ? {} : { cloudCover: observation.cloudCover }),
          ...(observation.precipitation === undefined ? {} : { precipitation: observation.precipitation }),
          ...(observation.precipitationProbability === undefined
            ? {}
            : { precipitationProbability: observation.precipitationProbability }),
          ...(observation.outlook === undefined ? {} : { outlook: observation.outlook }),
          observedAt: observation.observedAt,
          ...(observation.validAt === undefined ? {} : { validAt: observation.validAt }),
          ...(observation.modelUpdatedAt === undefined ? {} : { modelUpdatedAt: observation.modelUpdatedAt }),
          ...(observation.precipitationPeriod === undefined
            ? {}
            : { precipitationPeriod: observation.precipitationPeriod }),
        },
      ];
    });

    return {
      ...result,
      value: {
        provinces,
        meta: {
          provider: this.provider.name,
          ...(this.provider.attribution ? { attribution: this.provider.attribution } : {}),
          fetchedAt: result.value.fetchedAt,
          units: 'metric',
          total: PROVINCES.length,
        },
      },
    };
  }
}
