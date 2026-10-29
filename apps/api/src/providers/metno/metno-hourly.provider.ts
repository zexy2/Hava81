import { z } from 'zod';
import { AppError } from '../../core/errors';
import { HOURLY_FORECAST_HOURS } from '../../modules/weather/contracts';
import { descriptionForCode, iconForCode } from '../openmeteo/openmeteo-hourly.provider';
import type {
  HourlyForecastProvider,
  HourlyForecastProviderResult,
  HourlyForecastQuery,
} from '../weather-provider';
import {
  estimatedUvIndex,
  expandToHours,
  fetchMetNorwayForecast,
  MET_NORWAY_SOURCE_URL,
  round1,
  type MetHour,
} from './metno-client';
import { symbolHasPrecipitation, weatherCodeForSymbol } from './metno-symbols';
import { isDaylightHour, sunTimes } from './solar';

const HOUR_MS = 3_600_000;
const SLOT_MS = 3 * HOUR_MS;
const DEFAULT_TIMEOUT_MS = 8_000;

// OpenWeather 5 day / 3 hour forecast (free plan, commercial use allowed):
// https://openweathermap.org/forecast5. MET Norway has no chance of rain, gusts or
// visibility for Turkey, so those come from here.
const openWeatherForecastSchema = z.object({
  list: z.array(
    z.object({
      dt: z.number().int().nonnegative(),
      pop: z.number().min(0).max(1).optional(),
      visibility: z.number().min(0).max(100_000).optional(),
      wind: z.object({ gust: z.number().min(0).max(150).optional() }).partial().optional(),
    })
  ),
  city: z.object({ timezone: z.number().int().min(-43_200).max(50_400) }).partial().optional(),
});

type OpenWeatherSlots = z.infer<typeof openWeatherForecastSchema>;

export interface MetNorwayHourlyOptions {
  userAgent: string;
  openWeatherApiKey: string;
  openWeatherBaseUrl: string;
  timeoutMs?: number;
  metBaseUrl?: string;
  now?: () => Date;
}

/**
 * Honest fallback when OpenWeather is unavailable: MET only says how much falls, so map the
 * amount to a coarse likelihood. Dry hours stay at 0 % rather than a guessed residual.
 */
const popFromAmount = (hour: MetHour) => {
  if (hour.precipitationMm >= 1) return 80;
  if (hour.precipitationMm >= 0.1) return 60;
  return symbolHasPrecipitation(hour.symbol) ? 30 : 0;
};

/** Fixed-offset fallback when OpenWeather does not supply the zone (Turkey is UTC+3). */
const offsetFromLongitude = (lon: number) => Math.round(lon / 15) * 3_600;

export class MetNorwayHourlyProvider implements HourlyForecastProvider {
  readonly name = 'MET Norway';
  readonly attribution =
    'MET Norway · CC BY 4.0 · Yağış olasılığı: Weather data provided by OpenWeather';
  readonly sourceUrl = MET_NORWAY_SOURCE_URL;
  private readonly now: () => Date;

  constructor(
    private readonly fetchImpl: typeof fetch,
    private readonly options: MetNorwayHourlyOptions
  ) {
    this.now = options.now ?? (() => new Date());
  }

  private async openWeatherSlots(query: HourlyForecastQuery): Promise<OpenWeatherSlots | null> {
    const base = this.options.openWeatherBaseUrl.replace(/\/+$/, '');
    const url = new URL(`${base}/forecast`);
    url.searchParams.set('lat', String(query.lat));
    url.searchParams.set('lon', String(query.lon));
    url.searchParams.set('units', 'metric');
    url.searchParams.set('appid', this.options.openWeatherApiKey);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    try {
      const response = await this.fetchImpl(url, {
        headers: { accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) return null;
      const parsed = openWeatherForecastSchema.safeParse(await response.json());
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  async getHourly(query: HourlyForecastQuery): Promise<HourlyForecastProviderResult> {
    const start = Math.floor(this.now().getTime() / HOUR_MS) * HOUR_MS;
    const [forecast, slots] = await Promise.all([
      fetchMetNorwayForecast(
        this.fetchImpl,
        this.options.userAgent,
        query.lat,
        query.lon,
        this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        this.options.metBaseUrl
      ),
      this.openWeatherSlots(query),
    ]);

    const timeline = expandToHours(forecast, start);
    if (timeline.length < HOURLY_FORECAST_HOURS) {
      throw new AppError(
        502,
        'NON_CONTIGUOUS_HOURLY_PROVIDER_RESPONSE',
        'Saatlik tahmin verisi şu anda kesintisiz kullanılamıyor.'
      );
    }
    const slotAt = (time: number) =>
      slots?.list.find(slot => slot.dt * 1_000 <= time && time < slot.dt * 1_000 + SLOT_MS);
    const timezoneOffsetSeconds = slots?.city?.timezone ?? offsetFromLongitude(query.lon);

    const enriched = timeline.map(hour => {
      const slot = slotAt(hour.time);
      const isDay = isDaylightHour(query.lat, query.lon, new Date(hour.time));
      const code = weatherCodeForSymbol(hour.symbol);
      const pop = slot?.pop !== undefined ? Math.round(slot.pop * 100) : popFromAmount(hour);
      return {
        time: new Date(hour.time).toISOString(),
        temp: round1(hour.temperature),
        icon: iconForCode(code, isDay),
        isDay,
        description: descriptionForCode(code, query.lang),
        pop: Math.max(0, Math.min(100, pop)),
        windSpeed: round1(hour.windSpeed),
        apparentTemperature: hour.apparentTemperature === undefined ? undefined : round1(hour.apparentTemperature),
        humidity: hour.humidity === undefined ? undefined : Math.round(hour.humidity),
        precipitationMm: Math.round(hour.precipitationMm * 100) / 100,
        windGust: slot?.wind?.gust,
        uvIndex: isDay ? estimatedUvIndex(hour.uvClearSky, hour.cloudCover) : 0,
        visibility: slot?.visibility,
        dewPoint: hour.dewPoint === undefined ? undefined : round1(hour.dewPoint),
        weatherCode: code,
      };
    });

    return {
      timezoneOffsetSeconds,
      hourly: enriched.slice(0, HOURLY_FORECAST_HOURS),
      daily: this.daily(enriched, timezoneOffsetSeconds, query),
    };
  }

  /** Local-day summaries over the whole MET horizon (up to ~9 days). */
  private daily(
    hours: HourlyForecastProviderResult['hourly'],
    offsetSeconds: number,
    query: HourlyForecastQuery
  ): NonNullable<HourlyForecastProviderResult['daily']> {
    const byDay = new Map<string, HourlyForecastProviderResult['hourly']>();
    for (const hour of hours) {
      const date = new Date(Date.parse(hour.time) + offsetSeconds * 1_000).toISOString().slice(0, 10);
      byDay.set(date, [...(byDay.get(date) ?? []), hour]);
    }
    const days: NonNullable<HourlyForecastProviderResult['daily']> = [];
    for (const [date, dayHours] of byDay) {
      // A day needs enough hours to describe it; drop the trailing stub of the horizon.
      if (dayHours.length < 6) continue;
      const temps = dayHours.map(hour => hour.temp);
      // The most significant weather of the daylight hours, as WMO codes rise with severity.
      const daylight = dayHours.filter(hour => hour.isDay);
      const code = Math.max(...(daylight.length > 0 ? daylight : dayHours).map(hour => hour.weatherCode ?? 3));
      const localNoonUtc = new Date(Date.parse(`${date}T12:00:00Z`) - offsetSeconds * 1_000);
      const sun = sunTimes(query.lat, query.lon, localNoonUtc);
      days.push({
        date,
        tempMin: Math.min(...temps),
        tempMax: Math.max(...temps),
        icon: iconForCode(code, true),
        description: descriptionForCode(code, query.lang),
        pop: Math.max(...dayHours.map(hour => hour.pop)),
        precipitationMm:
          Math.round(dayHours.reduce((sum, hour) => sum + (hour.precipitationMm ?? 0), 0) * 10) / 10,
        ...(sun.sunrise && sun.sunset
          ? { sunrise: sun.sunrise.toISOString(), sunset: sun.sunset.toISOString() }
          : {}),
      });
    }
    return days;
  }
}
