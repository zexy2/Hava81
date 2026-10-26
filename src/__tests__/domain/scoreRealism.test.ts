import { describe, expect, it } from 'vitest';
import { buildActivityPlan } from '../../domain/activity/buildActivityPlan';
import { buildDailyPlan } from '../../domain/decision/buildDailyPlan';
import { findBestWindowRange } from '../../domain/decision/bestWindowRange';
import { getNextChange } from '../../domain/decision/nextChange';
import {
  resolveApparentTemperature,
  scoreWeatherWindow,
} from '../../domain/decision/scoreWeatherWindow';
import { buildDayOutlook } from '../../domain/plan/dayOutlook';
import { scoreHour } from '../../domain/plan/scoreHour';
import type { AirQualityHourly, HourlyForecast, NormalizedWeatherData } from '../../types';

/**
 * Regression and realism scenarios for the decision layer: each case is a situation a user in
 * Türkiye actually meets, with the answer a sensible person would give.
 */
const OFFSET = 10800; // Türkiye, UTC+3
const DAY = '2026-07-15';
const HOUR_MS = 3_600_000;
/** UTC instant of a local Türkiye clock hour on the scenario day (hour may exceed 23). */
const local = (hour: number) => new Date(Date.parse(`${DAY}T00:00:00Z`) + (hour - 3) * HOUR_MS);

const weather = (overrides: Partial<NormalizedWeatherData> = {}): NormalizedWeatherData => ({
  cityName: 'Test',
  country: 'TR',
  temperature: 22,
  feelsLike: 22,
  tempMin: 18,
  tempMax: 26,
  humidity: 50,
  pressure: 1013,
  visibility: 10000,
  windSpeed: 3,
  windDirection: 180,
  description: 'açık',
  icon: '01d',
  sunrise: local(6),
  sunset: local(20),
  timestamp: local(8),
  coordinates: { lat: 41, lon: 29 },
  clouds: 0,
  meta: { provider: 'OpenWeather', fetchedAt: local(8), timezoneOffsetSeconds: OFFSET },
  ...overrides,
});

/** Rich one-hour Open-Meteo slot with calm, dry, comfortable defaults. */
const hour = (localHour: number, overrides: Partial<HourlyForecast> = {}): HourlyForecast => ({
  time: local(localHour),
  temp: 22,
  apparentTemperature: 22,
  humidity: 50,
  pop: 0,
  precipitationMm: 0,
  windSpeed: 3,
  windGust: 5,
  uvIndex: 2,
  visibility: 20000,
  weatherCode: 0,
  isDay: localHour % 24 >= 6 && localHour % 24 < 20,
  icon: localHour % 24 >= 6 && localHour % 24 < 20 ? '01d' : '01n',
  ...overrides,
});

const hours = (
  from: number,
  to: number,
  overrides: (h: number) => Partial<HourlyForecast> = () => ({})
) => Array.from({ length: to - from }, (_, index) => hour(from + index, overrides(from + index)));

describe('scenario: Antalya in July', () => {
  // 41 °C feels-like at noon, pleasant early morning and late evening.
  const feels = (h: number) => (h < 9 ? 26 : h < 18 ? 41 : h < 21 ? 30 : 27);
  const day = hours(6, 23, h => ({
    temp: feels(h) - 2,
    apparentTemperature: feels(h),
    uvIndex: h >= 10 && h <= 16 ? 10 : 3,
  }));

  it('never recommends the midday heat for a walk and points to the cooler edge of the day', () => {
    const plan = buildActivityPlan({
      activity: 'walk',
      weather: weather(),
      hourly: day,
      now: local(6),
    });
    const start = new Date(
      plan.bestWindowRange!.start.time.getTime() + OFFSET * 1000
    ).getUTCHours();
    expect(start < 9 || start >= 18).toBe(true);
    expect(plan.band === 'caution' || plan.band === 'difficult').toBe(true);
  });

  it('still calls it a good laundry day: heat and sun dry clothes', () => {
    const laundry = buildActivityPlan({
      activity: 'laundry',
      weather: weather(),
      hourly: day.map(slot => ({ ...slot, humidity: 35 })),
      now: local(6),
    });
    const children = buildActivityPlan({
      activity: 'children',
      weather: weather(),
      hourly: day,
      now: local(6),
    });
    expect(laundry.band === 'good' || laundry.band === 'excellent').toBe(true);
    expect(laundry.score).toBeGreaterThan(children.score + 20);
    expect(laundry.reasons).not.toContain('high-uv');
  });
});

describe('scenario: one stormy hour vs a stormy afternoon', () => {
  const calm = hours(8, 20);
  const storm = (from: number, to: number) =>
    calm.map(slot => {
      const h = new Date(slot.time.getTime() + OFFSET * 1000).getUTCHours();
      return h >= from && h < to
        ? { ...slot, weatherCode: 95, pop: 0.9, precipitationMm: 4, windGust: 18 }
        : slot;
    });

  it('a single thunderstorm hour makes the day "caution", not "difficult"', () => {
    const plan = buildDailyPlan({ weather: weather(), hourly: storm(15, 16), now: local(8) });
    expect(plan.band).toBe('caution');
  });

  it('a three-hour thunderstorm makes the day "difficult"', () => {
    const plan = buildDailyPlan({ weather: weather(), hourly: storm(13, 16), now: local(8) });
    expect(plan.band).toBe('difficult');
  });

  it('the stormy hour is never part of the recommended window', () => {
    const plan = buildDailyPlan({ weather: weather(), hourly: storm(15, 16), now: local(8) });
    const range = plan.bestWindowRange!;
    expect(
      range.start.time.getTime() >= local(16).getTime() ||
        range.endTime.getTime() <= local(15).getTime()
    ).toBe(true);
  });
});

describe('scenario: an evening plan is not judged by 03:00', () => {
  it('scores the usable evening hours, not the cold night after them', () => {
    const evening = [
      ...hours(19, 23, () => ({ temp: 20, apparentTemperature: 20 })),
      ...hours(23, 31, () => ({ temp: -2, apparentTemperature: -5 })),
    ];
    const plan = buildDailyPlan({
      weather: weather({ timestamp: local(19) }),
      hourly: evening,
      now: local(19),
    });
    expect(plan.band === 'good' || plan.band === 'excellent').toBe(true);
    // The walk home at night still counts for the practical advice.
    expect(plan.slots.some(slot => slot.reasons.includes('freezing'))).toBe(true);
  });
});

describe('scenario: laundry needs rain evidence', () => {
  it('does not recommend laundry when precipitation is unknown', () => {
    const unknownRain = hours(8, 18, () => ({ pop: Number.NaN, precipitationMm: undefined }));
    const plan = buildActivityPlan({
      activity: 'laundry',
      weather: weather(),
      hourly: unknownRain,
      now: local(8),
    });
    expect(plan.bestWindowRange).toBeUndefined();
    expect(plan.score).toBeLessThanOrEqual(74);
    expect(plan.slots[0]?.gateReasons).toContain('precipitation-unknown');
  });

  it('penalizes damp air for drying even when it is dry', () => {
    const humid = scoreHour({
      intent: 'laundry',
      point: hour(12, { humidity: 92 }),
      timezoneOffsetSeconds: OFFSET,
      now: local(8),
    });
    const dry = scoreHour({
      intent: 'laundry',
      point: hour(12, { humidity: 40 }),
      timezoneOffsetSeconds: OFFSET,
      now: local(8),
    });
    expect(dry.score - humid.score).toBeGreaterThanOrEqual(15);
  });
});

describe('no double counting', () => {
  it('an ideal walking hour scores like an ideal general hour', () => {
    const point = hour(10);
    const general = scoreWeatherWindow({
      ...point,
      temperature: point.temp,
      precipitationProbability: point.pop,
    });
    const walk = scoreHour({ intent: 'walk', point, timezoneOffsetSeconds: OFFSET, now: local(8) });
    expect(general.score).toBe(100);
    expect(walk.score).toBe(100);
  });

  it('a rainy picnic hour is penalized by weighting the rain once, not by stacking two rain models', () => {
    const point = hour(13, { pop: 0.4, precipitationMm: 0.5 });
    const general = scoreWeatherWindow({
      ...point,
      temperature: point.temp,
      precipitationProbability: point.pop,
    });
    const picnic = scoreHour({
      intent: 'picnic',
      point,
      timezoneOffsetSeconds: OFFSET,
      now: local(8),
    });
    const rain = general.penalties!.precipitation;
    expect(picnic.penalties.precipitation).toBeCloseTo(rain * 1.55, 0);
  });

  it('fog is counted once when visibility is measured', () => {
    const measured = scoreWeatherWindow({
      time: local(7),
      temperature: 10,
      apparentTemperature: 10,
      windSpeed: 1,
      pop: 0,
      precipitationProbability: 0,
      visibility: 300,
      weatherCode: 45,
    } as never);
    const unmeasured = scoreWeatherWindow({
      time: local(7),
      temperature: 10,
      apparentTemperature: 10,
      windSpeed: 1,
      precipitationProbability: 0,
      weatherCode: 45,
    });
    expect(measured.penalties!.severeWeather).toBe(0);
    expect(measured.penalties!.visibility).toBeGreaterThan(20);
    expect(unmeasured.penalties!.severeWeather).toBe(6);
  });
});

describe('weather codes and inputs', () => {
  it.each([56, 57])('names freezing drizzle (WMO %i) as severe weather', code => {
    const scored = scoreWeatherWindow({
      time: local(7),
      temperature: 0,
      windSpeed: 2,
      precipitationProbability: 0.6,
      weatherCode: code,
    });
    expect(scored.reasons).toContain('severe-weather');
  });

  it('separates slight from moderate snow', () => {
    const slight = scoreWeatherWindow({
      time: local(9),
      temperature: 0,
      apparentTemperature: 0,
      windSpeed: 2,
      precipitationProbability: 0.6,
      weatherCode: 71,
    });
    const moderate = scoreWeatherWindow({
      time: local(9),
      temperature: 0,
      apparentTemperature: 0,
      windSpeed: 2,
      precipitationProbability: 0.6,
      weatherCode: 73,
    });
    expect(moderate.score).toBeLessThan(slight.score);
  });

  it('treats a forecast amount with unknown probability as rain, not as 0% chance', () => {
    const unknownChance = scoreWeatherWindow({
      time: local(9),
      temperature: 22,
      windSpeed: 2,
      precipitationMm: 3,
    });
    const zeroChance = scoreWeatherWindow({
      time: local(9),
      temperature: 22,
      windSpeed: 2,
      precipitationMm: 3,
      precipitationProbability: 0,
    });
    expect(unknownChance.penalties!.precipitation).toBeGreaterThan(
      zeroChance.penalties!.precipitation
    );
  });

  it('never returns NaN for a broken provider value', () => {
    const scored = scoreWeatherWindow({
      time: local(9),
      temperature: 22,
      windSpeed: Number.NaN,
      precipitationProbability: 0,
    });
    expect(Number.isFinite(scored.score)).toBe(true);
    const noTemperature = scoreWeatherWindow({
      time: local(9),
      temperature: Number.NaN,
      windSpeed: 2,
      precipitationProbability: 0,
    });
    expect(Number.isFinite(noTemperature.score)).toBe(true);
    expect(noTemperature.score).toBeLessThanOrEqual(89);
  });

  it('uses the NWS simple heat index below 80 °F instead of the raw temperature', () => {
    expect(resolveApparentTemperature({ temperature: 27, humidity: 10, windSpeed: 1 })).toBeCloseTo(
      26,
      0
    );
  });
});

describe('time handling', () => {
  it('shows a range until the last slot ends', () => {
    const plan = buildDailyPlan({ weather: weather(), hourly: hours(8, 20), now: local(8) });
    const range = plan.bestWindowRange!;
    expect(range.endTime.getTime() - range.end.time.getTime()).toBe(HOUR_MS);
  });

  it('keeps the step in progress as "now" and drops steps that already ended', () => {
    const now = new Date(local(14).getTime() + 20 * 60_000); // 14:20
    const plan = buildDailyPlan({ weather: weather(), hourly: hours(12, 20), now });
    expect(plan.slots[0]?.time.getTime()).toBe(local(14).getTime());
  });

  it('a three-hour forecast step is a three-hour window', () => {
    const range = findBestWindowRange([
      scoreWeatherWindow({
        time: local(9),
        temperature: 22,
        windSpeed: 2,
        precipitationProbability: 0,
      }),
      scoreWeatherWindow({
        time: local(12),
        temperature: 30,
        windSpeed: 2,
        precipitationProbability: 0,
      }),
    ]);
    expect(range!.endTime.getTime() - range!.start.time.getTime()).toBe(3 * HOUR_MS);
  });
});

describe('one set of thresholds', () => {
  it('"rain starts" uses the umbrella-yes probability', () => {
    const now = local(9);
    const at = (pop: number) => [
      hour(10, { pop: 0, precipitationMm: undefined }),
      hour(11, { pop, precipitationMm: undefined }),
    ];
    expect(getNextChange(at(0.45), 22, now, false).kind).not.toBe('rainStarts');
    expect(getNextChange(at(0.5), 22, now, false).kind).toBe('rainStarts');
  });

  it('the air-quality card reports the worst hour the score sees, not only the current reading', () => {
    const day = hours(8, 20);
    const airQualityHourly: AirQualityHourly = {
      hours: day.map((slot, index) => ({ time: slot.time, europeanAqi: index === 5 ? 90 : 15 })),
      meta: { provider: 'Open-Meteo', fetchedAt: new Date(), freshForSeconds: 3600 },
    };
    const plan = buildDailyPlan({ weather: weather(), hourly: day, airQualityHourly });
    expect(plan.airQuality).toBe('poor');
  });
});

describe('scenario: a plan needs the whole activity duration (F1)', () => {
  it('a 2-hour picnic skips a lone dry hour between showers and takes the dry block', () => {
    // Showers at 11:00 and 13:00 leave 12:00 dry but alone; 15:00–18:00 is dry throughout.
    const day = hours(9, 19, h =>
      h === 11 || h === 13 || h === 14 ? { pop: 0.8, precipitationMm: 1.5 } : {}
    );
    const plan = buildActivityPlan({
      activity: 'picnic',
      weather: weather(),
      hourly: day,
      now: local(9),
    });
    const range = plan.bestWindowRange!;
    expect(plan.durationMinutes).toBe(120);
    expect(range.endTime.getTime() - range.start.time.getTime()).toBe(2 * HOUR_MS);
    expect(range.start.time.getTime()).not.toBe(local(12).getTime());
    expect(plan.bestWindowScore).toBeDefined();
  });

  it('offers non-overlapping alternatives, best first', () => {
    const plan = buildActivityPlan({
      activity: 'run',
      weather: weather(),
      hourly: hours(7, 19),
      now: local(7),
    });
    const all = [plan.bestWindowRange!, ...plan.alternativeWindows];
    expect(plan.alternativeWindows.length).toBe(2);
    for (let i = 0; i < all.length; i += 1) {
      for (let j = i + 1; j < all.length; j += 1) {
        const overlap = all[i].start.time < all[j].endTime && all[j].start.time < all[i].endTime;
        expect(overlap).toBe(false);
      }
    }
  });

  it('returns no full-duration window when no block fits, instead of a too-short one', () => {
    // Only one dry daylight hour: a 2-hour picnic cannot fit, so no picnic window is promised.
    const day = hours(9, 19, h => (h === 12 ? {} : { pop: 0.9, precipitationMm: 3 }));
    const plan = buildActivityPlan({
      activity: 'picnic',
      weather: weather(),
      hourly: day,
      now: local(9),
    });
    expect(plan.bestWindowRange).toBeUndefined();
    expect(plan.bestWindowScore).toBeUndefined();
    expect(plan.alternativeWindows).toHaveLength(0);
  });

  it('falls back to the near-best range on three-hourly data', () => {
    const sparse = [9, 12, 15, 18].map(h => hour(h));
    const plan = buildActivityPlan({
      activity: 'walk',
      weather: weather(),
      hourly: sparse,
      now: local(9),
    });
    expect(plan.bestWindowRange).toBeDefined();
    expect(plan.bestWindowScore).toBeUndefined();
  });
});

describe('scenario: "why this window?" (F2)', () => {
  it('explains an Antalya walk window by the midday heat it avoids, with real values', () => {
    const feels = (h: number) => (h < 9 ? 26 : h < 18 ? 41 : h < 21 ? 30 : 27);
    const day = hours(6, 23, h => ({ temp: feels(h) - 2, apparentTemperature: feels(h) }));
    const plan = buildActivityPlan({
      activity: 'walk',
      weather: weather(),
      hourly: day,
      now: local(6),
    });
    expect(plan.explanation?.factor).toBe('thermal');
    expect(plan.explanation?.worstValue).toBe(41);
    expect(plan.explanation!.windowValue!).toBeLessThan(41);
  });

  it('explains a day plan window by the rain it avoids', () => {
    const day = hours(8, 20, h => (h >= 14 ? { pop: 0.9, precipitationMm: 2.5 } : {}));
    const plan = buildDailyPlan({ weather: weather(), hourly: day, now: local(8) });
    expect(['precipitation', 'precipitation-mm']).toContain(plan.explanation?.factor);
    expect(plan.explanation!.worstTime.getTime()).toBeGreaterThanOrEqual(local(14).getTime());
  });

  it('says nothing when every usable hour is about the same', () => {
    const plan = buildDailyPlan({ weather: weather(), hourly: hours(8, 20), now: local(8) });
    expect(plan.explanation).toBeUndefined();
  });

  it('names a thunderstorm as severe weather rather than only rain', () => {
    const day = hours(8, 20, h =>
      h === 16 ? { weatherCode: 95, pop: 0.3, precipitationMm: 0.5 } : {}
    );
    const plan = buildDailyPlan({ weather: weather(), hourly: day, now: local(8) });
    expect(plan.explanation?.factor).toBe('severe-weather');
  });
});

describe('scenario: drying power, mugginess and Saharan dust (F3)', () => {
  const at = (overrides: Partial<HourlyForecast>) => hour(13, overrides);
  const laundry = (overrides: Partial<HourlyForecast>) =>
    scoreHour({
      intent: 'laundry',
      point: at(overrides),
      timezoneOffsetSeconds: OFFSET,
      now: local(8),
    });
  const run = (overrides: Partial<HourlyForecast>, dustUgM3?: number) =>
    scoreHour({
      intent: 'run',
      point: at(overrides),
      timezoneOffsetSeconds: OFFSET,
      now: local(8),
      dustUgM3,
    });

  it('dries laundry far better on a hot dry sunny day than a mild damp grey one', () => {
    const izmirJuly = laundry({
      temp: 30,
      apparentTemperature: 31,
      dewPoint: 10,
      humidity: 29,
      sunshineDuration: 3600,
    });
    const rizeOctober = laundry({
      temp: 15,
      apparentTemperature: 15,
      dewPoint: 13,
      humidity: 88,
      sunshineDuration: 0,
    });
    expect(izmirJuly.score - rizeOctober.score).toBeGreaterThanOrEqual(25);
    expect(izmirJuly.penalties.drying).toBeLessThan(2);
  });

  it('falls back to relative humidity when dew point is missing, and claims nothing without either', () => {
    const humid = laundry({
      temp: 18,
      humidity: 92,
      dewPoint: undefined,
      sunshineDuration: undefined,
    });
    const unknown = laundry({
      temp: 18,
      humidity: undefined,
      dewPoint: undefined,
      sunshineDuration: undefined,
    });
    expect(humid.penalties.drying).toBeGreaterThan(15);
    expect(unknown.penalties.drying).toBe(0);
  });

  it('flags a muggy Black Sea summer run that apparent temperature alone understates', () => {
    const muggy = run({ temp: 26, apparentTemperature: 28, dewPoint: 23, humidity: 84 });
    const crisp = run({ temp: 26, apparentTemperature: 28, dewPoint: 12, humidity: 50 });
    expect(muggy.reasons).toContain('muggy');
    expect(crisp.reasons).not.toContain('muggy');
    expect(crisp.score - muggy.score).toBeGreaterThanOrEqual(6);
    const walk = scoreHour({
      intent: 'walk',
      point: at({ dewPoint: 23 }),
      timezoneOffsetSeconds: OFFSET,
      now: local(8),
    });
    expect(walk.penalties.muggy).toBe(0);
  });

  it('lowers a run on a Saharan dust day and names it, but not laundry or motorcycle', () => {
    const dusty = run({}, 150);
    const clear = run({}, 20);
    expect(dusty.reasons).toContain('dust');
    expect(clear.penalties.dust).toBe(0);
    expect(clear.score - dusty.score).toBeGreaterThanOrEqual(8);
    for (const intent of ['laundry', 'motorcycle'] as const) {
      const scored = scoreHour({
        intent,
        point: at({}),
        timezoneOffsetSeconds: OFFSET,
        now: local(8),
        dustUgM3: 150,
      });
      expect(scored.penalties.dust).toBe(0);
    }
  });

  it('applies the dust peak only while fresh and only within its 24-hour window', () => {
    const day = hours(8, 20);
    const signals = (fetchedAt: Date, freshForSeconds: number) => ({
      provider: 'Open-Meteo',
      attribution: 'Open-Meteo',
      fetchedAt,
      freshForSeconds,
      dustMax: 160,
      units: {},
    });
    const fresh = buildActivityPlan({
      activity: 'run',
      weather: weather(),
      hourly: day,
      now: local(8),
      contextSignals: signals(local(8), 3600),
    });
    const stale = buildActivityPlan({
      activity: 'run',
      weather: weather(),
      hourly: day,
      now: local(8),
      contextSignals: signals(local(-20), 3600),
    });
    expect(fresh.reasons).toContain('dust');
    expect(stale.slots.every(slot => !slot.reasons.includes('dust'))).toBe(true);
    const beyond = buildActivityPlan({
      activity: 'run',
      weather: weather(),
      hourly: hours(8, 40),
      now: local(8),
      contextSignals: signals(local(8), 3600),
    });
    const lastSlot = beyond.slots[beyond.slots.length - 1];
    expect(lastSlot.time.getTime()).toBeGreaterThanOrEqual(local(32).getTime());
    expect(lastSlot.reasons).not.toContain('dust');
  });
});

describe('scenario: today, tomorrow and the weekend (F4)', () => {
  // 15 Jul 2026 is a Wednesday. Five days of hourly data from 08:00 today.
  const fiveDays = (overrides: (h: number) => Partial<HourlyForecast> = () => ({})) =>
    hours(8, 8 + 5 * 24 - 8, overrides);
  const rainyDay = (day: number) => (h: number) =>
    // Rain through every daylight hour (06–20) of that day.
    Math.floor(h / 24) === day && h % 24 >= 6 && h % 24 < 20
      ? { pop: 0.9, precipitationMm: 3, weatherCode: 63 }
      : {};

  it('splits the forecast into local days and ranks a rainy Saturday below a clear Friday', () => {
    const outlook = buildDayOutlook({
      weather: weather(),
      hourly: fiveDays(rainyDay(3)),
      now: local(8),
    });
    const byOffset = new Map(outlook.map(day => [day.dayOffset, day]));
    expect(outlook[0].dayOffset).toBe(0);
    expect(byOffset.get(3)?.dateKey).toBe('2026-07-18'); // Saturday
    expect(byOffset.get(2)!.score - byOffset.get(3)!.score).toBeGreaterThanOrEqual(20);
    expect(
      byOffset.get(3)!.reasons.some(reason => reason === 'heavy-rain' || reason === 'rain-risk')
    ).toBe(true);
  });

  it('lowers confidence with lead time', () => {
    const outlook = buildDayOutlook({ weather: weather(), hourly: fiveDays(), now: local(8) });
    expect(outlook[0].confidence).toBe('high');
    expect(outlook.find(day => day.dayOffset === 2)?.confidence).toBe('medium');
    expect(outlook.find(day => day.dayOffset === 4)?.confidence).toBe('low');
  });

  it('summarises only what is left of today, and skips a today with too few usable hours', () => {
    const evening = buildDayOutlook({ weather: weather(), hourly: hours(20, 48), now: local(20) });
    expect(evening[0].dayOffset).toBe(1);
    const morning = buildDayOutlook({ weather: weather(), hourly: hours(8, 48), now: local(8) });
    expect(morning[0].dayOffset).toBe(0);
    expect(morning[0].usableHours).toBe(15); // 08:00–22:00 under the 07–23 walking rule
  });

  it('keeps every window inside its own day', () => {
    for (const day of buildDayOutlook({
      weather: weather(),
      hourly: fiveDays(),
      now: local(8),
      activity: 'picnic',
    })) {
      const range = day.bestWindowRange!;
      expect(range.start.time.getTime()).toBeGreaterThanOrEqual(day.start.getTime());
      expect(range.endTime.getTime()).toBeLessThanOrEqual(day.start.getTime() + 24 * HOUR_MS);
    }
  });

  it('uses the activity gates per day: a rainy-day picnic gets no window', () => {
    const outlook = buildDayOutlook({
      weather: weather(),
      hourly: fiveDays(rainyDay(3)),
      now: local(8),
      activity: 'picnic',
    });
    const saturday = outlook.find(day => day.dayOffset === 3)!;
    expect(saturday.bestWindowRange).toBeUndefined();
    expect(outlook.find(day => day.dayOffset === 2)!.bestWindowRange).toBeDefined();
  });

  it('never projects the current AQI reading onto later days', () => {
    const airQuality = {
      aqi: 5,
      aqiLabel: 'Çok kötü',
      pm25: 90,
      pm10: 120,
      o3: 40,
      meta: { provider: 'OpenWeather', fetchedAt: local(8), freshForSeconds: 3600 },
    };
    const outlook = buildDayOutlook({
      weather: weather(),
      hourly: fiveDays(),
      now: local(8),
      airQuality,
    });
    expect(outlook[0].reasons).toContain('poor-air-quality');
    expect(outlook.find(day => day.dayOffset === 1)!.reasons).not.toContain('poor-air-quality');
  });
});

describe('scenario: "depends on the rain" (F5)', () => {
  const afternoon = (pop: number, precipitationMm = 0) =>
    hours(8, 20, h => (h >= 13 && h < 18 ? { pop, precipitationMm } : {}));

  it('shows a wet / dry range when afternoon showers are a coin flip', () => {
    const plan = buildDailyPlan({ weather: weather(), hourly: afternoon(0.5, 0.4), now: local(8) });
    const range = plan.scoreRange!;
    expect(range.high - range.low).toBeGreaterThanOrEqual(8);
    expect(range.low).toBeLessThanOrEqual(plan.score);
    expect(range.high).toBeGreaterThanOrEqual(plan.score);
  });

  it('shows no range when the rain question is decided or the day is dry', () => {
    expect(
      buildDailyPlan({ weather: weather(), hourly: afternoon(0.95, 3), now: local(8) }).scoreRange
    ).toBeUndefined();
    expect(
      buildDailyPlan({ weather: weather(), hourly: hours(8, 20), now: local(8) }).scoreRange
    ).toBeUndefined();
  });

  it('gives activities and coming days the same range logic', () => {
    const picnic = buildActivityPlan({
      activity: 'picnic',
      weather: weather(),
      hourly: afternoon(0.5, 0.4),
      now: local(8),
    });
    expect(picnic.scoreRange).toBeDefined();
    const outlook = buildDayOutlook({
      weather: weather(),
      hourly: afternoon(0.5, 0.4),
      now: local(8),
    });
    expect(outlook[0].scoreRange).toBeDefined();
  });

  it('prefers the more decided hour when two hours score the same', () => {
    const decided = {
      ...scoreWeatherWindow({
        time: local(10),
        temperature: 22,
        windSpeed: 2,
        precipitationProbability: 0,
      }),
      score: 90,
    };
    const open = {
      ...scoreWeatherWindow({
        time: local(9),
        temperature: 22,
        windSpeed: 2,
        precipitationProbability: 0.45,
      }),
      score: 90,
    };
    expect(findBestWindowRange([open, decided])!.peak).toBe(decided);
  });
});

describe('scenario: personal tolerance and pollen allergy (F6)', () => {
  const at = (overrides: Partial<HourlyForecast>) => hour(13, overrides);
  const score = (
    intent: 'walk' | 'run' | 'motorcycle' | 'laundry',
    point: HourlyForecast,
    extra: Partial<Parameters<typeof scoreHour>[0]> = {}
  ) => scoreHour({ intent, point, timezoneOffsetSeconds: OFFSET, now: local(8), ...extra });

  it('lets a wind-tolerant walker score a breezy hour higher, and a wind-sensitive one lower', () => {
    const breezy = at({ windSpeed: 9, windGust: 14 });
    const normal = score('walk', breezy).score;
    expect(score('walk', breezy, { tolerance: { wind: 'high' } }).score).toBeGreaterThan(normal);
    expect(score('walk', breezy, { tolerance: { wind: 'low' } }).score).toBeLessThan(normal);
  });

  it('never moves a safety limit: a storm-force gust stays capped and gated for everyone', () => {
    const gale = at({ windSpeed: 21, windGust: 27 });
    const tolerant = score('walk', gale, { tolerance: { wind: 'high', rain: 'high' } });
    expect(tolerant.score).toBeLessThanOrEqual(30);
    expect(tolerant.gateReasons).toContain('extreme-wind');
    const motorcycle = score('motorcycle', at({ windSpeed: 11 }), { tolerance: { wind: 'high' } });
    expect(motorcycle.gateReasons).toContain('wind-limit');
  });

  it('scores pollen only for someone with an allergy, and only for open-air plans', () => {
    const spring = at({});
    expect(score('run', spring, { pollenGrainsM3: 120 }).penalties.pollen).toBe(0);
    const allergic = score('run', spring, {
      pollenGrainsM3: 120,
      tolerance: { pollenAllergy: true },
    });
    expect(allergic.penalties.pollen).toBeGreaterThan(8);
    expect(allergic.reasons).toContain('pollen');
    const laundry = score('laundry', spring, {
      pollenGrainsM3: 120,
      tolerance: { pollenAllergy: true },
    });
    expect(laundry.penalties.pollen).toBe(0);
    const low = score('run', spring, { pollenGrainsM3: 10, tolerance: { pollenAllergy: true } });
    expect(low.penalties.pollen).toBe(0);
  });

  it('reads the higher of grass and olive pollen from fresh context only', () => {
    const signals = (fetchedAt: Date) => ({
      provider: 'Open-Meteo',
      attribution: 'Open-Meteo',
      fetchedAt,
      freshForSeconds: 3600,
      grassPollenMax: 15,
      olivePollenMax: 140,
      units: {},
    });
    const plan = (fetchedAt: Date) =>
      buildActivityPlan({
        activity: 'run',
        weather: weather(),
        hourly: hours(8, 20),
        now: local(8),
        contextSignals: signals(fetchedAt),
        tolerance: { pollenAllergy: true },
      });
    expect(plan(local(8)).reasons).toContain('pollen');
    expect(plan(local(-20)).slots.every(slot => !slot.reasons.includes('pollen'))).toBe(true);
  });
});
