import type { AppConfig } from '../../config/env';
import type { AsyncCache, CacheResult } from '../../core/cache';
import type {
  CurrentWeatherQuery,
  WeatherProvider,
} from '../../providers/weather-provider';
import type { ForecastUpstream } from '../../providers/openweather/schemas';
import type {
  AirQualityDto,
  AirQualityQueryInput,
  CurrentWeatherDto,
  CurrentWeatherQueryInput,
  ForecastDto,
  ForecastQueryInput,
} from './contracts';

const coordinateKey = (lat: number, lon: number): string =>
  `${lat.toFixed(3)}:${lon.toFixed(3)}`;

const normalizeCity = (city: string): string => city.toLocaleLowerCase('tr-TR').trim();

export class WeatherService {
  constructor(
    private readonly provider: WeatherProvider,
    private readonly cache: AsyncCache,
    private readonly config: Pick<
      AppConfig,
      'CACHE_CURRENT_TTL_MS' | 'CACHE_FORECAST_TTL_MS' | 'CACHE_AIR_QUALITY_TTL_MS'
    >,
  ) {}

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
        visibility: raw.visibility,
        windSpeed: raw.wind.speed,
        windDirection: raw.wind.deg,
        description: primaryWeather.description,
        icon: primaryWeather.icon,
        sunrise: new Date(raw.sys.sunrise * 1_000).toISOString(),
        sunset: new Date(raw.sys.sunset * 1_000).toISOString(),
        timestamp: new Date(raw.dt * 1_000).toISOString(),
        coordinates: raw.coord,
        clouds: raw.clouds.all,
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

  getAirQuality(query: AirQualityQueryInput): Promise<CacheResult<AirQualityDto>> {
    const key = `weather:air-quality:${coordinateKey(query.lat, query.lon)}:${query.lang}`;

    return this.cache.getOrLoad(key, this.config.CACHE_AIR_QUALITY_TTL_MS, async () => {
      const raw = await this.provider.getAirQuality(query);
      const sample = raw.list[0];
      const labels =
        query.lang === 'en'
          ? ['', 'Good', 'Fair', 'Moderate', 'Poor', 'Very Poor']
          : ['', 'İyi', 'Orta', 'Hassas', 'Sağlıksız', 'Çok Sağlıksız'];

      return {
        aqi: sample.main.aqi,
        aqiLabel: labels[sample.main.aqi] ?? (query.lang === 'en' ? 'Unknown' : 'Bilinmiyor'),
        pm25: sample.components.pm2_5,
        pm10: sample.components.pm10,
        o3: sample.components.o3,
      };
    });
  }

  private normalizeForecast(raw: ForecastUpstream): ForecastDto {
    const hourly = raw.list.slice(0, 8).map((item) => ({
      time: new Date(item.dt * 1_000).toISOString(),
      temp: Math.round(item.main.temp),
      icon: item.weather[0].icon,
      pop: Math.round(item.pop * 100),
    }));

    const dailyGroups = new Map<string, ForecastUpstream['list']>();
    for (const item of raw.list) {
      const dateKey = item.dt_txt.split(' ')[0];
      const group = dailyGroups.get(dateKey) ?? [];
      group.push(item);
      dailyGroups.set(dateKey, group);
    }

    const daily = Array.from(dailyGroups.entries())
      .slice(0, 5)
      .map(([date, items]) => {
        const temperatures = items.map((item) => item.main.temp);
        const representative = items.find((item) => item.dt_txt.includes('12:00')) ?? items[0];

        return {
          date: new Date(`${date}T00:00:00.000Z`).toISOString(),
          tempMin: Math.round(Math.min(...temperatures)),
          tempMax: Math.round(Math.max(...temperatures)),
          icon: representative.weather[0].icon,
          description: representative.weather[0].description,
          pop: Math.round(Math.max(...items.map((item) => item.pop)) * 100),
        };
      });

    return { daily, hourly };
  }
}
