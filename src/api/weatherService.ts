/** Weather API service: browser -> Hava81 BFF only. */
import { httpClient, type HttpRequestOptions } from './httpClient';
import { isAbortError } from './abort';
import { ApiError } from './errors/ApiError';
import { API_ENDPOINTS, DEFAULT_WEATHER_PARAMS } from '../config';
import {
  BundleUnavailableError,
  FORECAST_BUNDLE_PARTS,
  type BundlePartResult,
  type ForecastBundle,
  type ForecastBundlePart,
  type ParsedForecast,
  type ParsedHourlyForecast,
} from './weatherBundle';
import { normalizePrecipitationProbability } from '../utils/precipitation';
import { nearestTurkishProvince } from '../utils/cityRoute';
import { ErrorCode } from '../types';
import type {
  NormalizedWeatherData,
  WeatherQueryParams,
  DailyForecast,
  HourlyForecast,
  AirQuality,
  AirQualityHour,
  AirQualityHourly,
  ForecastMeta,
  WeatherDataMeta,
  CurrentWeatherMeta,
  ContextSignals,
  RouteWeatherResult,
} from '../types';

type SerializedMeta = Omit<WeatherDataMeta, 'fetchedAt'> & { fetchedAt: string };
type SerializedCurrentMeta = Omit<CurrentWeatherMeta, 'fetchedAt'> & { fetchedAt: string };
type SerializedWeatherData = Omit<
  NormalizedWeatherData,
  'sunrise' | 'sunset' | 'timestamp' | 'meta'
> & {
  sunrise: string;
  sunset: string;
  timestamp: string;
  meta: SerializedCurrentMeta;
};

type SerializedDailyForecast = Omit<DailyForecast, 'date' | 'sunrise' | 'sunset'> & {
  date: string;
  sunrise?: string;
  sunset?: string;
};

type SerializedForecast = {
  daily: SerializedDailyForecast[];
  hourly: Array<Omit<HourlyForecast, 'time'> & { time: string }>;
  meta: Omit<ForecastMeta, 'fetchedAt'> & { fetchedAt: string };
};

type SerializedHourlyForecast = {
  daily?: SerializedDailyForecast[];
  hourly: Array<Omit<HourlyForecast, 'time'> & { time: string }>;
  meta: Omit<ForecastMeta, 'fetchedAt'> & { fetchedAt: string };
};

type SerializedAirQuality = Omit<AirQuality, 'meta'> & { meta: SerializedMeta };

type BootstrapWeatherRequest = {
  city: string;
  lang: string;
  units: string;
  promise: Promise<SerializedWeatherData | null>;
};

type BootstrapHourlyResult = {
  lat: number;
  lon: number;
  response: SerializedHourlyForecast;
};

type BootstrapHourlyRequest = {
  lang: string;
  promise: Promise<BootstrapHourlyResult | null>;
};

declare global {
  interface Window {
    __HAVA81_BOOTSTRAP_WEATHER__?: BootstrapWeatherRequest;
    __HAVA81_BOOTSTRAP_HOURLY__?: BootstrapHourlyRequest;
  }
}

const invalidWeatherPayload = (field: string): never => {
  throw new ApiError('Hava verisi doğrulanamadı', ErrorCode.API_ERROR, {
    retryable: true,
    details: { field },
  });
};

const reviveWeatherDate = (value: string, field: string): Date => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return invalidWeatherPayload(field);
  return date;
};

const MAX_CURRENT_WEATHER_FUTURE_SKEW_MS = 60_000;
const MAX_FORECAST_FUTURE_SKEW_MS = 60_000;
const WEATHER_ICON_CODE_PATTERN = /^(?:0[1-4]|09|10|11|13|50)[dn]$/;
const MAX_CONTEXT_FUTURE_SKEW_MS = 60_000;
const MAX_AIR_QUALITY_FUTURE_SKEW_MS = 60_000;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

type WeatherUnits = NonNullable<WeatherQueryParams['units']>;

const plausibleTemperatureRange: Record<WeatherUnits, readonly [number, number]> = {
  metric: [-100, 100],
  imperial: [-148, 212],
  standard: [173.15, 373.15],
};

const isPlausibleTemperature = (value: unknown, units: WeatherUnits): value is number => {
  if (!isFiniteNumber(value)) return false;
  const [min, max] = plausibleTemperatureRange[units];
  return value >= min && value <= max;
};

const CURRENT_WEATHER_ICON_CODE_PATTERN = /^(?:0[1-4]|09|10|11|13|50)[dn]$/;

const validateCurrentWeatherPayload = (data: SerializedWeatherData, units: WeatherUnits): void => {
  const invalid = (condition: boolean, field: string) => {
    if (condition) invalidWeatherPayload(field);
  };

  invalid(!isRecord(data), 'current');
  invalid(!isRecord(data.meta), 'current.meta');
  invalid(typeof data.cityName !== 'string' || !data.cityName.trim(), 'current.cityName');
  invalid(typeof data.country !== 'string' || !data.country.trim(), 'current.country');
  for (const field of ['temperature', 'feelsLike', 'tempMin', 'tempMax'] as const) {
    invalid(!isPlausibleTemperature(data[field], units), `current.${field}`);
  }
  invalid(data.tempMin > data.tempMax, 'current.tempRange');
  invalid(
    !isFiniteNumber(data.humidity) || data.humidity < 0 || data.humidity > 100,
    'current.humidity'
  );
  invalid(!isFiniteNumber(data.pressure) || data.pressure <= 0, 'current.pressure');
  invalid(
    data.visibility !== undefined && (!isFiniteNumber(data.visibility) || data.visibility < 0),
    'current.visibility'
  );
  invalid(!isFiniteNumber(data.windSpeed) || data.windSpeed < 0, 'current.windSpeed');
  invalid(
    !isFiniteNumber(data.windDirection) || data.windDirection < 0 || data.windDirection > 360,
    'current.windDirection'
  );
  invalid(!isFiniteNumber(data.clouds) || data.clouds < 0 || data.clouds > 100, 'current.clouds');
  invalid(
    !isFiniteNumber(data.coordinates?.lat) ||
      data.coordinates.lat < -90 ||
      data.coordinates.lat > 90,
    'current.coordinates.lat'
  );
  invalid(
    !isFiniteNumber(data.coordinates?.lon) ||
      data.coordinates.lon < -180 ||
      data.coordinates.lon > 180,
    'current.coordinates.lon'
  );
  invalid(
    typeof data.icon !== 'string' || !CURRENT_WEATHER_ICON_CODE_PATTERN.test(data.icon),
    'current.icon'
  );
  invalid(typeof data.description !== 'string' || !data.description.trim(), 'current.description');
  invalid(
    typeof data.meta?.provider !== 'string' || !data.meta.provider.trim(),
    'current.meta.provider'
  );
  invalid(
    !isFiniteNumber(data.meta.timezoneOffsetSeconds) ||
      data.meta.timezoneOffsetSeconds < -43_200 ||
      data.meta.timezoneOffsetSeconds > 50_400,
    'current.meta.timezoneOffsetSeconds'
  );
  invalid(
    data.meta.freshForSeconds !== undefined &&
      (!isFiniteNumber(data.meta.freshForSeconds) ||
        data.meta.freshForSeconds <= 0 ||
        data.meta.freshForSeconds > 86_400),
    'current.meta.freshForSeconds'
  );
};

const invalidForecastPayload = (field: string): never => {
  throw new ApiError('Tahmin verisi doğrulanamadı', ErrorCode.API_ERROR, {
    retryable: true,
    details: { field },
  });
};

const reviveForecastDate = (value: string, field: string, dateOnly = false): Date => {
  if (dateOnly && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return invalidForecastPayload(field);
  }

  const date = new Date(dateOnly ? `${value}T12:00:00.000Z` : value);
  if (Number.isNaN(date.getTime())) return invalidForecastPayload(field);
  if (dateOnly && date.toISOString().slice(0, 10) !== value) {
    return invalidForecastPayload(field);
  }
  return date;
};

const normalizeBffPrecipitationProbability = (value: number, field: string): number => {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    return invalidForecastPayload(field);
  }
  return normalizePrecipitationProbability(value);
};

const validateForecastEnvelope = (
  data: unknown,
  field: string,
  dailyOptional = false
): SerializedForecast | SerializedHourlyForecast => {
  if (!isRecord(data)) invalidForecastPayload(field);
  const envelope = data as Record<string, unknown>;
  if (!isRecord(envelope.meta)) invalidForecastPayload(`${field}.meta`);
  if (!Array.isArray(envelope.hourly)) invalidForecastPayload(`${field}.hourly`);
  if (dailyOptional) {
    if (envelope.daily !== undefined && !Array.isArray(envelope.daily)) {
      invalidForecastPayload(`${field}.daily`);
    }
  } else if (!Array.isArray(envelope.daily)) {
    invalidForecastPayload(`${field}.daily`);
  }
  return envelope as SerializedForecast | SerializedHourlyForecast;
};

const validateForecastMeta = (meta: SerializedForecast['meta'], field: string): void => {
  const invalid = (condition: boolean, suffix: string) => {
    if (condition) invalidForecastPayload(`${field}.${suffix}`);
  };
  invalid(typeof meta.provider !== 'string' || !meta.provider.trim(), 'provider');
  if (meta.sourceUrl !== undefined) {
    let safeSourceUrl = false;
    if (typeof meta.sourceUrl === 'string') {
      try {
        const parsedSourceUrl = new URL(meta.sourceUrl);
        safeSourceUrl = parsedSourceUrl.protocol === 'https:';
      } catch {
        safeSourceUrl = false;
      }
    }
    invalid(!safeSourceUrl, 'sourceUrl');
  }
  invalid(
    !isFiniteNumber(meta.timezoneOffsetSeconds) ||
      meta.timezoneOffsetSeconds < -43_200 ||
      meta.timezoneOffsetSeconds > 50_400,
    'timezoneOffsetSeconds'
  );
  invalid(
    !isFiniteNumber(meta.intervalHours) || meta.intervalHours <= 0 || meta.intervalHours > 24,
    'intervalHours'
  );
  invalid(
    meta.freshForSeconds !== undefined &&
      (!isFiniteNumber(meta.freshForSeconds) ||
        meta.freshForSeconds <= 0 ||
        meta.freshForSeconds > 86_400),
    'freshForSeconds'
  );
};

const reviveForecastMeta = (
  meta: SerializedForecast['meta'],
  field: string
): ForecastMeta => {
  validateForecastMeta(meta, field);
  const fetchedAt = reviveForecastDate(meta.fetchedAt, `${field}.fetchedAt`);
  if (fetchedAt.getTime() > Date.now() + MAX_FORECAST_FUTURE_SKEW_MS) {
    invalidForecastPayload(`${field}.fetchedAt`);
  }
  return { ...meta, fetchedAt };
};

const validateDailyForecastItem = (
  item: SerializedForecast['daily'][number],
  field: string,
  units: WeatherUnits
): void => {
  if (!isRecord(item)) invalidForecastPayload(field);
  if (!isPlausibleTemperature(item.tempMin, units)) invalidForecastPayload(`${field}.tempMin`);
  if (!isPlausibleTemperature(item.tempMax, units)) invalidForecastPayload(`${field}.tempMax`);
  if (item.tempMin > item.tempMax) invalidForecastPayload(`${field}.tempRange`);
  if (typeof item.description !== 'string' || !item.description.trim()) {
    invalidForecastPayload(`${field}.description`);
  }
  if (typeof item.icon !== 'string' || !WEATHER_ICON_CODE_PATTERN.test(item.icon)) {
    invalidForecastPayload(`${field}.icon`);
  }
  if (
    item.precipitationMm !== undefined &&
    (!isFiniteNumber(item.precipitationMm) || item.precipitationMm < 0)
  ) {
    invalidForecastPayload(`${field}.precipitationMm`);
  }
};

const validateHourlyForecastItem = (
  item: SerializedForecast['hourly'][number],
  field: string,
  units: WeatherUnits
): void => {
  if (!isRecord(item)) invalidForecastPayload(field);
  const invalid = (condition: boolean, suffix: string) => {
    if (condition) invalidForecastPayload(`${field}.${suffix}`);
  };
  invalid(!isPlausibleTemperature(item.temp, units), 'temp');
  invalid(typeof item.icon !== 'string' || !WEATHER_ICON_CODE_PATTERN.test(item.icon), 'icon');
  invalid(item.description !== undefined && (!item.description || !item.description.trim()), 'description');
  invalid(!isFiniteNumber(item.windSpeed) || item.windSpeed < 0, 'windSpeed');
  invalid(
    item.apparentTemperature !== undefined && !isPlausibleTemperature(item.apparentTemperature, units),
    'apparentTemperature'
  );
  invalid(item.humidity !== undefined && (!isFiniteNumber(item.humidity) || item.humidity < 0 || item.humidity > 100), 'humidity');
  invalid(item.precipitationMm !== undefined && (!isFiniteNumber(item.precipitationMm) || item.precipitationMm < 0), 'precipitationMm');
  invalid(item.windGust !== undefined && (!isFiniteNumber(item.windGust) || item.windGust < 0), 'windGust');
  invalid(item.uvIndex !== undefined && (!isFiniteNumber(item.uvIndex) || item.uvIndex < 0), 'uvIndex');
  invalid(item.visibility !== undefined && (!isFiniteNumber(item.visibility) || item.visibility < 0), 'visibility');
  invalid(item.weatherCode !== undefined && (!Number.isInteger(item.weatherCode) || item.weatherCode < 0 || item.weatherCode > 99), 'weatherCode');
  invalid(item.isDay !== undefined && typeof item.isDay !== 'boolean', 'isDay');
};

/** API `isDay` first; older API revisions only encode daylight in the icon suffix. */
const resolveIsDay = (item: { isDay?: unknown; icon: string }): boolean =>
  typeof item.isDay === 'boolean' ? item.isDay : !item.icon.endsWith('n');

/**
 * Sunrise/sunset are optional enrichments: a malformed or incoherent pair is dropped
 * instead of rejecting the whole forecast.
 */
const reviveDaylightBounds = (item: {
  sunrise?: unknown;
  sunset?: unknown;
}): { sunrise?: Date; sunset?: Date } => {
  if (typeof item.sunrise !== 'string' || typeof item.sunset !== 'string') return {};
  const sunrise = new Date(item.sunrise);
  const sunset = new Date(item.sunset);
  if (!Number.isFinite(sunrise.getTime()) || !Number.isFinite(sunset.getTime())) return {};
  if (sunset.getTime() <= sunrise.getTime()) return {};
  return { sunrise, sunset };
};

const validateContextSignalsPayload = (
  data: Omit<ContextSignals, 'fetchedAt'> & { fetchedAt: string }
): ContextSignals => {
  if (!isRecord(data)) invalidForecastPayload('context');
  const fetchedAt = reviveForecastDate(data.fetchedAt, 'context.fetchedAt');
  const invalid = (condition: boolean, field: string) => {
    if (condition) invalidForecastPayload(field);
  };
  const latestPlausibleContextTimestamp = Date.now() + MAX_CONTEXT_FUTURE_SKEW_MS;

  invalid(fetchedAt.getTime() > latestPlausibleContextTimestamp, 'context.fetchedAt');
  invalid(typeof data.provider !== 'string' || !data.provider.trim(), 'context.provider');
  invalid(typeof data.attribution !== 'string' || !data.attribution.trim(), 'context.attribution');
  if (!isRecord(data.units)) invalidForecastPayload('context.units');
  for (const field of [
    'dust',
    'grassPollen',
    'olivePollen',
    'waveHeight',
    'waveDirection',
    'wavePeriod',
    'seaSurfaceTemperature',
  ] as const) {
    const value = data.units[field];
    invalid(value !== undefined && typeof value !== 'string', `context.units.${field}`);
  }
  for (const field of ['uvIndexMax', 'dustMax', 'grassPollenMax', 'olivePollenMax'] as const) {
    const value = data[field];
    invalid(value !== undefined && (!isFiniteNumber(value) || value < 0), `context.${field}`);
  }
  for (const [valueField, unitField] of [
    ['dustMax', 'dust'],
    ['grassPollenMax', 'grassPollen'],
    ['olivePollenMax', 'olivePollen'],
  ] as const) {
    invalid(
      data[valueField] !== undefined &&
        (typeof data.units[unitField] !== 'string' || !data.units[unitField]?.trim()),
      `context.units.${unitField}`
    );
  }
  invalid(
    data.freshForSeconds !== undefined &&
      (!isFiniteNumber(data.freshForSeconds) ||
        data.freshForSeconds <= 0 ||
        data.freshForSeconds > 86_400),
    'context.freshForSeconds'
  );
  if (data.marine !== undefined && !isRecord(data.marine)) {
    invalidForecastPayload('context.marine');
  }
  if (data.marine) {
    const marineObservedAt = reviveForecastDate(
      data.marine.observedAt,
      'context.marine.observedAt'
    );
    invalid(
      marineObservedAt.getTime() > latestPlausibleContextTimestamp,
      'context.marine.observedAt'
    );
    invalid(
      data.marine.waveHeight !== undefined &&
        (!isFiniteNumber(data.marine.waveHeight) || data.marine.waveHeight < 0),
      'context.marine.waveHeight'
    );
    invalid(
      data.marine.waveDirection !== undefined &&
        (!isFiniteNumber(data.marine.waveDirection) ||
          data.marine.waveDirection < 0 ||
          data.marine.waveDirection > 360),
      'context.marine.waveDirection'
    );
    invalid(
      data.marine.wavePeriod !== undefined &&
        (!isFiniteNumber(data.marine.wavePeriod) || data.marine.wavePeriod <= 0),
      'context.marine.wavePeriod'
    );
    invalid(
      data.marine.seaSurfaceTemperature !== undefined &&
        !isFiniteNumber(data.marine.seaSurfaceTemperature),
      'context.marine.seaSurfaceTemperature'
    );
    for (const field of [
      'waveHeight',
      'waveDirection',
      'wavePeriod',
      'seaSurfaceTemperature',
    ] as const) {
      invalid(
        data.marine[field] !== undefined &&
          (typeof data.units[field] !== 'string' || !data.units[field]?.trim()),
        `context.units.${field}`
      );
    }
  }

  return { ...data, fetchedAt };
};

/**
 * Plan v3 (P1.2): hourly European AQI. Malformed hours are dropped; an envelope without any
 * usable hour is rejected so the engine falls back to the current OpenWeather AQI.
 */
const parseAirQualityHourlyPayload = (value: unknown): AirQualityHourly => {
  if (!isRecord(value) || !Array.isArray(value.hourly) || !isRecord(value.meta)) {
    return invalidWeatherPayload('airQualityHourly');
  }
  const meta = value.meta;
  if (typeof meta.provider !== 'string' || !meta.provider.trim()) {
    invalidWeatherPayload('airQualityHourly.meta.provider');
  }
  const fetchedAt = typeof meta.fetchedAt === 'string' ? new Date(meta.fetchedAt) : new Date(NaN);
  if (!Number.isFinite(fetchedAt.getTime()) || fetchedAt.getTime() > Date.now() + MAX_AIR_QUALITY_FUTURE_SKEW_MS) {
    invalidWeatherPayload('airQualityHourly.meta.fetchedAt');
  }
  const hours: AirQualityHour[] = [];
  for (const item of value.hourly as unknown[]) {
    if (!isRecord(item) || typeof item.time !== 'string') continue;
    const time = new Date(item.time);
    if (!Number.isFinite(time.getTime())) continue;
    if (!isFiniteNumber(item.europeanAqi) || item.europeanAqi < 0 || item.europeanAqi > 1_000) continue;
    const hour: AirQualityHour = { time, europeanAqi: item.europeanAqi };
    if (isFiniteNumber(item.pm25) && item.pm25 >= 0) hour.pm25 = item.pm25;
    hours.push(hour);
  }
  if (!hours.length) invalidWeatherPayload('airQualityHourly.hourly');
  hours.sort((a, b) => a.time.getTime() - b.time.getTime());
  return {
    hours,
    meta: {
      provider: (meta.provider as string).trim(),
      fetchedAt,
      ...(typeof meta.attribution === 'string' ? { attribution: meta.attribution } : {}),
      ...(typeof meta.sourceUrl === 'string' ? { sourceUrl: meta.sourceUrl } : {}),
      ...(isFiniteNumber(meta.intervalHours) ? { intervalHours: meta.intervalHours } : {}),
      ...(meta.cacheStatus === 'HIT' || meta.cacheStatus === 'MISS' || meta.cacheStatus === 'COALESCED'
        ? { cacheStatus: meta.cacheStatus }
        : {}),
      ...(isFiniteNumber(meta.freshForSeconds) && meta.freshForSeconds > 0
        ? { freshForSeconds: meta.freshForSeconds }
        : {}),
    },
  };
};

const validateAirQualityPayload = (data: SerializedAirQuality): AirQuality => {
  if (!isRecord(data)) invalidWeatherPayload('airQuality');
  if (!isRecord(data.meta)) invalidWeatherPayload('airQuality.meta');
  const invalid = (condition: boolean, field: string) => {
    if (condition) invalidWeatherPayload(field);
  };
  invalid(!Number.isInteger(data.aqi) || data.aqi < 1 || data.aqi > 5, 'airQuality.aqi');
  invalid(typeof data.aqiLabel !== 'string' || !data.aqiLabel.trim(), 'airQuality.aqiLabel');
  for (const field of ['pm25', 'pm10', 'o3'] as const) {
    invalid(!isFiniteNumber(data[field]) || data[field] < 0, `airQuality.${field}`);
  }
  invalid(
    typeof data.meta?.provider !== 'string' || !data.meta.provider.trim(),
    'airQuality.meta.provider'
  );
  invalid(
    data.meta?.freshForSeconds !== undefined &&
      (!isFiniteNumber(data.meta.freshForSeconds) ||
        data.meta.freshForSeconds <= 0 ||
        data.meta.freshForSeconds > 86_400),
    'airQuality.meta.freshForSeconds'
  );

  const meta = reviveAirQualityMeta(data.meta);
  if (meta.fetchedAt.getTime() > Date.now() + MAX_AIR_QUALITY_FUTURE_SKEW_MS) {
    invalidWeatherPayload('airQuality.meta.fetchedAt');
  }

  return {
    ...data,
    aqiLabel: data.aqiLabel.trim(),
    meta,
  };
};

const validateRouteWeatherPayload = (data: RouteWeatherResult): RouteWeatherResult => {
  if (!isRecord(data)) invalidForecastPayload('route');
  const invalid = (condition: boolean, field: string) => {
    if (condition) invalidForecastPayload(field);
  };
  const validScore = (value: unknown) => isFiniteNumber(value) && value >= 0 && value <= 100;
  const validDateString = (value: unknown) =>
    typeof value === 'string' && !Number.isNaN(new Date(value).getTime());

  invalid(data.kind !== 'corridor-estimate', 'route.kind');
  invalid(
    !isFiniteNumber(data.estimatedDistanceKm) || data.estimatedDistanceKm < 0,
    'route.estimatedDistanceKm'
  );
  invalid(
    !isFiniteNumber(data.estimatedDurationMinutes) || data.estimatedDurationMinutes <= 0,
    'route.estimatedDurationMinutes'
  );
  invalid(!validDateString(data.requestedDeparture), 'route.requestedDeparture');
  const requestedDepartureMs = Date.parse(data.requestedDeparture);
  invalid(!validScore(data.score), 'route.score');
  const expectedRouteFractions = [0, 0.25, 0.5, 0.75, 1] as const;
  invalid(
    !Array.isArray(data.segments) || data.segments.length !== expectedRouteFractions.length,
    'route.segments'
  );
  invalid(typeof data.disclaimer !== 'string' || !data.disclaimer.trim(), 'route.disclaimer');

  for (const [index, segment] of data.segments.entries()) {
    const prefix = `route.segments.${index}`;
    if (!isRecord(segment)) invalidForecastPayload(prefix);
    invalid(
      !isFiniteNumber(segment.fraction) ||
        Math.abs(segment.fraction - expectedRouteFractions[index]) > Number.EPSILON,
      `${prefix}.fraction`
    );
    invalid(!isFiniteNumber(segment.lat) || segment.lat < -90 || segment.lat > 90, `${prefix}.lat`);
    invalid(!isFiniteNumber(segment.lon) || segment.lon < -180 || segment.lon > 180, `${prefix}.lon`);
    invalid(!validDateString(segment.eta), `${prefix}.eta`);
    if (validDateString(segment.eta)) {
      const expectedEtaMs =
        requestedDepartureMs + data.estimatedDurationMinutes * 60_000 * segment.fraction;
      invalid(Math.abs(Date.parse(segment.eta) - expectedEtaMs) > 1, `${prefix}.eta`);
    }
    invalid(
      !isPlausibleTemperature(segment.temperature, DEFAULT_WEATHER_PARAMS.units),
      `${prefix}.temperature`
    );
    invalid(
      !isFiniteNumber(segment.precipitationProbability) ||
        segment.precipitationProbability < 0 ||
        segment.precipitationProbability > 100,
      `${prefix}.precipitationProbability`
    );
    invalid(
      segment.precipitationMm !== undefined &&
        (!isFiniteNumber(segment.precipitationMm) || segment.precipitationMm < 0),
      `${prefix}.precipitationMm`
    );
    invalid(!isFiniteNumber(segment.windSpeed) || segment.windSpeed < 0, `${prefix}.windSpeed`);
    invalid(typeof segment.description !== 'string' || !segment.description.trim(), `${prefix}.description`);
    invalid(!validScore(segment.score), `${prefix}.score`);
    invalid(!['low', 'caution', 'high'].includes(segment.risk), `${prefix}.risk`);
  }

  if (data.betterDeparture !== undefined && !isRecord(data.betterDeparture)) {
    invalidForecastPayload('route.betterDeparture');
  }
  if (data.betterDeparture) {
    invalid(!validDateString(data.betterDeparture.departure), 'route.betterDeparture.departure');
    if (validDateString(data.betterDeparture.departure)) {
      invalid(
        Date.parse(data.betterDeparture.departure) !== requestedDepartureMs + 3 * 60 * 60_000,
        'route.betterDeparture.departure'
      );
    }
    invalid(!validScore(data.betterDeparture.score), 'route.betterDeparture.score');
    invalid(
      !isFiniteNumber(data.betterDeparture.improvement) ||
        data.betterDeparture.improvement <= 0 ||
        data.betterDeparture.improvement !== data.betterDeparture.score - data.score,
      'route.betterDeparture.improvement'
    );
  }

  return data;
};

const cityKey = (value: string) => value.trim().toLocaleLowerCase('tr-TR');
const takeBootstrapWeather = (
  city: string,
  lang: string,
  units: string
): Promise<SerializedWeatherData | null> | null => {
  if (typeof window === 'undefined') return null;
  const bootstrap = window.__HAVA81_BOOTSTRAP_WEATHER__;
  if (
    !bootstrap ||
    cityKey(bootstrap.city) !== cityKey(city) ||
    bootstrap.lang !== lang ||
    bootstrap.units !== units
  ) {
    return null;
  }
  delete window.__HAVA81_BOOTSTRAP_WEATHER__;
  return bootstrap.promise;
};

const takeBootstrapHourly = (
  lat: number,
  lon: number,
  lang: string
): Promise<SerializedHourlyForecast | null> | null => {
  if (typeof window === 'undefined') return null;
  const bootstrap = window.__HAVA81_BOOTSTRAP_HOURLY__;
  if (!bootstrap || bootstrap.lang !== lang) return null;
  delete window.__HAVA81_BOOTSTRAP_HOURLY__;
  return bootstrap.promise.then(result => {
    if (!result) return null;
    const sameCoordinate = (actual: number, expected: number) => Math.abs(actual - expected) < 1e-6;
    return sameCoordinate(result.lat, lat) && sameCoordinate(result.lon, lon)
      ? result.response
      : null;
  });
};

const reviveAirQualityMeta = (meta: SerializedMeta): WeatherDataMeta => ({
  ...meta,
  fetchedAt: reviveWeatherDate(meta.fetchedAt, 'airQuality.meta.fetchedAt'),
});

const reviveCurrentMeta = (meta: SerializedCurrentMeta): CurrentWeatherMeta => ({
  ...meta,
  fetchedAt: reviveWeatherDate(meta.fetchedAt, 'current.meta.fetchedAt'),
});

const reviveWeatherDates = (
  data: SerializedWeatherData,
  units: WeatherUnits
): NormalizedWeatherData => {
  validateCurrentWeatherPayload(data, units);
  const sunrise = reviveWeatherDate(data.sunrise, 'current.sunrise');
  const sunset = reviveWeatherDate(data.sunset, 'current.sunset');
  const timestamp = reviveWeatherDate(data.timestamp, 'current.timestamp');
  const meta = reviveCurrentMeta(data.meta);
  if (sunset.getTime() < sunrise.getTime()) {
    invalidWeatherPayload('current.sunset');
  }
  const latestPlausibleCurrentTimestamp = Date.now() + MAX_CURRENT_WEATHER_FUTURE_SKEW_MS;
  if (timestamp.getTime() > latestPlausibleCurrentTimestamp) {
    invalidWeatherPayload('current.timestamp');
  }
  if (meta.fetchedAt.getTime() > latestPlausibleCurrentTimestamp) {
    invalidWeatherPayload('current.meta.fetchedAt');
  }
  return {
    ...data,
    cityName: data.cityName.trim(),
    country: data.country.trim(),
    sunrise,
    sunset,
    timestamp,
    meta,
  };
};


const parseForecastResponse = (rawResponse: unknown): ParsedForecast => {
  const response = validateForecastEnvelope(rawResponse, 'forecast') as SerializedForecast;

  const meta = reviveForecastMeta(response.meta, 'forecast.meta');
  response.daily.forEach((item, index) =>
    validateDailyForecastItem(item, `forecast.daily.${index}`, DEFAULT_WEATHER_PARAMS.units)
  );
  response.hourly.slice(0, 8).forEach((item, index) =>
    validateHourlyForecastItem(item, `forecast.hourly.${index}`, DEFAULT_WEATHER_PARAMS.units)
  );

  return {
    // The 3-hour forecast has no daylight bounds; only the hourly part carries them.
    daily: response.daily.map(({ sunrise: _sunrise, sunset: _sunset, ...item }) => ({
      ...item,
      // Noon UTC prevents a date-only forecast from shifting a calendar day in western/eastern clients.
      date: reviveForecastDate(item.date, 'forecast.daily.date', true),
      pop: normalizeBffPrecipitationProbability(item.pop, 'forecast.daily.pop'),
    })),
    hourly: response.hourly.slice(0, 8).map(item => ({
      ...item,
      time: reviveForecastDate(item.time, 'forecast.hourly.time'),
      pop: normalizeBffPrecipitationProbability(item.pop, 'forecast.hourly.pop'),
    })),
    meta,
  };
};

/**
 * Hours shown by today's surfaces. The API may send up to five days (plan v3 P1.1); the extra
 * hours only feed the plan engine via `planHourly`, so existing surfaces keep their horizon.
 */
const DISPLAY_HOURLY_HOURS = 48;
/** Plan v3 horizon: five days of hourly guidance. */
export const PLAN_HOURLY_HOURS = 120;

/** Optional enrichments are dropped (never rejected) when out of range. */
const optionalNumberInRange = (value: unknown, min: number, max: number): number | undefined =>
  isFiniteNumber(value) && value >= min && value <= max ? value : undefined;

const reviveHourlyItem = (item: SerializedHourlyForecast['hourly'][number]): HourlyForecast => {
  const { dewPoint, sunshineDuration, ...rest } = item;
  const revived: HourlyForecast = {
    ...rest,
    time: reviveForecastDate(item.time, 'hourly.hourly.time'),
    pop: normalizeBffPrecipitationProbability(item.pop, 'hourly.hourly.pop'),
    isDay: resolveIsDay(item),
  };
  const dew = optionalNumberInRange(dewPoint, -100, 100);
  const sunshine = optionalNumberInRange(sunshineDuration, 0, 3_600);
  if (dew !== undefined) revived.dewPoint = dew;
  if (sunshine !== undefined) revived.sunshineDuration = sunshine;
  return revived;
};

const parseHourlyResponse = (rawResponse: unknown): ParsedHourlyForecast => {
  const response = validateForecastEnvelope(rawResponse, 'hourly', true) as SerializedHourlyForecast;
  const meta = reviveForecastMeta(response.meta, 'hourly.meta');
  response.daily?.slice(0, 5).forEach((item, index) =>
    validateDailyForecastItem(item, `hourly.daily.${index}`, DEFAULT_WEATHER_PARAMS.units)
  );
  response.hourly.slice(0, PLAN_HOURLY_HOURS).forEach((item, index) =>
    validateHourlyForecastItem(item, `hourly.hourly.${index}`, DEFAULT_WEATHER_PARAMS.units)
  );
  const planHourly = response.hourly.slice(0, PLAN_HOURLY_HOURS).map(reviveHourlyItem);

  return {
    ...(response.daily?.length
      ? {
          daily: response.daily.slice(0, 5).map(({ sunrise, sunset, ...item }) => ({
            ...item,
            date: reviveForecastDate(item.date, 'hourly.daily.date', true),
            pop: normalizeBffPrecipitationProbability(item.pop, 'hourly.daily.pop'),
            ...reviveDaylightBounds({ sunrise, sunset }),
          })),
        }
      : {}),
    hourly: planHourly.slice(0, DISPLAY_HOURLY_HOURS),
    ...(planHourly.length > DISPLAY_HOURLY_HOURS ? { planHourly } : {}),
    meta,
  };
};

export type WeatherRequestOptions = HttpRequestOptions;

/** Yalnız signal varken 3. argüman geçir (eski çağrı imzaları birebir kalsın). */
const requestOptions = (options: WeatherRequestOptions): [] | [HttpRequestOptions] =>
  options.signal ? [{ signal: options.signal }] : [];

let bundleUnsupported = false;
let provincesUnsupported = false;

/** Testler için: oturum içi "uç nokta yok" hafızasını sıfırlar. */
export const resetEndpointSupportForTests = (): void => {
  bundleUnsupported = false;
  provincesUnsupported = false;
};

const bundlePartError = (value: unknown): ApiError => {
  const record = isRecord(value) ? value : {};
  const statusCode = isFiniteNumber(record.statusCode) ? record.statusCode : 502;
  const message = typeof record.message === 'string' ? record.message : undefined;
  return ApiError.fromHttpStatus(statusCode, message);
};

export interface ProvinceTemperature {
  plate: number;
  name: string;
  lat: number;
  lon: number;
  /** °C */
  temperature: number;
  icon: string;
  description: string;
  observedAt: Date;
}

export interface ProvinceTemperatures {
  byPlate: ReadonlyMap<number, ProvinceTemperature>;
  provider: string;
  attribution?: string;
  fetchedAt: Date;
}

const MAX_PROVINCE_OBSERVATION_AGE_MS = 3 * 60 * 60_000;

const parseProvinceTemperatures = (raw: unknown): ProvinceTemperatures | null => {
  if (!isRecord(raw) || !Array.isArray(raw.provinces) || !isRecord(raw.meta)) return null;
  const fetchedAt = new Date(String(raw.meta.fetchedAt));
  if (Number.isNaN(fetchedAt.getTime()) || typeof raw.meta.provider !== 'string') return null;
  const now = Date.now();
  const byPlate = new Map<number, ProvinceTemperature>();
  for (const item of raw.provinces) {
    if (!isRecord(item)) continue;
    const { plate, name, lat, lon, temperature, icon, description } = item;
    const observedAt = new Date(String(item.observedAt));
    if (
      !isFiniteNumber(plate) ||
      plate < 1 ||
      plate > 81 ||
      typeof name !== 'string' ||
      !isFiniteNumber(lat) ||
      !isFiniteNumber(lon) ||
      !isPlausibleTemperature(temperature, 'metric') ||
      typeof icon !== 'string' ||
      !WEATHER_ICON_CODE_PATTERN.test(icon) ||
      typeof description !== 'string' ||
      Number.isNaN(observedAt.getTime()) ||
      // Bayat (3 saatten eski) ya da gelecekten gelen gözlemi gösterme.
      now - observedAt.getTime() > MAX_PROVINCE_OBSERVATION_AGE_MS ||
      observedAt.getTime() - now > MAX_FORECAST_FUTURE_SKEW_MS
    ) {
      continue;
    }
    byPlate.set(plate, { plate, name, lat, lon, temperature, icon, description, observedAt });
  }
  return {
    byPlate,
    provider: raw.meta.provider,
    ...(typeof raw.meta.attribution === 'string' ? { attribution: raw.meta.attribution } : {}),
    fetchedAt,
  };
};

export const weatherService = {
  getCurrentWeather: async (
    params: WeatherQueryParams,
    options: WeatherRequestOptions = {}
  ): Promise<NormalizedWeatherData> => {
    const {
      city,
      units = DEFAULT_WEATHER_PARAMS.units,
      lang = DEFAULT_WEATHER_PARAMS.lang,
    } = params;

    if (!city.trim()) {
      throw new ApiError('Şehir adı gereklidir', undefined, { retryable: false });
    }

    try {
      const normalizedCity = city.trim();
      const bootstrapPromise = takeBootstrapWeather(normalizedCity, lang, units);
      const bootstrapResponse = bootstrapPromise ? await bootstrapPromise : null;
      const response =
        bootstrapResponse ??
        (await httpClient.get<SerializedWeatherData>(
          API_ENDPOINTS.weather.current,
          {
            city: normalizedCity,
            units,
            lang,
          },
          ...requestOptions(options)
        ));
      return reviveWeatherDates(response, units);
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 404) {
        throw ApiError.cityNotFound(city);
      }
      throw error;
    }
  },

  getWeatherByCoords: async (
    lat: number,
    lon: number,
    lang = DEFAULT_WEATHER_PARAMS.lang
  ): Promise<NormalizedWeatherData> => {
    const response = await httpClient.get<SerializedWeatherData>(API_ENDPOINTS.weather.current, {
      lat,
      lon,
      units: DEFAULT_WEATHER_PARAMS.units,
      lang,
    });
    return reviveWeatherDates(response, DEFAULT_WEATHER_PARAMS.units);
  },

  getCurrentLocationWeather: async (
    lang = DEFAULT_WEATHER_PARAMS.lang
  ): Promise<NormalizedWeatherData> =>
    new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(
          new ApiError('Konum servisi desteklenmiyor', ErrorCode.LOCATION_UNAVAILABLE, {
            retryable: false,
          })
        );
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async position => {
          try {
            const latitude = position.coords.latitude;
            const longitude = position.coords.longitude;
            const data = await weatherService.getWeatherByCoords(latitude, longitude, lang);
            const canonicalProvince =
              data.country.toUpperCase() === 'TR'
                ? nearestTurkishProvince(latitude, longitude)
                : undefined;
            resolve(canonicalProvince ? { ...data, cityName: canonicalProvince.name } : data);
          } catch (error) {
            reject(error);
          }
        },
        error => {
          const locationErrors: Record<number, { code: ErrorCode; message: string }> = {
            1: { code: ErrorCode.LOCATION_DENIED, message: 'Konum izni reddedildi' },
            2: { code: ErrorCode.LOCATION_UNAVAILABLE, message: 'Konum bilgisi alınamadı' },
            3: { code: ErrorCode.LOCATION_TIMEOUT, message: 'Konum isteği zaman aşımına uğradı' },
          };
          const locationError = locationErrors[error.code] ?? {
            code: ErrorCode.LOCATION_UNAVAILABLE,
            message: 'Konum bilgisi alınamadı',
          };
          reject(new ApiError(locationError.message, locationError.code, { retryable: false }));
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
      );
    }),

  getForecast: async (
    lat: number,
    lon: number,
    lang = DEFAULT_WEATHER_PARAMS.lang,
    options: WeatherRequestOptions = {}
  ): Promise<ParsedForecast> => {
    const rawResponse = await httpClient.get<unknown>(
      API_ENDPOINTS.weather.forecast,
      {
        lat,
        lon,
        units: DEFAULT_WEATHER_PARAMS.units,
        lang,
      },
      ...requestOptions(options)
    );
    return parseForecastResponse(rawResponse);
  },

  getHourlyForecast: async (
    lat: number,
    lon: number,
    lang = DEFAULT_WEATHER_PARAMS.lang,
    options: WeatherRequestOptions = {}
  ): Promise<ParsedHourlyForecast> => {
    const bootstrapPromise = takeBootstrapHourly(lat, lon, lang);
    const bootstrapResponse = bootstrapPromise ? await bootstrapPromise : null;
    const rawResponse =
      bootstrapResponse ??
      (await httpClient.get<unknown>(
        API_ENDPOINTS.weather.hourly,
        {
          lat,
          lon,
          lang,
        },
        ...requestOptions(options)
      ));
    return parseHourlyResponse(rawResponse);
  },

  /** Şehir sayfası açılışta saatlik tahmini önceden istediyse (bootstrap) true. */
  hasBootstrapHourly: (lang = DEFAULT_WEATHER_PARAMS.lang): boolean =>
    typeof window !== 'undefined' && window.__HAVA81_BOOTSTRAP_HOURLY__?.lang === lang,

  /**
   * Faz 3.2: forecast + hourly + air-quality + context tek `/weather/bundle` isteğiyle.
   * Her parça tekil uç noktalarla aynı doğrulamadan geçer; başarısız parça `ok: false`
   * döner. API bundle'ı bilmiyorsa (404, web API'den önce deploy edildiyse) ya da istek
   * başarısız olursa `BundleUnavailableError` fırlatılır; çağıran eski tekil isteklere
   * düşer. 404 görüldüğünde oturum boyunca bundle bir daha denenmez.
   */
  getForecastBundle: async (
    lat: number,
    lon: number,
    lang = DEFAULT_WEATHER_PARAMS.lang,
    options: WeatherRequestOptions & { marine?: boolean; parts?: readonly ForecastBundlePart[] } = {}
  ): Promise<ForecastBundle> => {
    if (bundleUnsupported) throw new BundleUnavailableError('unsupported');
    const parts = options.parts ?? FORECAST_BUNDLE_PARTS;
    let raw: unknown;
    try {
      raw = await httpClient.get<unknown>(
        API_ENDPOINTS.weather.bundle,
        {
          lat,
          lon,
          units: DEFAULT_WEATHER_PARAMS.units,
          lang,
          marine: options.marine ? 'true' : 'false',
          include: parts.join(','),
        },
        // Yeniden deneme yok: bundle başarısızsa (ör. 5xx, erişilemeyen proxy) geri
        // çekilme beklemeden tekil isteklere düşülür; onların kendi yeniden denemesi var.
        { ...(options.signal ? { signal: options.signal } : {}), retries: 0 }
      );
    } catch (error) {
      if (isAbortError(error)) throw error;
      if (error instanceof ApiError && error.statusCode === 404) {
        bundleUnsupported = true;
        throw new BundleUnavailableError('unsupported', error);
      }
      // 429'da tekil isteklere düşmek yükü artırır; hatayı olduğu gibi ilet.
      if (error instanceof ApiError && error.code === ErrorCode.RATE_LIMIT) throw error;
      throw new BundleUnavailableError('failed', error);
    }
    // Bundle zarfı değilse (ör. SPA'nın 200 HTML/JSON geri dönüşü, eski proxy) tekil isteklere düş.
    if (!isRecord(raw) || !isRecord(raw.meta) || !Array.isArray(raw.meta.parts)) {
      throw new BundleUnavailableError('failed');
    }

    const errors = isRecord(raw.errors) ? raw.errors : {};
    const settle = <T,>(part: ForecastBundlePart, parse: (value: unknown) => T): BundlePartResult<T> | undefined => {
      if (!parts.includes(part)) return undefined;
      const value = raw[part];
      if (value === null || value === undefined) {
        return { ok: false, error: bundlePartError(errors[part]) };
      }
      try {
        return { ok: true, value: parse(value) };
      } catch (error) {
        return { ok: false, error };
      }
    };

    return {
      forecast: settle('forecast', parseForecastResponse),
      hourly: settle('hourly', parseHourlyResponse),
      airQuality: settle('airQuality', value =>
        validateAirQualityPayload(value as SerializedAirQuality)
      ),
      context: settle('context', value =>
        validateContextSignalsPayload(
          value as Omit<ContextSignals, 'fetchedAt'> & { fetchedAt: string }
        )
      ),
      ...(parts.includes('airQualityHourly')
        ? { airQualityHourly: settle('airQualityHourly', parseAirQualityHourlyPayload) }
        : {}),
    };
  },

  /**
   * 81 ilin güncel sıcaklığı (harita). Uç nokta yoksa/başarısızsa `null` döner;
   * harita bu durumda canlı sıcaklık olmadan bugünkü gibi çalışır.
   */
  getProvinceTemperatures: async (
    lang = DEFAULT_WEATHER_PARAMS.lang,
    options: WeatherRequestOptions = {}
  ): Promise<ProvinceTemperatures | null> => {
    if (provincesUnsupported) return null;
    try {
      const raw = await httpClient.get<unknown>(
        API_ENDPOINTS.weather.provinces,
        { lang },
        ...requestOptions(options)
      );
      return parseProvinceTemperatures(raw);
    } catch (error) {
      if (isAbortError(error)) throw error;
      if (error instanceof ApiError && error.statusCode === 404) provincesUnsupported = true;
      return null;
    }
  },

  getContextSignals: async (
    lat: number,
    lon: number,
    marine = false,
    options: WeatherRequestOptions = {}
  ): Promise<ContextSignals> => {
    const response = await httpClient.get<
      Omit<ContextSignals, 'fetchedAt'> & { fetchedAt: string }
    >(
      API_ENDPOINTS.weather.context,
      { lat, lon, marine: marine ? 'true' : 'false' },
      ...requestOptions(options)
    );
    return validateContextSignalsPayload(response);
  },

  getRouteWeather: async (
    origin: { lat: number; lon: number },
    destination: { lat: number; lon: number },
    departure: Date,
    lang = DEFAULT_WEATHER_PARAMS.lang
  ): Promise<RouteWeatherResult> => {
    const response = await httpClient.get<RouteWeatherResult>(API_ENDPOINTS.weather.route, {
      originLat: origin.lat,
      originLon: origin.lon,
      destinationLat: destination.lat,
      destinationLon: destination.lon,
      departure: departure.toISOString(),
      lang,
    });
    return validateRouteWeatherPayload(response);
  },

  getAirQuality: async (
    lat: number,
    lon: number,
    lang = DEFAULT_WEATHER_PARAMS.lang,
    options: WeatherRequestOptions = {}
  ): Promise<AirQuality> => {
    const response = await httpClient.get<SerializedAirQuality>(
      API_ENDPOINTS.weather.airQuality,
      {
        lat,
        lon,
        lang,
      },
      ...requestOptions(options)
    );
    return validateAirQualityPayload(response);
  },
};

export default weatherService;
