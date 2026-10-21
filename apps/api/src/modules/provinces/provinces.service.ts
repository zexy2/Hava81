import type { AsyncCache, CacheResult } from '../../core/cache';
import { AppError } from '../../core/errors';
import {
  descriptionForCode,
  iconForCode,
} from '../../providers/openmeteo/openmeteo-hourly.provider';
import type {
  ProvinceCurrentObservation,
  ProvinceCurrentProvider,
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
  observedAt: string;
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

/**
 * 81 ilin güncel sıcaklığını tek upstream çağrısıyla getirir. Ham sonuç dile bağlı
 * değildir; bu yüzden tek bir cache anahtarı tutulur ve açıklama/ikon istek dilinde
 * üretilir. Cache kaçırıldığında upstream bütçesinden yalnızca 1 hak düşer.
 */
export class ProvincesService {
  constructor(
    private readonly provider: ProvinceCurrentProvider,
    private readonly cache: AsyncCache,
    private readonly ttlMs: number,
  ) {}

  async getAll(lang: WeatherLanguage): Promise<CacheResult<ProvinceTemperaturesDto>> {
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
        return { fetchedAt: new Date().toISOString(), observations };
      },
    );

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
          observedAt: observation.observedAt,
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
