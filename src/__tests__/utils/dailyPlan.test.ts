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

const rich = (
  hour: number,
  temp = 24,
  overrides: Partial<HourlyForecast> = {}
): HourlyForecast => ({
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
  it('does not project current humidity or wind into future slots when hourly fields are missing', () => {
    const futurePoint = point(12, 24, { windSpeed: undefined, humidity: undefined });
    const harshCurrent = buildDailyPlan({
      weather: { ...weather, humidity: 100, windSpeed: 30 },
      hourly: [futurePoint],
    });
    const calmCurrent = buildDailyPlan({
      weather: { ...weather, humidity: 20, windSpeed: 1 },
      hourly: [futurePoint],
    });

    expect(harshCurrent.score).toBe(calmCurrent.score);
    expect(harshCurrent.slots[0].reasons).not.toContain('strong-wind');
  });

  it('keeps comfortable dry calm windows in the excellent band', () => {
    const result = scoreWeatherWindow({
      time: new Date(),
      temperature: 22,
      apparentTemperature: 22,
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

  it('keeps pleasant-but-not-perfect hours below 100 instead of flattening the comfort band', () => {
    const apparentTemperatures = [25.4, 25.1, 24.8, 24.4, 24.2, 23.9, 24];
    const scores = apparentTemperatures.map(
      (apparentTemperature, index) =>
        scoreWeatherWindow({
          time: new Date(Date.parse('2026-08-31T21:00:00.000Z') + index * 60 * 60 * 1000),
          temperature: 22.6 - index * 0.2,
          apparentTemperature,
          humidity: 81 + Math.min(index, 4),
          precipitationProbability: 0,
          precipitationMm: 0,
          windSpeed: 1.2,
          windGust: 3,
          uvIndex: 0,
          visibility: 28000,
          weatherCode: 0,
        }).score
    );

    expect(scores.every(score => score < 100)).toBe(true);
    expect(Math.min(...scores)).toBeGreaterThanOrEqual(95);
    expect(Math.max(...scores)).toBeLessThanOrEqual(99);
    expect(new Set(scores).size).toBeGreaterThanOrEqual(3);
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

  it('reserves the excellent band for near-ideal windows and keeps named rain risk out of it', () => {
    const lowChance = scoreWeatherWindow({
      time: new Date(),
      temperature: 24,
      apparentTemperature: 24,
      humidity: 45,
      precipitationProbability: 0.18,
      precipitationMm: 0,
      windSpeed: 3,
      windGust: 5,
      airQualityIndex: 1,
      uvIndex: 1,
      visibility: 20000,
      weatherCode: 0,
    });
    const moderateChance = scoreWeatherWindow({
      time: new Date(),
      temperature: 24,
      apparentTemperature: 24,
      humidity: 45,
      precipitationProbability: 0.35,
      precipitationMm: 0,
      windSpeed: 3,
      windGust: 5,
      airQualityIndex: 1,
      uvIndex: 1,
      visibility: 20000,
      weatherCode: 0,
    });
    const thresholdChance = scoreWeatherWindow({
      time: new Date(),
      temperature: 24,
      apparentTemperature: 24,
      humidity: 45,
      precipitationProbability: 0.25,
      precipitationMm: 0,
      windSpeed: 3,
      windGust: 5,
      airQualityIndex: 1,
      uvIndex: 1,
      visibility: 20000,
      weatherCode: 0,
    });

    expect(lowChance.score).toBeGreaterThanOrEqual(97);
    expect(lowChance.band).toBe('excellent');
    expect(moderateChance.score).toBeLessThanOrEqual(94);
    expect(moderateChance.band).toBe('good');
    expect(moderateChance.reasons).toContain('rain-risk');
    expect(thresholdChance.score).toBeLessThanOrEqual(96);
    expect(thresholdChance.band).toBe('good');
    expect(thresholdChance.reasons).toContain('rain-risk');
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
      airQuality: { aqi: 3, aqiLabel: 'Orta', pm25: 20, pm10: 30, o3: 70, meta: weather.meta },
    });
    expect(plan.confidence).toBe('high');
    expect(plan.impacts[0]).toBeDefined();
    expect(plan.impacts.map(impact => impact.factor)).toEqual(
      expect.arrayContaining(['thermal', 'uv'])
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
      airQuality: { aqi: 1, aqiLabel: 'İyi', pm25: 5, pm10: 8, o3: 20, meta: weather.meta },
    });
    expect(plan.nowOrLater.kind).toBe('later');
    expect(plan.nowOrLater.improvement).toBeGreaterThanOrEqual(10);
    expect(plan.bestWindow?.score).toBeGreaterThanOrEqual(93);
  });

  it('uses probability and amount for near-term umbrella advice', () => {
    const likely = buildDailyPlan({
      weather,
      hourly: [
        point(6, 24, { pop: 0.1 }),
        point(9, 23, { pop: 0.55 }),
        point(12, 22, { pop: 0.2 }),
      ],
    });
    const measurable = buildDailyPlan({
      weather,
      hourly: [rich(6, 24), rich(7, 24, { pop: 0.35, precipitationMm: 1.4 })],
    });
    expect(likely.umbrella).toBe('yes');
    expect(measurable.umbrella).toBe('yes');
  });

  it('keeps the quick air-quality label aligned with OpenWeather AQI levels', () => {
    const fair = buildDailyPlan({
      weather,
      hourly: [point(6, 24), point(9, 25), point(12, 26)],
      airQuality: { aqi: 2, aqiLabel: 'Makul', pm25: 10, pm10: 15, o3: 40, meta: weather.meta },
    });
    const good = buildDailyPlan({
      weather,
      hourly: [point(6, 24), point(9, 25), point(12, 26)],
      airQuality: { aqi: 1, aqiLabel: 'İyi', pm25: 5, pm10: 8, o3: 20, meta: weather.meta },
    });

    expect(fair.airQuality).toBe('fair');
    expect(good.airQuality).toBe('good');
  });

  it('uses current AQI only for the matching current hourly slot without projecting it forward', () => {
    const hourly = [point(6, 24), point(9, 25), point(12, 26)];
    const poor = buildDailyPlan({
      weather,
      hourly,
      airQuality: { aqi: 4, aqiLabel: 'Sağlıksız', pm25: 40, pm10: 60, o3: 90, meta: weather.meta },
    });
    const noCurrentAir = buildDailyPlan({ weather, hourly });

    expect(poor.airQuality).toBe('poor');
    expect(poor.score).toBeLessThan(noCurrentAir.score);
    expect(poor.slots[0].impacts.map(impact => impact.factor)).toContain('air-quality');
    expect(
      poor.slots
        .slice(1)
        .every(slot => slot.impacts.every(impact => impact.factor !== 'air-quality'))
    ).toBe(true);
  });

  it('uses current AQI when hourly forecast data is unavailable and scoring falls back to now', () => {
    const plan = buildDailyPlan({
      weather,
      hourly: [],
      airQuality: { aqi: 4, aqiLabel: 'Sağlıksız', pm25: 40, pm10: 60, o3: 90, meta: weather.meta },
    });
    expect(plan.airQuality).toBe('poor');
    expect(plan.impacts.map(impact => impact.factor)).toContain('air-quality');
    expect(plan.score).toBeLessThan(85);
    expect(plan.slots[0].precipitationProbability).toBeUndefined();
    expect(plan.umbrella).toBe('unknown');
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
      airQuality: { aqi: 1, aqiLabel: 'İyi', pm25: 5, pm10: 8, o3: 20, meta: weather.meta },
    });

    expect(plan.bestWindowRange).toBeDefined();
    expect(plan.bestWindowRange?.start.time.toISOString()).toBe('2026-08-28T06:00:00.000Z');
    expect(plan.bestWindowRange?.end.time.toISOString()).toBe('2026-08-28T08:00:00.000Z');
    expect(plan.bestWindow).toBe(plan.bestWindowRange?.peak);
  });
});
