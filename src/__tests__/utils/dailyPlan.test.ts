import { describe, expect, it } from 'vitest';
import { buildDailyPlan } from '../../domain/decision/buildDailyPlan';
import { scoreWeatherWindow } from '../../domain/decision/scoreWeatherWindow';
import type { HourlyForecast, NormalizedWeatherData } from '../../types';

const weather: NormalizedWeatherData = {
  cityName: 'İzmir',
  country: 'TR',
  temperature: 29,
  feelsLike: 29,
  tempMin: 24,
  tempMax: 34,
  humidity: 40,
  pressure: 1012,
  visibility: 10000,
  windSpeed: 4,
  windDirection: 180,
  description: 'açık',
  icon: '01d',
  sunrise: new Date('2026-08-28T03:30:00.000Z'),
  sunset: new Date('2026-08-28T16:45:00.000Z'),
  timestamp: new Date('2026-08-28T06:00:00.000Z'),
  coordinates: { lat: 38.42, lon: 27.14 },
  clouds: 0,
  meta: {
    provider: 'OpenWeather',
    fetchedAt: new Date('2026-08-28T06:00:00.000Z'),
    timezoneOffsetSeconds: 10800,
  },
};

const point = (
  hour: number,
  temp: number,
  overrides: Partial<Omit<HourlyForecast, 'time' | 'temp'>> = {}
): HourlyForecast => ({
  time: new Date(`2026-08-28T${String(hour).padStart(2, '0')}:00:00.000Z`),
  temp,
  pop: 0,
  windSpeed: 4,
  icon: '01d',
  description: 'açık',
  ...overrides,
});

const rich = (hour: number, temp = 24, overrides: Partial<HourlyForecast> = {}): HourlyForecast => ({
  ...point(hour, temp, {
    apparentTemperature: temp,
    humidity: 45,
    precipitationMm: 0,
    windGust: 6,
    uvIndex: 2,
    visibility: 20000,
    weatherCode: 0,
  }),
  ...overrides,
});

describe('Hava81 daily decision engine v2', () => {
  it('keeps comfortable dry calm windows in the excellent band', () => {
    const result = scoreWeatherWindow({
      time: new Date(),
      temperature: 24,
      apparentTemperature: 24,
      humidity: 45,
      precipitationProbability: 0.05,
      precipitationMm: 0,
      windSpeed: 3,
      windGust: 5,
      airQualityIndex: 1,
      uvIndex: 2,
      visibility: 20000,
      weatherCode: 0,
    });
    expect(result.score).toBe(100);
    expect(result.band).toBe('excellent');
    expect(result.reasons).toEqual([]);
    expect(result.impacts).toEqual([]);
  });

  it('penalizes and caps compound hazardous weather', () => {
    const result = scoreWeatherWindow({
      time: new Date(),
      temperature: 38,
      apparentTemperature: 45,
      humidity: 75,
      precipitationProbability: 0.8,
      precipitationMm: 8,
      windSpeed: 22,
      windGust: 30,
      airQualityIndex: 5,
      uvIndex: 10,
      visibility: 400,
      weatherCode: 99,
    });
    expect(result.score).toBeLessThanOrEqual(25);
    expect(result.band).toBe('difficult');
    expect(result.reasons).toEqual(
      expect.arrayContaining([
        'extreme-heat',
        'heavy-rain',
        'strong-wind',
        'poor-air-quality',
        'high-uv',
        'low-visibility',
        'severe-weather',
      ])
    );
    expect(result.impacts.some(impact => impact.factor === 'compound')).toBe(true);
  });

  it('treats humid heat as materially worse than the same dry-bulb temperature in dry air', () => {
    const dry = scoreWeatherWindow({
      time: new Date(),
      temperature: 32,
      humidity: 35,
      precipitationProbability: 0,
      windSpeed: 2,
    });
    const humid = scoreWeatherWindow({
      time: new Date(),
      temperature: 32,
      humidity: 75,
      precipitationProbability: 0,
      windSpeed: 2,
    });
    expect(humid.apparentTemperature).toBeGreaterThan(dry.apparentTemperature);
    expect(humid.score).toBeLessThan(dry.score - 10);
  });

  it('separates precipitation probability from actual hourly amount', () => {
    const likelyTrace = scoreWeatherWindow({
      time: new Date(),
      temperature: 22,
      precipitationProbability: 0.9,
      precipitationMm: 0.1,
      windSpeed: 3,
    });
    const materialRain = scoreWeatherWindow({
      time: new Date(),
      temperature: 22,
      precipitationProbability: 0.7,
      precipitationMm: 6,
      windSpeed: 3,
    });
    expect(materialRain.score).toBeLessThan(likelyTrace.score - 10);
  });

  it('penalizes dangerous gusts even when sustained wind is moderate', () => {
    const calmGusts = scoreWeatherWindow({
      time: new Date(),
      temperature: 22,
      precipitationProbability: 0,
      windSpeed: 5,
      windGust: 8,
    });
    const sharpGusts = scoreWeatherWindow({
      time: new Date(),
      temperature: 22,
      precipitationProbability: 0,
      windSpeed: 5,
      windGust: 24,
    });
    expect(sharpGusts.score).toBeLessThan(calmGusts.score - 10);
    expect(sharpGusts.reasons).toContain('strong-wind');
  });

  it('adds WHO-style UV exposure pressure without pretending it is the only decision signal', () => {
    const lowUv = scoreWeatherWindow({
      time: new Date(),
      temperature: 24,
      precipitationProbability: 0,
      windSpeed: 3,
      uvIndex: 1,
    });
    const highUv = scoreWeatherWindow({
      time: new Date(),
      temperature: 24,
      precipitationProbability: 0,
      windSpeed: 3,
      uvIndex: 9,
    });
    expect(highUv.score).toBeLessThan(lowUv.score);
    expect(highUv.reasons).toContain('high-uv');
  });

  it('recognizes low visibility and severe thunderstorm codes', () => {
    const result = scoreWeatherWindow({
      time: new Date(),
      temperature: 20,
      precipitationProbability: 0.5,
      precipitationMm: 2,
      windSpeed: 6,
      visibility: 500,
      weatherCode: 99,
    });
    expect(result.score).toBeLessThanOrEqual(25);
    expect(result.reasons).toEqual(expect.arrayContaining(['low-visibility', 'severe-weather']));
  });

  it('does not create a large artificial score cliff around the old 32°C threshold', () => {
    const below = scoreWeatherWindow({
      time: new Date(),
      temperature: 31.9,
      precipitationProbability: 0,
      windSpeed: 3,
    });
    const above = scoreWeatherWindow({
      time: new Date(),
      temperature: 32.1,
      precipitationProbability: 0,
      windSpeed: 3,
    });
    expect(Math.abs(below.score - above.score)).toBeLessThanOrEqual(2);
  });

  it('is cadence-stable for the same 12-hour weather signal', () => {
    const hourly = Array.from({ length: 12 }, (_, index) => rich(6 + index, 26, { uvIndex: 5 }));
    const threeHourly = [6, 9, 12, 15].map(hour => rich(hour, 26, { uvIndex: 5 }));
    const oneHourPlan = buildDailyPlan({ weather, hourly });
    const threeHourPlan = buildDailyPlan({ weather, hourly: threeHourly });
    expect(Math.abs(oneHourPlan.score - threeHourPlan.score)).toBeLessThanOrEqual(1);
  });

  it('marks rich one-hour input as high-confidence and exposes the dominant score factors', () => {
    const plan = buildDailyPlan({
      weather,
      hourly: Array.from({ length: 12 }, (_, index) =>
        rich(6 + index, 31, { apparentTemperature: 35, uvIndex: 8 })
      ),
      airQuality: { aqi: 3, aqiLabel: 'Orta', pm25: 20, pm10: 30, o3: 70 },
    });
    expect(plan.confidence).toBe('high');
    expect(plan.impacts[0]).toBeDefined();
    expect(plan.impacts.map(impact => impact.factor)).toEqual(
      expect.arrayContaining(['thermal', 'uv', 'air-quality'])
    );
  });

  it('recommends waiting when a materially better window is approaching', () => {
    const hourly = [
      point(6, 38, { pop: 0.1, windSpeed: 5 }),
      point(9, 35, { pop: 0.1, windSpeed: 5 }),
      point(12, 29, { pop: 0.05, windSpeed: 4 }),
      point(15, 27, { pop: 0.05, windSpeed: 3 }),
    ];
    const plan = buildDailyPlan({
      weather,
      hourly,
      airQuality: { aqi: 1, aqiLabel: 'İyi', pm25: 5, pm10: 8, o3: 20 },
    });
    expect(plan.nowOrLater.kind).toBe('later');
    expect(plan.nowOrLater.improvement).toBeGreaterThanOrEqual(10);
    expect(plan.bestWindow?.score).toBeGreaterThanOrEqual(95);
  });

  it('uses probability and amount for near-term umbrella advice', () => {
    const likely = buildDailyPlan({
      weather,
      hourly: [point(6, 24, { pop: 0.1 }), point(9, 23, { pop: 0.55 }), point(12, 22, { pop: 0.2 })],
    });
    const measurable = buildDailyPlan({
      weather,
      hourly: [rich(6, 24), rich(7, 24, { pop: 0.35, precipitationMm: 1.4 })],
    });
    expect(likely.umbrella).toBe('yes');
    expect(measurable.umbrella).toBe('yes');
  });

  it('degrades the day score for unhealthy air', () => {
    const plan = buildDailyPlan({
      weather,
      hourly: [point(6, 24), point(9, 25), point(12, 26)],
      airQuality: { aqi: 4, aqiLabel: 'Sağlıksız', pm25: 40, pm10: 60, o3: 90 },
    });
    expect(plan.airQuality).toBe('poor');
    expect(plan.score).toBeLessThan(85);
  });

  it('lets a sustained difficult period pull down the 12-hour score without using one arbitrary worst point', () => {
    const hourly = [
      rich(6, 24),
      rich(7, 24),
      rich(8, 24),
      rich(9, 42, { apparentTemperature: 44 }),
      rich(10, 42, { apparentTemperature: 44 }),
      rich(11, 42, { apparentTemperature: 44 }),
      rich(12, 24),
      rich(13, 24),
      rich(14, 24),
      rich(15, 24),
      rich(16, 24),
      rich(17, 24),
    ];
    const plan = buildDailyPlan({ weather, hourly });
    const simpleAverage = Math.round(
      plan.slots.slice(0, 12).reduce((sum, slot) => sum + slot.score, 0) / 12
    );
    expect(plan.score).toBeLessThan(simpleAverage);
    expect(plan.score).toBeLessThan(85);
  });
  it('groups adjacent near-best hours into an honest best-looking range', () => {
    const plan = buildDailyPlan({
      weather,
      hourly: [rich(6, 24), rich(7, 24), rich(8, 24), rich(9, 35, { apparentTemperature: 36 })],
      airQuality: { aqi: 1, aqiLabel: 'İyi', pm25: 5, pm10: 8, o3: 20 },
    });

    expect(plan.bestWindowRange).toBeDefined();
    expect(plan.bestWindowRange?.start.time.toISOString()).toBe('2026-08-28T06:00:00.000Z');
    expect(plan.bestWindowRange?.end.time.toISOString()).toBe('2026-08-28T08:00:00.000Z');
    expect(plan.bestWindow).toBe(plan.bestWindowRange?.peak);
  });

});
