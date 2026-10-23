import { describe, expect, it } from 'vitest';
import { findWindows } from '../../domain/plan/findWindows';
import { getPlanSnapshot } from '../../domain/plan/planEngine';
import { getPlanConfidence } from '../../domain/plan/confidence';
import { scoreHour } from '../../domain/plan/scoreHour';
import { getScoreBand } from '../../domain/decision/scoreWeatherWindow';
import type { AirQuality, HourlyForecast, NormalizedWeatherData } from '../../types';
import type { PlanHourScore, PlanPenalties } from '../../domain/plan/types';

const NOW = new Date('2026-10-23T06:00:00.000Z');
const OFFSET = 10_800;
const HOUR_MS = 60 * 60 * 1000;

const point = (hoursAhead = 1, overrides: Partial<HourlyForecast> = {}): HourlyForecast => ({
  time: new Date(NOW.getTime() + hoursAhead * HOUR_MS),
  temp: 20,
  apparentTemperature: 20,
  humidity: 50,
  pop: 0.05,
  precipitationMm: 0,
  windSpeed: 2,
  windGust: 4,
  uvIndex: 1,
  visibility: 10_000,
  weatherCode: 800,
  icon: '01d',
  isDay: true,
  ...overrides,
});

const currentAirQuality = (aqi: number): AirQuality => ({
  aqi,
  aqiLabel: aqi === 5 ? 'Very poor' : 'Good',
  pm25: 10,
  pm10: 20,
  o3: 10,
  meta: {
    provider: 'OpenWeather',
    fetchedAt: NOW,
    freshForSeconds: 300,
  },
});

const emptyPenalties: PlanPenalties = {
  thermal: 0,
  precipitation: 0,
  wind: 0,
  airQuality: 0,
  uv: 0,
  visibility: 0,
  severeWeather: 0,
  compound: 0,
  comfort: 0,
  total: 0,
};

const scoredSlot = (
  time: Date,
  score: number,
  overrides: Partial<PlanHourScore> = {}
): PlanHourScore => ({
  intent: 'walk',
  time,
  score,
  band: getScoreBand(score),
  temperature: 20,
  apparentTemperature: 20,
  windSpeed: 2,
  reasons: [],
  penalties: { ...emptyPenalties },
  eligible: true,
  gateReasons: [],
  confidence: 'high',
  forecastHoursAhead: 1,
  dataCoverage: 1,
  ...overrides,
});

describe('Plan v3 confidence boundaries', () => {
  it('marks the 72-hour boundary itself as low confidence', () => {
    expect(getPlanConfidence(71.999, 1)).toBe('medium');
    expect(getPlanConfidence(72, 1)).toBe('low');
    expect(getPlanConfidence(72.001, 1)).toBe('low');
  });

  it('does not count derived apparent temperature as independent evidence', () => {
    const shared = {
      humidity: 50,
      pop: 0.1,
      precipitationMm: undefined,
      windGust: undefined,
      uvIndex: undefined,
      visibility: undefined,
      weatherCode: undefined,
    };
    const withoutApparentTemperature = scoreHour({
      intent: 'walk',
      point: point(1, { ...shared, apparentTemperature: undefined }),
      timezoneOffsetSeconds: OFFSET,
      now: NOW,
    });
    const withApparentTemperature = scoreHour({
      intent: 'walk',
      point: point(1, shared),
      timezoneOffsetSeconds: OFFSET,
      now: NOW,
    });

    // Temperature, humidity, precipitation probability and wind are the four independent signals.
    expect(withoutApparentTemperature.dataCoverage).toBeCloseTo(4 / 10);
    expect(withApparentTemperature.dataCoverage).toBeCloseTo(4 / 10);
    expect(withoutApparentTemperature.confidence).toBe('low');
    expect(withApparentTemperature.confidence).toBe('low');
  });
});

describe('Plan v3 absolute safety ceilings', () => {
  it('keeps the very-poor AQI ceiling even when an intent weight is zero', () => {
    const scored = scoreHour({
      intent: 'laundry',
      point: point(),
      timezoneOffsetSeconds: OFFSET,
      now: NOW,
      airQuality: currentAirQuality(5),
    });

    expect(scored.penalties.airQuality).toBe(0);
    expect(scored.reasons).toContain('poor-air-quality');
    expect(scored.score).toBeLessThanOrEqual(45);
    expect(scored.band).not.toBe('excellent');
  });

  it('keeps the severe-weather ceiling after intent weighting', () => {
    const scored = scoreHour({
      intent: 'laundry',
      point: point(1, { weatherCode: 99 }),
      timezoneOffsetSeconds: OFFSET,
      now: NOW,
    });

    expect(scored.reasons).toContain('severe-weather');
    expect(scored.score).toBeLessThanOrEqual(25);
    expect(scored.band).toBe('difficult');
  });

  it('never gives the excellent band to a slot with a surfaced material risk', () => {
    const scored = scoreHour({
      intent: 'laundry',
      point: point(1, { uvIndex: 11 }),
      timezoneOffsetSeconds: OFFSET,
      now: NOW,
    });

    expect(scored.reasons).toContain('high-uv');
    expect(scored.score).toBeLessThanOrEqual(96);
    expect(scored.band).not.toBe('excellent');
  });
});

describe('Plan v3 window selection', () => {
  it('returns at most three non-overlapping windows ranked by score', () => {
    const scores = [70, 85, 95, 90, 80, 75, 88, 92];
    const slots = scores.map((score, index) =>
      scoredSlot(new Date(NOW.getTime() + index * HOUR_MS), score)
    );

    const windows = findWindows(slots, {
      durationMinutes: 60,
      timezoneOffsetSeconds: OFFSET,
      maxWindows: 3,
    });

    expect(windows).toHaveLength(3);
    // Selection ranks by score, then returns the selected windows chronologically.
    expect(windows.map(window => window.score)).toEqual([95, 90, 92]);
    expect([...windows.map(window => window.score)].sort((a, b) => b - a)).toEqual([95, 92, 90]);
    for (const window of windows) {
      expect(window.end.getTime() - window.start.getTime()).toBe(HOUR_MS);
    }
    for (let index = 1; index < windows.length; index += 1) {
      expect(windows[index - 1].end.getTime()).toBeLessThanOrEqual(windows[index].start.getTime());
    }
  });

  it('does not infer a two-hour window across a missing hourly forecast slot', () => {
    const slots = [0, 1, 3, 4].map(offset =>
      scoredSlot(new Date(NOW.getTime() + offset * HOUR_MS), 80)
    );

    const windows = findWindows(slots, {
      durationMinutes: 120,
      timezoneOffsetSeconds: OFFSET,
      maxWindows: 5,
    });

    expect(windows).toHaveLength(2);
    expect(windows.map(window => window.start.getTime())).toEqual([
      NOW.getTime(),
      NOW.getTime() + 3 * HOUR_MS,
    ]);
    expect(windows.every(window => window.slots.length === 2)).toBe(true);
  });

  it('respects overnight local availability and rejects malformed clock ranges', () => {
    const fridayNight = new Date('2026-10-23T19:00:00.000Z'); // 22:00 local
    const slots = [0, 1, 2, 3].map(offset =>
      scoredSlot(new Date(fridayNight.getTime() + offset * HOUR_MS), 80)
    );

    const overnight = findWindows(slots, {
      durationMinutes: 120,
      timezoneOffsetSeconds: OFFSET,
      availability: { weekdays: [5], startTime: '22:00', endTime: '06:00' },
      maxWindows: 5,
    });
    expect(overnight[0]?.start.getTime()).toBe(fridayNight.getTime());
    expect(
      overnight.every(window => window.start.getTime() < fridayNight.getTime() + HOUR_MS)
    ).toBe(true);

    expect(
      findWindows(slots, {
        durationMinutes: 60,
        timezoneOffsetSeconds: OFFSET,
        availability: { startTime: '25:00', endTime: '06:00' },
      })
    ).toEqual([]);
  });
});

describe('Plan v3 cadence validation', () => {
  it('does not invent hourly coverage from a forecast sampled only every three hours', () => {
    const slots = [0, 3, 6, 9].map(offset =>
      scoredSlot(new Date(NOW.getTime() + offset * 3 * HOUR_MS), 90)
    );

    expect(
      findWindows(slots, {
        durationMinutes: 60,
        timezoneOffsetSeconds: OFFSET,
      })
    ).toEqual([]);
    expect(
      findWindows(slots, {
        durationMinutes: 120,
        timezoneOffsetSeconds: OFFSET,
      })
    ).toEqual([]);
  });
});

describe('Plan v3 window risk labels', () => {
  it('does not let a risky hour average into an excellent window', () => {
    const slots = [
      scoredSlot(NOW, 96, { reasons: ['high-uv'] }),
      scoredSlot(new Date(NOW.getTime() + HOUR_MS), 100),
    ];

    const [window] = findWindows(slots, {
      durationMinutes: 120,
      timezoneOffsetSeconds: OFFSET,
      maxWindows: 1,
    });

    expect(window?.reasons).toContain('high-uv');
    expect(window?.score).toBeLessThanOrEqual(96);
    expect(window?.band).not.toBe('excellent');
  });
});

describe('Plan v3 snapshot integration', () => {
  const weather = { meta: { timezoneOffsetSeconds: OFFSET } } as unknown as NormalizedWeatherData;

  it('filters past and malformed hourly slots before scoring or window selection', () => {
    const snapshot = getPlanSnapshot({
      intent: 'walk',
      weather,
      hourly: [
        point(-1),
        point(1),
        point(2),
        point(3),
        point(4),
        point(5, { windSpeed: Number.NaN }),
      ],
      now: NOW,
    });

    expect(snapshot.hours.map(hour => hour.time.getTime())).toEqual(
      [1, 2, 3, 4].map(offset => NOW.getTime() + offset * HOUR_MS)
    );
    expect(snapshot.windows.length).toBeGreaterThan(0);
    expect(snapshot.windows.every(window => window.start.getTime() >= NOW.getTime())).toBe(true);
    expect(snapshot.windows.every(window => window.end.getTime() > window.start.getTime())).toBe(
      true
    );
    expect(snapshot.confidence).toBe('high');
  });

  it('does not let stale current AQI become evidence for future plan slots', () => {
    const staleAirQuality: AirQuality = {
      ...currentAirQuality(5),
      meta: {
        provider: 'OpenWeather',
        fetchedAt: new Date(NOW.getTime() - 60 * 60 * 1000),
        freshForSeconds: 300,
      },
    };
    const snapshot = getPlanSnapshot({
      intent: 'walk',
      weather,
      hourly: [point(1), point(2), point(3)],
      airQuality: staleAirQuality,
      now: NOW,
    });

    expect(snapshot.hours.every(hour => hour.airQualityIndex === undefined)).toBe(true);
    expect(snapshot.hours.every(hour => !hour.reasons.includes('poor-air-quality'))).toBe(true);
  });

  it('keeps the whole snapshot low confidence at and beyond 72 hours', () => {
    const snapshot = getPlanSnapshot({
      intent: 'walk',
      weather,
      hourly: [point(72), point(73), point(74), point(75)],
      now: NOW,
    });

    expect(snapshot.hours.every(hour => hour.confidence === 'low')).toBe(true);
    expect(snapshot.confidence).toBe('low');
    expect(snapshot.windows.every(window => window.confidence === 'low')).toBe(true);
  });
});

describe('Plan v3 gate and comfort reason coverage', () => {
  it('gates forecast slots that exceed precipitation or wind limits', () => {
    const wet = scoreHour({
      intent: 'walk',
      point: point(1, { pop: 0.9 }),
      timezoneOffsetSeconds: OFFSET,
      now: NOW,
    });
    const windy = scoreHour({
      intent: 'walk',
      point: point(1, { windSpeed: 17 }),
      timezoneOffsetSeconds: OFFSET,
      now: NOW,
    });

    expect(wet.gateReasons).toContain('precipitation-limit');
    expect(windy.gateReasons).toContain('wind-limit');
  });

  it('surfaces intent-specific heat and cold comfort reasons below global warning thresholds', () => {
    const hotForRunning = scoreHour({
      intent: 'run',
      point: point(1, { temp: 29, apparentTemperature: 29 }),
      timezoneOffsetSeconds: OFFSET,
      now: NOW,
    });
    const coldForPicnic = scoreHour({
      intent: 'picnic',
      point: point(1, { temp: 10, apparentTemperature: 10 }),
      timezoneOffsetSeconds: OFFSET,
      now: NOW,
    });

    expect(hotForRunning.reasons).toContain('heat');
    expect(coldForPicnic.reasons).toContain('cold');
  });
});

describe('Plan v3 snapshot edge cases', () => {
  const weather = { meta: { timezoneOffsetSeconds: OFFSET } } as unknown as NormalizedWeatherData;

  it('uses a finite positive custom duration and accepts fresh current AQI evidence', () => {
    const snapshot = getPlanSnapshot({
      intent: 'walk',
      weather,
      hourly: [point(1), point(2), point(3)],
      airQuality: currentAirQuality(3),
      durationMinutes: 90.4,
      now: NOW,
    });

    expect(snapshot.durationMinutes).toBe(90);
    expect(snapshot.hours.every(hour => hour.airQualityIndex === 3)).toBe(true);
    expect(
      snapshot.windows.every(
        window => window.end.getTime() - window.start.getTime() === 90 * 60_000
      )
    ).toBe(true);
  });

  it('returns a low-confidence empty snapshot when no future hourly samples exist', () => {
    const snapshot = getPlanSnapshot({ intent: 'walk', weather, hourly: [], now: NOW });

    expect(snapshot.hours).toEqual([]);
    expect(snapshot.windows).toEqual([]);
    expect(snapshot.dataCoverage).toBe(0);
    expect(snapshot.confidence).toBe('low');
  });
});

describe('Plan v3 window boundary rejection', () => {
  it('rejects otherwise valid windows outside a caller availability range', () => {
    const fridayNight = new Date('2026-10-23T19:00:00.000Z'); // 22:00 local
    const slots = [0, 1, 2].map(offset =>
      scoredSlot(new Date(fridayNight.getTime() + offset * HOUR_MS), 80)
    );

    expect(
      findWindows(slots, {
        durationMinutes: 60,
        timezoneOffsetSeconds: OFFSET,
        availability: { startTime: '08:00', endTime: '10:00' },
      })
    ).toEqual([]);
  });

  it('rejects an irregular cadence when a gap exceeds the inferred coverage tolerance', () => {
    const offsets = [0, 0.5, 1.75, 2.25, 2.75];
    const slots = offsets.map(offset => scoredSlot(new Date(NOW.getTime() + offset * HOUR_MS), 90));

    expect(
      findWindows(slots, {
        durationMinutes: 120,
        timezoneOffsetSeconds: OFFSET,
        maxWindows: 5,
      })
    ).toEqual([]);
  });
});
