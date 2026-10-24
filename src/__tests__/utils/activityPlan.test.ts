import { describe, expect, it } from 'vitest';
import { buildActivityPlan } from '../../domain/activity/buildActivityPlan';
import type { AirQualityHourly, HourlyForecast, NormalizedWeatherData } from '../../types';

const weather: NormalizedWeatherData = {
  cityName: 'İzmir',
  country: 'TR',
  temperature: 30,
  feelsLike: 31,
  tempMin: 24,
  tempMax: 35,
  humidity: 45,
  pressure: 1012,
  visibility: 10000,
  windSpeed: 5,
  windDirection: 180,
  description: 'açık',
  icon: '01d',
  sunrise: new Date(),
  sunset: new Date(),
  timestamp: new Date('2026-08-28T09:00:00Z'),
  coordinates: { lat: 38.42, lon: 27.14 },
  clouds: 0,
  meta: { provider: 'OpenWeather', fetchedAt: new Date(), timezoneOffsetSeconds: 10800 },
};
const hourly = (
  temps: number[],
  pops = temps.map(() => 0.05),
  winds = temps.map(() => 4)
): HourlyForecast[] =>
  temps.map((temp, index) => ({
    time: new Date(Date.UTC(2026, 7, 28, 9 + index * 3)),
    temp,
    pop: pops[index],
    windSpeed: winds[index],
    icon: '01d',
  }));

describe('activity plans', () => {
  it('does not project current humidity or wind into future activity hours when hourly fields are missing', () => {
    const points = hourly([24, 24, 24]).map(point => ({
      ...point,
      windSpeed: undefined,
      humidity: undefined,
    })) as unknown as HourlyForecast[];
    const harshCurrent = buildActivityPlan({
      activity: 'walk',
      weather: { ...weather, humidity: 100, windSpeed: 30 },
      hourly: points,
    });
    const calmCurrent = buildActivityPlan({
      activity: 'walk',
      weather: { ...weather, humidity: 20, windSpeed: 1 },
      hourly: points,
    });

    expect(harshCurrent.score).toBe(calmCurrent.score);
    expect(harshCurrent.reasons).not.toContain('strong-wind');
  });

  it('penalizes heat for running more than laundry drying', () => {
    const points = hourly([35, 36, 34, 30]);
    const run = buildActivityPlan({ activity: 'run', weather, hourly: points });
    const laundry = buildActivityPlan({ activity: 'laundry', weather, hourly: points });
    expect(run.score).toBeLessThan(laundry.score);
    expect(run.activityImpact).toBeLessThan(laundry.activityImpact);
    expect(run.score).toBe(run.baselineScore + run.activityImpact);
  });

  it('penalizes wind and rain strongly for motorcycle', () => {
    const points = hourly([22, 22, 22], [0.6, 0.5, 0.3], [13, 15, 12]);
    const plan = buildActivityPlan({ activity: 'motorcycle', weather, hourly: points });
    expect(plan.score).toBeLessThan(40);
    expect(plan.reasons).toContain('strong-wind');
    expect(plan.reasons).toContain('heavy-rain');
  });

  it('applies the current AQI to every activity hour so the children air weight is live', () => {
    const points = hourly([22, 23, 24]);
    const air = { aqi: 4, aqiLabel: 'Sağlıksız', pm25: 40, pm10: 60, o3: 80, meta: weather.meta };
    const withCurrentAir = buildActivityPlan({
      activity: 'children',
      weather,
      hourly: points,
      airQuality: air,
    });
    const withoutAir = buildActivityPlan({
      activity: 'children',
      weather,
      hourly: points,
    });
    expect(withCurrentAir.score).toBeLessThan(withoutAir.score);
    expect(withCurrentAir.reasons).toContain('poor-air-quality');
    expect(
      withCurrentAir.slots.every(slot =>
        slot.impacts.some(impact => impact.factor === 'air-quality')
      )
    ).toBe(true);
  });

  it('uses exact-hour European AQI when fresh, normalizing it to the existing risk scale', () => {
    const points = hourly([22, 23, 24]);
    const currentAir = {
      aqi: 1,
      aqiLabel: 'İyi',
      pm25: 4,
      pm10: 8,
      o3: 20,
      meta: { provider: 'OpenWeather', fetchedAt: new Date(), freshForSeconds: 300 },
    };
    const hourlyAqi = (values: number[]): AirQualityHourly => ({
      hours: values.map((europeanAqi, index) => ({
        time: points[index].time,
        europeanAqi,
      })),
      meta: { provider: 'Open-Meteo', fetchedAt: new Date(), freshForSeconds: 1800 },
    });
    const clean = buildActivityPlan({
      activity: 'run',
      weather,
      hourly: points,
      airQuality: currentAir,
      airQualityHourly: hourlyAqi([10, 15, 19]),
    });
    const poor = buildActivityPlan({
      activity: 'run',
      weather,
      hourly: points,
      airQuality: currentAir,
      airQualityHourly: hourlyAqi([10, 80, 1000]),
    });

    expect(poor.score).toBeLessThan(clean.score);
    expect(poor.reasons).toContain('poor-air-quality');
    expect(poor.slots[0]?.impacts.some(impact => impact.factor === 'air-quality')).toBe(false);
    expect(poor.slots[1]?.impacts.some(impact => impact.factor === 'air-quality')).toBe(true);
    expect(poor.slots[2]?.impacts.some(impact => impact.factor === 'air-quality')).toBe(true);
  });

  it('ignores European AQI above the payload ceiling and uses the fresh current reading fallback', () => {
    const points = hourly([22, 23, 24]);
    const currentAir = {
      aqi: 1,
      aqiLabel: 'İyi',
      pm25: 4,
      pm10: 8,
      o3: 20,
      meta: { provider: 'OpenWeather', fetchedAt: new Date(), freshForSeconds: 300 },
    };
    const hourlyAqi = (values: number[]): AirQualityHourly => ({
      hours: values.map((europeanAqi, index) => ({ time: points[index].time, europeanAqi })),
      meta: { provider: 'Open-Meteo', fetchedAt: new Date(), freshForSeconds: 1800 },
    });
    const withInvalidFirstHour = buildActivityPlan({
      activity: 'run',
      weather,
      hourly: points,
      airQuality: currentAir,
      airQualityHourly: hourlyAqi([1001, 10, 10]),
    });
    const validLowEvidence = buildActivityPlan({
      activity: 'run',
      weather,
      hourly: points,
      airQuality: currentAir,
      airQualityHourly: hourlyAqi([10, 10, 10]),
    });

    expect(withInvalidFirstHour.score).toBe(validLowEvidence.score);
    expect(withInvalidFirstHour.reasons).toEqual(validLowEvidence.reasons);
    expect(
      withInvalidFirstHour.slots[0]?.impacts.some(impact => impact.factor === 'air-quality')
    ).toBe(false);
  });

  it('ignores stale hourly AQI instead of using it to change activity recommendations', () => {
    const points = hourly([22, 23, 24]);
    const currentAir = {
      aqi: 1,
      aqiLabel: 'İyi',
      pm25: 4,
      pm10: 8,
      o3: 20,
      meta: { provider: 'OpenWeather', fetchedAt: new Date(), freshForSeconds: 300 },
    };
    const staleHourly: AirQualityHourly = {
      hours: points.map(point => ({ time: point.time, europeanAqi: 100 })),
      meta: {
        provider: 'Open-Meteo',
        fetchedAt: new Date(Date.now() - 10_000),
        freshForSeconds: 1,
      },
    };
    const withStale = buildActivityPlan({
      activity: 'run',
      weather,
      hourly: points,
      airQuality: currentAir,
      airQualityHourly: staleHourly,
    });
    const withoutHourly = buildActivityPlan({
      activity: 'run',
      weather,
      hourly: points,
      airQuality: currentAir,
    });

    expect(withStale.score).toBe(withoutHourly.score);
    expect(withStale.reasons).toEqual(withoutHourly.reasons);
  });

  it('ignores stale or out-of-range current AQI instead of reusing it for future hours', () => {
    const points = hourly([20, 20, 20], [0, 0, 0], [2, 2, 2]);
    const staleAir = {
      aqi: 5,
      aqiLabel: 'Bilinmiyor',
      pm25: 40,
      pm10: 60,
      o3: 80,
      meta: {
        provider: 'OpenWeather',
        fetchedAt: new Date(Date.now() - 60 * 60 * 1000),
        freshForSeconds: 300,
      },
    };
    const withoutAir = buildActivityPlan({ activity: 'run', weather, hourly: points });
    const withStaleAir = buildActivityPlan({
      activity: 'run',
      weather,
      hourly: points,
      airQuality: staleAir,
    });
    const withInvalidAir = buildActivityPlan({
      activity: 'run',
      weather,
      hourly: points,
      airQuality: { ...staleAir, aqi: 99, meta: { ...weather.meta, freshForSeconds: 300 } },
    });

    expect(withStaleAir.score).toBe(withoutAir.score);
    expect(withStaleAir.reasons).toEqual(withoutAir.reasons);
    expect(withInvalidAir.score).toBe(withoutAir.score);
    expect(withInvalidAir.reasons).toEqual(withoutAir.reasons);
    expect(
      withStaleAir.slots.every(
        slot => !slot.impacts.some(impact => impact.factor === 'air-quality')
      )
    ).toBe(true);
  });

  it('lowers the running score when the current AQI is poor (AQI 4)', () => {
    const points = hourly([14, 14, 14]);
    const air = { aqi: 4, aqiLabel: 'Sağlıksız', pm25: 40, pm10: 60, o3: 80, meta: weather.meta };
    const clean = { ...air, aqi: 1, aqiLabel: 'İyi' };
    const poorRun = buildActivityPlan({
      activity: 'run',
      weather,
      hourly: points,
      airQuality: air,
    });
    const cleanRun = buildActivityPlan({
      activity: 'run',
      weather,
      hourly: points,
      airQuality: clean,
    });
    const poorWalk = buildActivityPlan({
      activity: 'walk',
      weather,
      hourly: points,
      airQuality: air,
    });
    const cleanWalk = buildActivityPlan({
      activity: 'walk',
      weather,
      hourly: points,
      airQuality: clean,
    });

    expect(poorRun.score).toBeLessThan(cleanRun.score);
    // Running carries an extra air weight on top of the shared AQI penalty.
    expect(cleanRun.score - poorRun.score).toBeGreaterThan(cleanWalk.score - poorWalk.score);
  });

  it('still uses current AQI when the activity plan falls back to current weather', () => {
    const air = { aqi: 4, aqiLabel: 'Sağlıksız', pm25: 40, pm10: 60, o3: 80, meta: weather.meta };
    const walk = buildActivityPlan({ activity: 'walk', weather, hourly: [], airQuality: air });
    expect(walk.baselineScore).toBeLessThan(100);
    expect(walk.reasons).toContain('poor-air-quality');
    expect(walk.slots[0].precipitationProbability).toBeUndefined();
  });

  it('keeps a current-only activity score out of the excellent band when rain is unknown', () => {
    const currentOnly = buildActivityPlan({
      activity: 'walk',
      weather: { ...weather, temperature: 22, feelsLike: 22, windSpeed: 3, humidity: 45 },
      hourly: [],
    });

    expect(currentOnly.slots[0]?.precipitationProbability).toBeUndefined();
    expect(currentOnly.slots[0]?.score).toBe(89);
    expect(currentOnly.slots[0]?.band).toBe('good');
    expect(currentOnly.score).toBeLessThanOrEqual(89);
  });

  it('does not award dry-weather activity benefits when precipitation is unknown', () => {
    const currentOnly = buildActivityPlan({
      activity: 'walk',
      weather: { ...weather, temperature: 20, feelsLike: 20, windSpeed: 4 },
      hourly: [],
    });
    const explicitlyDry = buildActivityPlan({
      activity: 'walk',
      weather: { ...weather, temperature: 20, feelsLike: 20, windSpeed: 4 },
      hourly: [
        {
          time: weather.timestamp,
          temp: 20,
          apparentTemperature: 20,
          pop: 0,
          windSpeed: 4,
          icon: '01d',
        },
      ],
    });

    expect(currentOnly.slots[0].precipitationProbability).toBeUndefined();
    expect(explicitlyDry.slots[0].precipitationProbability).toBe(0);
    expect(currentOnly.activityImpact).toBeLessThan(explicitlyDry.activityImpact);
  });

  it.each([
    ['negative probability', { pop: -0.1, precipitationMm: undefined }],
    ['over-range probability', { pop: 1.1, precipitationMm: undefined }],
    ['negative amount', { pop: undefined, precipitationMm: -0.1 }],
  ])('keeps activity scores out of the excellent band for %s', (_label, overrides) => {
    const points = hourly([20, 20, 20]).map(point => ({ ...point, ...overrides })) as unknown as HourlyForecast[];
    const plan = buildActivityPlan({
      activity: 'walk',
      weather: { ...weather, temperature: 20, feelsLike: 20, windSpeed: 4 },
      hourly: points,
    });

    expect(plan.score).toBeLessThanOrEqual(89);
    expect(plan.slots.every(slot => slot.score <= 89 && slot.band !== 'excellent')).toBe(true);
    expect(
      plan.slots.every(
        slot => slot.precipitationProbability === undefined && slot.precipitationMm === undefined
      )
    ).toBe(true);
  });

  it('temperature sensitivity shifts activity comfort', () => {
    const points = hourly([30, 31, 32]);
    const heatSensitive = buildActivityPlan({
      activity: 'walk',
      weather,
      hourly: points,
      sensitivity: 'heat',
    });
    const coldSensitive = buildActivityPlan({
      activity: 'walk',
      weather,
      hourly: points,
      sensitivity: 'cold',
    });
    expect(heatSensitive.score).toBeLessThan(coldSensitive.score);
  });

  it('recalculates the score and best time inside a user-selected clock range', () => {
    const points: HourlyForecast[] = [
      {
        time: new Date('2026-08-28T09:00:00Z'),
        temp: 18,
        apparentTemperature: 18,
        pop: 0,
        windSpeed: 2,
        icon: '01d',
      },
      {
        time: new Date('2026-08-28T15:00:00Z'),
        temp: 30,
        apparentTemperature: 31,
        pop: 0,
        windSpeed: 4,
        icon: '01d',
      },
      {
        time: new Date('2026-08-28T16:00:00Z'),
        temp: 31,
        apparentTemperature: 32,
        pop: 0,
        windSpeed: 4,
        icon: '01d',
      },
      {
        time: new Date('2026-08-28T17:00:00Z'),
        temp: 32,
        apparentTemperature: 33,
        pop: 0,
        windSpeed: 4,
        icon: '01d',
      },
    ];
    const unfiltered = buildActivityPlan({ activity: 'run', weather, hourly: points });
    const filtered = buildActivityPlan({
      activity: 'run',
      weather,
      hourly: points,
      preferredStart: '18:00',
      preferredEnd: '20:00',
    });

    expect(filtered.windowApplied).toEqual({ start: '18:00', end: '20:00' });
    expect(filtered.windowUnavailable).toBe(false);
    expect(filtered.score).toBeLessThan(unfiltered.score);
    expect(filtered.bestWindow).toBeDefined();
    const localBest = new Date(filtered.bestWindow!.time.getTime() + 3 * 60 * 60_000);
    expect(localBest.getUTCHours()).toBeGreaterThanOrEqual(18);
    expect(localBest.getUTCHours()).toBeLessThanOrEqual(20);
  });

  it('wraps a selected clock range across midnight', () => {
    const points: HourlyForecast[] = [
      { time: new Date('2026-08-28T18:00:00Z'), temp: 35, pop: 0, windSpeed: 2, icon: '01n' },
      { time: new Date('2026-08-28T19:00:00Z'), temp: 22, pop: 0, windSpeed: 2, icon: '01n' },
      { time: new Date('2026-08-28T22:00:00Z'), temp: 18, pop: 0, windSpeed: 2, icon: '01n' },
      { time: new Date('2026-08-29T00:00:00Z'), temp: 36, pop: 0, windSpeed: 2, icon: '01n' },
    ];
    const filtered = buildActivityPlan({
      activity: 'run',
      weather,
      hourly: points,
      preferredStart: '22:00',
      preferredEnd: '02:00',
    });

    expect(filtered.windowUnavailable).toBe(false);
    expect(filtered.bestWindow?.time.toISOString()).toBe('2026-08-28T19:00:00.000Z');
  });

  it('treats equal start and end clocks as that selected instant, not a hidden full-day range', () => {
    const points: HourlyForecast[] = [
      { time: new Date('2026-08-28T15:00:00Z'), temp: 36, pop: 0, windSpeed: 2, icon: '01d' },
      { time: new Date('2026-08-28T16:00:00Z'), temp: 18, pop: 0, windSpeed: 2, icon: '01d' },
    ];
    const filtered = buildActivityPlan({
      activity: 'run',
      weather,
      hourly: points,
      preferredStart: '18:00',
      preferredEnd: '18:00',
    });

    expect(filtered.windowUnavailable).toBe(false);
    expect(filtered.bestWindow?.time.toISOString()).toBe('2026-08-28T15:00:00.000Z');
    expect(filtered.score).toBe(filtered.bestWindow?.score);
  });

  it('reports an unavailable selected window instead of inventing a best time', () => {
    const points: HourlyForecast[] = [
      { time: new Date('2026-08-28T09:00:00Z'), temp: 20, pop: 0, windSpeed: 2, icon: '01d' },
      { time: new Date('2026-08-28T10:00:00Z'), temp: 21, pop: 0, windSpeed: 2, icon: '01d' },
    ];
    const filtered = buildActivityPlan({
      activity: 'walk',
      weather,
      hourly: points,
      preferredStart: '23:00',
      preferredEnd: '23:30',
    });
    expect(filtered.windowUnavailable).toBe(true);
    expect(filtered.bestWindow).toBeUndefined();
  });

  it('does not promote an activity window with a surfaced weather risk into the excellent band', () => {
    const points = hourly([20, 20, 20], [0.25, 0.25, 0.25], [3, 3, 3]).map(point => ({
      ...point,
      precipitationMm: 0,
      apparentTemperature: 20,
      humidity: 50,
      windGust: 5,
      uvIndex: 0,
      visibility: 20000,
      weatherCode: 2,
    }));
    const walk = buildActivityPlan({ activity: 'walk', weather, hourly: points });

    expect(walk.reasons).toContain('rain-risk');
    expect(walk.score).toBeLessThanOrEqual(96);
    expect(walk.band).toBe('good');
    expect(walk.slots.every(slot => slot.band !== 'excellent')).toBe(true);
  });

  it('does not invent future air-quality risk when only a current AQI is available', () => {
    const points = hourly([20, 20, 20]);
    const air = { aqi: 2, aqiLabel: 'Orta', pm25: 10, pm10: 15, o3: 40, meta: weather.meta };
    const walk = buildActivityPlan({ activity: 'walk', weather, hourly: points, airQuality: air });
    expect(walk.reasons).not.toContain('sensitive-air-quality');
    expect(walk.reasons).not.toContain('poor-air-quality');
  });

  it('lets a running-friendly cool temperature refund only the generic thermal penalty', () => {
    const points = hourly([12, 12, 12]);
    const run = buildActivityPlan({ activity: 'run', weather, hourly: points });

    expect(run.activityImpact).toBeGreaterThan(0);
    expect(run.score).toBeGreaterThan(run.baselineScore);
    expect(run.score).toBeLessThanOrEqual(100);
  });

  it('does not turn current poor AQI into a future laundry air-quality penalty', () => {
    const points = hourly([30, 30, 30], [0, 0, 0], [6, 6, 6]);
    const air = { aqi: 4, aqiLabel: 'Sağlıksız', pm25: 40, pm10: 60, o3: 80, meta: weather.meta };
    const laundry = buildActivityPlan({
      activity: 'laundry',
      weather,
      hourly: points,
      airQuality: air,
    });

    expect(laundry.activityImpact).toBeGreaterThan(0);
    expect(laundry.reasons).not.toContain('poor-air-quality');
  });
});
