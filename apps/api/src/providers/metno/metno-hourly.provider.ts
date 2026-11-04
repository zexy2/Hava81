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
  MET_NORWAY_SOURCE_URL,
  MetNorwayTransport,
  modelUpdatedAt,
  round1,
  type MetHour,
} from './metno-client';
import { dailyCodeFor, weatherCodeForSymbol } from './metno-symbols';
import { isDaylightHour, sunTimes } from './solar';

const HOUR_MS = 3_600_000;
const SLOT_MS = 3 * HOUR_MS;
const DEFAULT_TIMEOUT_MS = 8_000;

// OpenWeather 5 day / 3 hour forecast (free plan, commercial use allowed):
// https://openweathermap.org/forecast5. MET Norway has no chance of rain, gusts or
// visibility for Turkey, so those come from here. `pop` is the probability for a 3-hour step;
// gust and visibility are values at the step time (`dt`), not hourly measurements.
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
type OpenWeatherSlot = OpenWeatherSlots['list'][number];
const OPENWEATHER_STEP_HOURS = 3;

export interface MetNorwayHourlyOptions {
  userAgent: string;
  openWeatherApiKey: string;
  openWeatherBaseUrl: string;
  timeoutMs?: number;
  metBaseUrl?: string;
  now?: () => Date;
  /** Shared MET client so every provider counts against the same request pace. */
  transport?: MetNorwayTransport;
}

/** Shown, with a neutral icon and no weather code, when MET's symbol is missing or unmapped. */
export const UNKNOWN_WEATHER = { tr: 'Hava durumu bilinmiyor', en: 'Weather unknown' } as const;
const UNKNOWN_ICON = '03';

/**
 * Türkiye time (Europe/Istanbul, UTC+3 all year since 2016) when OpenWeather does not send
 * the zone. Hava81 only serves Türkiye; a longitude guess put the west of the country at UTC+2.
 */
const turkeyOffsetSeconds = (at: Date): number => {
  const zoneName = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Istanbul', timeZoneName: 'shortOffset' })
    .formatToParts(at)
    .find(part => part.type === 'timeZoneName')?.value;
  const match = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(zoneName ?? '');
  if (!match) return 3 * 3_600;
  const sign = match[1] === '-' ? -1 : 1;
  return sign * (Number(match[2]) * 3_600 + Number(match[3] ?? 0) * 60);
};

/**
 * The day's precipitation: one-hour amounts as they are, a six-hour period by the share of its
 * hours that fall in the day. Left out when any hour of the day has no known amount.
 */
const dayTotal = (hours: readonly MetHour[]): { precipitationMm?: number } => {
  let total = 0;
  for (const hour of hours) {
    const share = hour.precipitationMm ?? (hour.period?.amountMm === undefined ? undefined : hour.period.amountMm / 6);
    if (share === undefined) return {};
    total += share;
  }
  return { precipitationMm: Math.round(total * 10) / 10 };
};

export class MetNorwayHourlyProvider implements HourlyForecastProvider {
  readonly name = 'MET Norway';
  // CC BY 4.0 asks to say the material was changed: Hava81 fills the hours, maps symbols and
  // estimates UV from MET's data. Not an endorsement by MET Norway.
  readonly attribution =
    'MET Norway verisi, Hava81 tarafından işlendi · CC BY 4.0 · Yağış olasılığı: Weather data provided by OpenWeather';
  readonly sourceUrl = MET_NORWAY_SOURCE_URL;
  private readonly now: () => Date;
  private readonly transport: MetNorwayTransport;

  constructor(
    private readonly fetchImpl: typeof fetch,
    private readonly options: MetNorwayHourlyOptions
  ) {
    this.now = options.now ?? (() => new Date());
    this.transport =
      options.transport ??
      new MetNorwayTransport(fetchImpl, {
        userAgent: options.userAgent,
        timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        metBaseUrl: options.metBaseUrl,
      });
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
      this.transport.forecast(query.lat, query.lon),
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
    // MET has no chance of rain for Türkiye, so every hour's `pop` is OpenWeather's 3-hour
    // step probability, labelled as such. The list starts at the next step boundary, so the
    // current hour or two take the first step (at most three hours ahead) and name it in
    // `popValidFrom`. Nothing is made up: without a covering step the forecast is unavailable.
    const list = slots?.list ?? [];
    const firstSlot = list[0];
    const popSlotAt = (time: number): OpenWeatherSlot | undefined =>
      list.find(slot => slot.dt * 1_000 <= time && time < slot.dt * 1_000 + SLOT_MS) ??
      (firstSlot && time < firstSlot.dt * 1_000 && firstSlot.dt * 1_000 - time <= SLOT_MS
        ? firstSlot
        : undefined);
    // Gust and visibility only where an OpenWeather step falls exactly on the hour (#1776).
    const pointAt = (time: number) => list.find(slot => slot.dt * 1_000 === time);
    const covered = timeline.slice(0, HOURLY_FORECAST_HOURS);
    if (covered.some(hour => popSlotAt(hour.time)?.pop === undefined)) {
      throw new AppError(
        502,
        'HOURLY_PRECIPITATION_PROBABILITY_UNAVAILABLE',
        'Saatlik yağış olasılığı şu anda kullanılamıyor.'
      );
    }
    const timezoneOffsetSeconds = slots?.city?.timezone ?? turkeyOffsetSeconds(new Date(start));

    const rows = timeline.flatMap(hour => {
      const slot = popSlotAt(hour.time);
      // Past OpenWeather's five days there is no probability; those hours are left out.
      if (slot?.pop === undefined) return [];
      const point = pointAt(hour.time);
      const isDay = isDaylightHour(query.lat, query.lon, new Date(hour.time));
      const code = hour.symbol === undefined ? null : weatherCodeForSymbol(hour.symbol);
      return [{
        hour,
        row: {
        time: new Date(hour.time).toISOString(),
        temp: round1(hour.temperature),
        icon: code === null ? `${UNKNOWN_ICON}${isDay ? 'd' : 'n'}` : iconForCode(code, isDay),
        isDay,
        description: code === null ? UNKNOWN_WEATHER[query.lang] : descriptionForCode(code, query.lang),
        pop: Math.max(0, Math.min(100, Math.round(slot.pop * 100))),
        popIntervalHours: OPENWEATHER_STEP_HOURS,
        popValidFrom: new Date(slot.dt * 1_000).toISOString(),
        windSpeed: round1(hour.windSpeed),
        apparentTemperature: hour.apparentTemperature === undefined ? undefined : round1(hour.apparentTemperature),
        humidity: hour.humidity === undefined ? undefined : Math.round(hour.humidity),
        precipitationMm:
          hour.precipitationMm === undefined ? undefined : Math.round(hour.precipitationMm * 100) / 100,
        windGust: point?.wind?.gust,
        uvIndex: isDay ? estimatedUvIndex(hour.uvClearSky, hour.cloudCover) : 0,
        visibility: point?.visibility,
        dewPoint: hour.dewPoint === undefined ? undefined : round1(hour.dewPoint),
        weatherCode: code ?? undefined,
        sourceIntervalHours: hour.periodHours ?? (hour.interpolated ? 6 : 1),
        ...(hour.interpolated ? { interpolated: true } : {}),
        ...(hour.period?.amountMm === undefined
          ? {}
          : { periodPrecipitationMm: Math.round(hour.period.amountMm * 100) / 100 }),
      }}];
    });

    const updatedAt = modelUpdatedAt(forecast);
    return {
      timezoneOffsetSeconds,
      ...(updatedAt ? { modelUpdatedAt: updatedAt } : {}),
      hourly: rows.slice(0, HOURLY_FORECAST_HOURS).map(entry => entry.row),
      daily: this.daily(rows, timezoneOffsetSeconds, query),
    };
  }

  /** Local-day summaries over the hours that have a chance of rain (OpenWeather's ~5 days). */
  private daily(
    rows: Array<{ hour: MetHour; row: HourlyForecastProviderResult['hourly'][number] }>,
    offsetSeconds: number,
    query: HourlyForecastQuery
  ): NonNullable<HourlyForecastProviderResult['daily']> {
    const byDay = new Map<string, typeof rows>();
    for (const entry of rows) {
      const date = new Date(entry.hour.time + offsetSeconds * 1_000).toISOString().slice(0, 10);
      byDay.set(date, [...(byDay.get(date) ?? []), entry]);
    }
    const days: NonNullable<HourlyForecastProviderResult['daily']> = [];
    for (const [date, entries] of byDay) {
      // A day needs enough hours to describe it; drop the trailing stub of the horizon.
      if (entries.length < 6) continue;
      const dayHours = entries.map(entry => entry.row);
      const temps = dayHours.map(hour => hour.temp);
      // The most consequential known weather of the daylight hours (a severity table: WMO
      // codes are categories, not a scale). Unknown when no hour has a known code.
      const daylight = dayHours.filter(hour => hour.isDay);
      const code = dailyCodeFor(
        (daylight.length > 0 ? daylight : dayHours).flatMap(hour =>
          hour.weatherCode === undefined ? [] : [hour.weatherCode]
        )
      );
      const localNoonUtc = new Date(Date.parse(`${date}T12:00:00Z`) - offsetSeconds * 1_000);
      const sun = sunTimes(query.lat, query.lon, localNoonUtc);
      days.push({
        date,
        tempMin: Math.min(...temps),
        tempMax: Math.max(...temps),
        icon: code === null ? `${UNKNOWN_ICON}d` : iconForCode(code, true),
        description: code === null ? UNKNOWN_WEATHER[query.lang] : descriptionForCode(code, query.lang),
        pop: Math.max(...dayHours.map(hour => hour.pop)),
        ...dayTotal(entries.map(entry => entry.hour)),
        ...(sun.sunrise && sun.sunset
          ? { sunrise: sun.sunrise.toISOString(), sunset: sun.sunset.toISOString() }
          : {}),
      });
    }
    return days;
  }
}
