import { coordinateCacheKey } from '../../core/geo';
import { AppError } from '../../core/errors';
import type { AppConfig } from '../../config/env';
import type { AsyncCache, CacheResult } from '../../core/cache';
import { HOURLY_FORECAST_HOURS } from './contracts';
import type {
  AirQualityHourlyProvider,
  CurrentWeatherQuery,
  HourlyForecastProvider,
  WeatherProvider,
} from '../../providers/weather-provider';
import type { ForecastUpstream } from '../../providers/openweather/schemas';
import type {
  AirQualityDto,
  AirQualityHourlyDto,
  AirQualityQueryInput,
  CurrentWeatherDto,
  CurrentWeatherQueryInput,
  ForecastDto,
  ForecastQueryInput,
  HourlyForecastDto,
  HourlyForecastQueryInput,
} from './contracts';

const coordinateKey = coordinateCacheKey;

const normalizeCity = (city: string): string => city.toLocaleLowerCase('tr-TR').trim();

const dateKeyAtOffset = (unixSeconds: number, offsetSeconds: number): string =>
  new Date((unixSeconds + offsetSeconds) * 1_000).toISOString().slice(0, 10);

export class WeatherService {
  constructor(
    private readonly provider: WeatherProvider,
    private readonly cache: AsyncCache,
    private readonly config: Pick<
      AppConfig,
      'CACHE_CURRENT_TTL_MS' | 'CACHE_FORECAST_TTL_MS' | 'CACHE_AIR_QUALITY_TTL_MS'
    >,
    private readonly hourlyProvider: HourlyForecastProvider,
    private readonly airQualityHourlyProvider?: AirQualityHourlyProvider
  ) {}

  /** Plan v3 (P1.2): hourly European AQI for the five-day plan horizon (bundle part only). */
  getAirQualityHourly(query: AirQualityQueryInput): Promise<CacheResult<AirQualityHourlyDto>> {
    const provider = this.airQualityHourlyProvider;
    if (!provider) {
      return Promise.reject(
        new AppError(
          503,
          'AIR_QUALITY_HOURLY_UNAVAILABLE',
          'Saatlik hava kalitesi şu anda kullanılamıyor.'
        )
      );
    }
    const key = `weather:air-quality-hourly:${coordinateKey(query.lat, query.lon)}`;
    return this.cache.getOrLoad(key, this.config.CACHE_FORECAST_TTL_MS, async () => {
      const result = await provider.getAirQualityHourly({ lat: query.lat, lon: query.lon });
      return {
        hourly: result.hourly.slice(0, HOURLY_FORECAST_HOURS),
        meta: {
          provider: provider.name,
          attribution: provider.attribution,
          sourceUrl: provider.sourceUrl,
          fetchedAt: new Date().toISOString(),
          intervalHours: 1,
        },
      };
    });
  }

  getCurrent(query: CurrentWeatherQueryInput): Promise<CacheResult<CurrentWeatherDto>> {
    const providerQuery: CurrentWeatherQuery = query.city
      ? { city: query.city, units: query.units, lang: query.lang }
      : {
          lat: query.lat as number,
          lon: query.lon as number,
          units: query.units,
          lang: query.lang,
        };
    const locationKey = query.city
      ? `city:${normalizeCity(query.city)}`
      : `coords:${coordinateKey(query.lat as number, query.lon as number)}`;
    const key = `weather:current:${locationKey}:${query.units}:${query.lang}`;

    return this.cache.getOrLoad(key, this.config.CACHE_CURRENT_TTL_MS, async () => {
      const raw = await this.provider.getCurrent(providerQuery);
      const primaryWeather = raw.weather[0];

      return {
        cityName: raw.name,
        country: raw.sys.country,
        temperature: Math.round(raw.main.temp),
        feelsLike: Math.round(raw.main.feels_like),
        tempMin: Math.round(raw.main.temp_min),
        tempMax: Math.round(raw.main.temp_max),
        humidity: raw.main.humidity,
        pressure: raw.main.pressure,
        ...(raw.visibility === undefined ? {} : { visibility: raw.visibility }),
        windSpeed: raw.wind.speed,
        windDirection: raw.wind.deg,
        description: primaryWeather.description,
        icon: primaryWeather.icon,
        sunrise: new Date(raw.sys.sunrise * 1_000).toISOString(),
        sunset: new Date(raw.sys.sunset * 1_000).toISOString(),
        timestamp: new Date(raw.dt * 1_000).toISOString(),
        coordinates: raw.coord,
        clouds: raw.clouds.all,
        meta: {
          provider: this.provider.name ?? 'weather-provider',
          fetchedAt: new Date().toISOString(),
          timezoneOffsetSeconds: raw.timezone,
        },
      };
    });
  }

  getForecast(query: ForecastQueryInput): Promise<CacheResult<ForecastDto>> {
    const key = `weather:forecast:${coordinateKey(query.lat, query.lon)}:${query.units}:${query.lang}`;

    return this.cache.getOrLoad(key, this.config.CACHE_FORECAST_TTL_MS, async () => {
      const raw = await this.provider.getForecast(query);
      return this.normalizeForecast(raw);
    });
  }

  getHourlyForecast(query: HourlyForecastQueryInput): Promise<CacheResult<HourlyForecastDto>> {
    const key = `weather:hourly:${coordinateKey(query.lat, query.lon)}:${query.lang}`;

    return this.cache.getOrLoad(key, this.config.CACHE_FORECAST_TTL_MS, async () => {
      const result = await this.hourlyProvider.getHourly(query);
      return {
        ...(result.daily?.length ? { daily: result.daily.slice(0, 5) } : {}),
        hourly: result.hourly.slice(0, HOURLY_FORECAST_HOURS),
        meta: {
          provider: this.hourlyProvider.name,
          attribution: this.hourlyProvider.attribution,
          sourceUrl: this.hourlyProvider.sourceUrl,
          fetchedAt: new Date().toISOString(),
          timezoneOffsetSeconds: result.timezoneOffsetSeconds,
          intervalHours: 1,
        },
      };
    });
  }

  getAirQuality(query: AirQualityQueryInput): Promise<CacheResult<AirQualityDto>> {
    const key = `weather:air-quality:${coordinateKey(query.lat, query.lon)}:${query.lang}`;

    return this.cache.getOrLoad(key, this.config.CACHE_AIR_QUALITY_TTL_MS, async () => {
      const raw = await this.provider.getAirQuality(query);
      const sample = raw.list[0];
      const labels =
        query.lang === 'en'
          ? ['', 'Good', 'Fair', 'Moderate', 'Poor', 'Very Poor']
          : ['', 'İyi', 'Makul', 'Orta', 'Kötü', 'Çok kötü'];

      return {
        aqi: sample.main.aqi,
        aqiLabel: labels[sample.main.aqi] ?? (query.lang === 'en' ? 'Unknown' : 'Bilinmiyor'),
        pm25: sample.components.pm2_5,
        pm10: sample.components.pm10,
        o3: sample.components.o3,
        meta: {
          provider: this.provider.name ?? 'weather-provider',
          fetchedAt: new Date().toISOString(),
        },
      };
    });
  }

  private normalizeForecast(raw: ForecastUpstream): ForecastDto {
    const timezoneOffsetSeconds = raw.city.timezone;
    // The provider contract is chronological, but keep the public series stable if an
    // upstream payload arrives out of order. Sort a copy so provider-owned data is untouched.
    const chronologicalItems = [...raw.list].sort((left, right) => left.dt - right.dt);
    const hourly = chronologicalItems.slice(0, 16).map(item => ({
      time: new Date(item.dt * 1_000).toISOString(),
      temp: Math.round(item.main.temp),
      icon: item.weather[0].icon,
      description: item.weather[0].description,
      pop: Math.round(item.pop * 100),
      windSpeed: item.wind.speed,
    }));

    const dailyGroups = new Map<string, ForecastUpstream['list']>();
    for (const item of chronologicalItems) {
      const dateKey = dateKeyAtOffset(item.dt, timezoneOffsetSeconds);
      const group = dailyGroups.get(dateKey) ?? [];
      group.push(item);
      dailyGroups.set(dateKey, group);
    }

    const daily = Array.from(dailyGroups.entries())
      .slice(0, 5)
      .map(([date, items]) => {
        const temperatures = items.map(item => item.main.temp);
        const representative = items.reduce((best, item) => {
          const localHour = new Date((item.dt + timezoneOffsetSeconds) * 1_000).getUTCHours();
          const bestHour = new Date((best.dt + timezoneOffsetSeconds) * 1_000).getUTCHours();
          return Math.abs(localHour - 12) < Math.abs(bestHour - 12) ? item : best;
        }, items[0]);

        return {
          date,
          tempMin: Math.round(Math.min(...temperatures)),
          tempMax: Math.round(Math.max(...temperatures)),
          icon: representative.weather[0].icon,
          description: representative.weather[0].description,
          pop: Math.round(Math.max(...items.map(item => item.pop)) * 100),
        };
      });

    return {
      daily,
      hourly,
      meta: {
        provider: this.provider.name ?? 'weather-provider',
        fetchedAt: new Date().toISOString(),
        timezoneOffsetSeconds,
        intervalHours: 3,
      },
    };
  }
}
