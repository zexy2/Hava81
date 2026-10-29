import { describe, expect, it } from 'vitest';
import { scoreHour } from '../../domain/plan/scoreHour';
import type { PlanIntent } from '../../domain/plan/types';
import type { HourlyForecast } from '../../types';

/** New activities score the way their owners expect (dogs, beach, cycling, garden). */
const OFFSET = 10800;
const local = (hour: number) => new Date(Date.UTC(2026, 6, 15, hour - 3));
const hour = (h: number, overrides: Partial<HourlyForecast> = {}): HourlyForecast => ({
  time: local(h),
  temp: 22,
  apparentTemperature: 22,
  humidity: 50,
  pop: 0.05,
  precipitationMm: 0,
  windSpeed: 3,
  windGust: 5,
  uvIndex: 3,
  visibility: 20000,
  weatherCode: 1,
  icon: h >= 6 && h < 20 ? '01d' : '01n',
  isDay: h >= 6 && h < 20,
  description: 'açık',
  ...overrides,
});
const score = (
  intent: PlanIntent,
  point: HourlyForecast,
  extra: Partial<Parameters<typeof scoreHour>[0]> = {}
) => scoreHour({ intent, point, timezoneOffsetSeconds: OFFSET, now: local(6), ...extra });
const sea = { seaTemperatureC: 24, waveHeightM: 0.3 };

describe('new activities', () => {
  it('dog walk: a hot hour scores below a walk (dogs overheat, pavement burns)', () => {
    const hot = hour(15, { temp: 30, apparentTemperature: 31, uvIndex: 8 });
    expect(score('dog', hot).score).toBeLessThan(score('walk', hot).score);
  });

  it('dog walk: night is a valid hour; a walk keeps the 07–23 rule', () => {
    const night = hour(0, { temp: 18, apparentTemperature: 18, uvIndex: 0 });
    expect(score('dog', night).eligible).toBe(true);
    expect(score('walk', night).gateReasons).toContain('outside-active-hours');
  });

  it('beach: a warm, calm sea day is a good hour', () => {
    const day = hour(13, { temp: 27, apparentTemperature: 27, uvIndex: 7 });
    const result = score('beach', day, sea);
    expect(result.eligible).toBe(true);
    expect(['good', 'excellent']).toContain(result.band);
  });

  it('beach: cold water or rough sea rules the hour out', () => {
    const day = hour(13, { temp: 27, apparentTemperature: 27 });
    expect(score('beach', day, { seaTemperatureC: 17, waveHeightM: 0.3 }).gateReasons).toContain(
      'sea-conditions'
    );
    expect(score('beach', day, { seaTemperatureC: 24, waveHeightM: 1.8 }).gateReasons).toContain(
      'sea-conditions'
    );
  });

  it('beach: without sea data there is no recommendation', () => {
    const day = hour(13, { temp: 27, apparentTemperature: 27 });
    expect(score('beach', day).eligible).toBe(false);
  });

  it('cycling: 11 m/s wind is above its limit while a walk is still possible', () => {
    const windy = hour(12, { windSpeed: 11, windGust: 14 });
    expect(score('bike', windy).gateReasons).toContain('wind-limit');
    expect(score('walk', windy).gateReasons).not.toContain('wind-limit');
  });

  it('garden: needs daylight', () => {
    expect(score('garden', hour(22)).gateReasons).toContain('daylight-required');
    expect(score('garden', hour(10)).eligible).toBe(true);
  });

  it('golden hour: only the hour next to dark; overcast hides the light', () => {
    const golden = hour(18, { weatherCode: 1, sunshineDuration: 3600 });
    expect(score('photo', golden, { goldenHour: true }).eligible).toBe(true);
    expect(score('photo', hour(13)).gateReasons).toContain('outside-golden-hour');
    const overcast = hour(18, { weatherCode: 3, sunshineDuration: 0 });
    expect(score('photo', overcast, { goldenHour: true }).score).toBeLessThan(
      score('photo', golden, { goldenHour: true }).score - 15
    );
  });
});
