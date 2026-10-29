import { describe, expect, it } from 'vitest';
import { buildActivityPlan } from '../../domain/activity/buildActivityPlan';
import { assessEvenDay } from '../../domain/decision/bestWindowRange';
import { buildDailyPlan } from '../../domain/decision/buildDailyPlan';
import { explainContrast } from '../../domain/decision/explain';
import type { ScoredWeatherWindow } from '../../domain/decision/types';
import { buildDayOutlook } from '../../domain/plan/dayOutlook';
import type { HourlyForecast, NormalizedWeatherData } from '../../types';

const HOUR_MS = 3_600_000;
const DAY = '2026-08-28';
const local = (hour: number) => new Date(Date.parse(`${DAY}T00:00:00Z`) + (hour - 3) * HOUR_MS);

const weather = (): NormalizedWeatherData =>
  ({
    cityName: 'İstanbul',
    country: 'TR',
    temperature: 21,
    feelsLike: 21,
    tempMin: 17,
    tempMax: 24,
    humidity: 55,
    pressure: 1014,
    visibility: 10000,
    windSpeed: 3,
    windDirection: 180,
    description: 'açık',
    icon: '01d',
    sunrise: local(6),
    sunset: local(20),
    timestamp: local(7),
    coordinates: { lat: 41.01, lon: 28.97 },
    clouds: 5,
    meta: {
      provider: 'OpenWeather',
      fetchedAt: local(7),
      timezoneOffsetSeconds: 10800,
      cacheStatus: 'MISS',
      freshForSeconds: 60,
    },
  }) as unknown as NormalizedWeatherData;

const hour = (h: number, extra: Partial<HourlyForecast> = {}): HourlyForecast =>
  ({
    time: local(h),
    temp: 21,
    apparentTemperature: 21,
    humidity: 55,
    dewPoint: 11,
    pop: 0,
    precipitationMm: 0,
    windSpeed: 3,
    windGust: 5,
    uvIndex: 3,
    visibility: 20000,
    isDay: h % 24 >= 6 && h % 24 < 20,
    icon: h % 24 >= 6 && h % 24 < 20 ? '01d' : '01n',
    description: 'açık',
    weatherCode: 0,
    ...extra,
  }) as HourlyForecast;

const hours = (
  from: number,
  to: number,
  extra: (h: number) => Partial<HourlyForecast> = () => ({})
) => Array.from({ length: to - from }, (_, i) => hour(from + i, extra(from + i)));

const slot = (h: number, score: number): ScoredWeatherWindow =>
  ({
    time: local(h),
    score,
    reasons: [],
    impacts: [],
    band: 'good',
  }) as unknown as ScoredWeatherWindow;

describe('even day', () => {
  it('flags a day where most usable hours score within a few points of the peak', () => {
    const slots = [91, 92, 91, 89, 89, 89, 90, 83, 91, 91, 92, 92].map((s, i) => slot(12 + i, s));
    const result = assessEvenDay(slots);
    expect(result.even).toBe(true);
    expect(result.weakSlots.map(s => s.score)).toEqual([83]);
  });

  it('does not flag a day with a real best window', () => {
    const slots = [60, 62, 65, 90, 92, 91, 70, 64].map((s, i) => slot(10 + i, s));
    expect(assessEvenDay(slots).even).toBe(false);
  });

  it('does not flag a day whose usable hours are split by a gated hour', () => {
    const slots = [92, 92, 92, 40, 92, 92, 92].map((s, i) => slot(8 + i, s));
    expect(assessEvenDay(slots, 3, s => s.score > 50).even).toBe(false);
  });

  it('needs enough usable hours before calling a day even', () => {
    expect(assessEvenDay([slot(9, 90), slot(10, 90), slot(11, 90)]).even).toBe(false);
  });

  it('marks the day plan as even without changing the shared verdict or score', () => {
    const plan = buildDailyPlan({ weather: weather(), hourly: hours(7, 19), now: local(7) });
    expect(plan.evenDay).toBeDefined();
    // Today's decision band reads nowOrLater; Planla words an even day from `evenDay`.
    expect(['now', 'similar', 'later']).toContain(plan.nowOrLater.kind);
    expect(plan.score).toBeGreaterThan(80);
  });
});

describe('explainContrast', () => {
  it('names the factor that makes the weak hours weaker', () => {
    const good = {
      ...slot(13, 92),
      impacts: [],
      precipitationProbability: 0.03,
    } as ScoredWeatherWindow;
    const weak = {
      ...slot(19, 70),
      impacts: [{ factor: 'precipitation', penalty: 20 }],
      precipitationProbability: 0.8,
    } as unknown as ScoredWeatherWindow;
    const result = explainContrast([good], [weak], good);
    expect(result?.factor).toBe('precipitation');
    expect(result?.worstValue).toBe(80);
    expect(result?.windowValue).toBe(3);
  });

  it('returns nothing without both sides', () => {
    expect(explainContrast([], [slot(19, 70)], slot(13, 92))).toBeUndefined();
  });

  // Seen live: "22:00 civarı yağış ihtimali %53, bu aralıkta %63" — the rain penalty came from
  // the amount, but the copy showed probability, so the reason contradicted the advice.
  it('shows the amount when probability would contradict the rain contrast', () => {
    const good = {
      ...slot(12, 70),
      impacts: [{ factor: 'precipitation', penalty: 8 }],
      precipitationProbability: 0.63,
      precipitationMm: 0.2,
    } as unknown as ScoredWeatherWindow;
    const weak = {
      ...slot(22, 50),
      impacts: [{ factor: 'precipitation', penalty: 30 }],
      precipitationProbability: 0.53,
      precipitationMm: 4.5,
    } as unknown as ScoredWeatherWindow;
    const result = explainContrast([good], [weak], good);
    expect(result?.factor).toBe('precipitation-mm');
    expect(result?.worstValue).toBe(4.5);
    expect(result?.windowValue).toBe(0.2);
  });

  it('says nothing rather than a reason its own numbers contradict', () => {
    const good = {
      ...slot(12, 70),
      impacts: [{ factor: 'wind', penalty: 2 }],
      windSpeed: 9,
    } as unknown as ScoredWeatherWindow;
    const weak = {
      ...slot(22, 50),
      impacts: [{ factor: 'wind', penalty: 20 }],
      windSpeed: 6,
    } as unknown as ScoredWeatherWindow;
    expect(explainContrast([good], [weak], good)).toBeUndefined();
  });
});

describe('activity notes', () => {
  it('marks a recommended block after dark', () => {
    // Only the evening is dry: the run lands after sunset.
    const plan = buildActivityPlan({
      activity: 'run',
      weather: weather(),
      hourly: hours(14, 24, h => (h < 21 ? { pop: 0.9, precipitationMm: 4 } : {})),
      now: local(14),
    });
    expect(plan.inDarkness).toBe(true);
  });

  it('does not mark a daytime block', () => {
    const plan = buildActivityPlan({
      activity: 'run',
      weather: weather(),
      hourly: hours(8, 18, h => (h >= 12 ? { pop: 0.9, precipitationMm: 4 } : {})),
      now: local(8),
    });
    expect(plan.inDarkness).toBe(false);
  });
});

describe('day outlook', () => {
  const thunder = (h: number): Partial<HourlyForecast> =>
    h % 24 === 9 || h % 24 === 11
      ? { weatherCode: 95, icon: '11d', pop: 0.7, precipitationMm: 2 }
      : { pop: 0.7, precipitationMm: 1, icon: '10d' };

  it('names thunderstorm hours and ranks severe weather above plain rain', () => {
    const days = buildDayOutlook({
      weather: weather(),
      hourly: [...hours(7, 24), ...hours(24, 48, thunder)],
      now: local(7),
    });
    const tomorrow = days.find(day => day.dayOffset === 1)!;
    expect(tomorrow.thunderHours.map(t => t.getTime())).toEqual(
      [local(33), local(35)].map(t => t.getTime())
    );
    expect(tomorrow.reasons[0]).toBe('severe-weather');
  });

  it('summarises each day with its main icon and temperature range', () => {
    const days = buildDayOutlook({
      weather: weather(),
      hourly: hours(7, 24, h => ({ temp: h })),
      now: local(7),
    });
    expect(days[0].tempMin).toBe(7);
    expect(days[0].tempMax).toBe(23);
    expect(days[0].icon).toBe('01d');
    expect(days[0].thunderHours).toEqual([]);
  });
});
