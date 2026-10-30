import type { AppConfig } from '../config/env';
import { CopernicusContextGrid } from './copernicus/context-grid';
import {
  ContextSignalsService,
  type ContextSignalsSource,
} from '../modules/context/context.service';
import { MetNorwayContextService } from './metno/metno-context.service';
import { MetNorwayHourlyProvider } from './metno/metno-hourly.provider';
import { MetNorwayProvincesProvider } from './metno/metno-provinces.provider';
import { OpenMeteoAirQualityHourlyProvider } from './openmeteo/openmeteo-air-quality-hourly.provider';
import { OpenMeteoHourlyProvider } from './openmeteo/openmeteo-hourly.provider';
import {
  OpenMeteoProvincesProvider,
  type ProvinceCurrentProvider,
} from './openmeteo/openmeteo-provinces.provider';
import { OpenWeatherAirQualityHourlyProvider } from './openweather/openweather-air-quality-hourly.provider';
import type { AirQualityHourlyProvider, HourlyForecastProvider } from './weather-provider';

export interface DataSources {
  hourlyProvider: HourlyForecastProvider;
  airQualityHourlyProvider: AirQualityHourlyProvider;
  provincesProvider: ProvinceCurrentProvider;
  contextService: ContextSignalsSource;
}

/**
 * Picks the upstreams behind the forecast, the 81 provinces, hourly air quality and the
 * context signals. The default (`metno`) is the commercial-use set: MET Norway (CC BY 4.0)
 * and OpenWeather's free plan. Open-Meteo stays available for a paid plan.
 */
export const createDataSources = (env: AppConfig, fetchImpl: typeof fetch = fetch): DataSources => {
  if (env.WEATHER_DATA_SOURCE === 'openmeteo') {
    return {
      hourlyProvider: new OpenMeteoHourlyProvider(
        fetchImpl,
        env.OPENWEATHER_TIMEOUT_MS,
        env.OPEN_METEO_FORECAST_BASE_URL,
        env.OPEN_METEO_API_KEY
      ),
      airQualityHourlyProvider: new OpenMeteoAirQualityHourlyProvider(
        fetchImpl,
        env.OPENWEATHER_TIMEOUT_MS,
        env.OPEN_METEO_AIR_QUALITY_BASE_URL,
        env.OPEN_METEO_API_KEY
      ),
      provincesProvider: new OpenMeteoProvincesProvider(
        fetchImpl,
        env.OPENWEATHER_TIMEOUT_MS,
        env.OPEN_METEO_FORECAST_BASE_URL,
        env.OPEN_METEO_API_KEY
      ),
      contextService: new ContextSignalsService(fetchImpl, {
        airQualityBaseUrl: env.OPEN_METEO_AIR_QUALITY_BASE_URL,
        marineBaseUrl: env.OPEN_METEO_MARINE_BASE_URL,
        apiKey: env.OPEN_METEO_API_KEY,
      }),
    };
  }
  const met = {
    userAgent: env.UPSTREAM_USER_AGENT,
    timeoutMs: env.OPENWEATHER_TIMEOUT_MS,
    metBaseUrl: env.MET_NORWAY_FORECAST_URL,
  };
  return {
    hourlyProvider: new MetNorwayHourlyProvider(fetchImpl, {
      ...met,
      openWeatherApiKey: env.OPENWEATHER_API_KEY,
      openWeatherBaseUrl: env.OPENWEATHER_BASE_URL,
    }),
    airQualityHourlyProvider: new OpenWeatherAirQualityHourlyProvider(fetchImpl, {
      apiKey: env.OPENWEATHER_API_KEY,
      baseUrl: env.OPENWEATHER_BASE_URL,
      timeoutMs: env.OPENWEATHER_TIMEOUT_MS,
    }),
    provincesProvider: new MetNorwayProvincesProvider(fetchImpl, met),
    contextService: new MetNorwayContextService(fetchImpl, {
      ...met,
      grid: env.CONTEXT_GRID_URL
        ? new CopernicusContextGrid(fetchImpl, { url: env.CONTEXT_GRID_URL })
        : undefined,
    }),
  };
};
