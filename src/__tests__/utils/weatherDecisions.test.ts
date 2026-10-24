import { describe, expect, it } from 'vitest';
import { getWeatherDecisions } from '../../utils/weatherDecisions';
import type { HourlyForecast, NormalizedWeatherData } from '../../types';
import type { WeatherDecisionInput } from '../../utils/weatherDecisions';

const weather: NormalizedWeatherData = {
  cityName: 'İstanbul',
  country: 'TR',
  temperature: 24,
  feelsLike: 24,
  tempMin: 18,
  tempMax: 28,
  humidity: 60,
  pressure: 1012,
  visibility: 10000,
  windSpeed: 4,
  windDirection: 180,
  description: 'açık',
  icon: '01d',
  sunrise: new Date('2026-08-28T03:00:00Z'),
  sunset: new Date('2026-08-28T16:00:00Z'),
  timestamp: new Date('2026-08-28T09:00:00Z'),
  coordinates: { lat: 41, lon: 29 },
  clouds: 5,
  meta: { provider: 'OpenWeather', fetchedAt: new Date(), timezoneOffsetSeconds: 10800 },
};

const point = (overrides: Partial<HourlyForecast> = {}): HourlyForecast => ({
  time: new Date('2026-08-28T12:00:00Z'),
  temp: 24,
  icon: '01d',
  pop: 0.1,
  windSpeed: 4,
  ...overrides,
});

const decisionNow = new Date('2026-08-28T09:00:00Z');
const decide = (input: Omit<WeatherDecisionInput, 'now'>) =>
  getWeatherDecisions({ ...input, now: decisionNow });

describe('getWeatherDecisions', () => {
  it('uses actual hourly amount to recognize material rain even below the old probability threshold', () => {
    const result = decide({
      weather,
      hourly: [point({ pop: 0.55, precipitationMm: 5 })],
    });
    expect(result[0]).toMatchObject({ kind: 'rain', severity: 'high', amount: 5 });
  });

  it('anchors the 12-hour decision window to now and ignores past or out-of-window risks', () => {
    const past = point({
      time: new Date('2026-08-28T08:00:00Z'),
      pop: 0.98,
      precipitationMm: 9,
    });
    const nearFuture = point({
      time: new Date('2026-08-28T11:00:00Z'),
      pop: 0.65,
      precipitationMm: 2,
    });
    const beyondWindow = point({
      time: new Date('2026-08-28T22:00:00Z'),
      pop: 0.99,
      precipitationMm: 12,
    });

    const result = decide({ weather, hourly: [past, beyondWindow, nearFuture] });

    expect(result.find(item => item.kind === 'rain')).toMatchObject({
      kind: 'rain',
      severity: 'moderate',
      time: nearFuture.time,
      amount: 2,
    });
  });

  it('excludes the current instant, the exact 12-hour boundary, and invalid timestamps', () => {
    const atNow = point({
      time: new Date(decisionNow),
      temp: 48,
      apparentTemperature: 52,
      windSpeed: 28,
      windGust: 32,
      pop: 0.99,
      precipitationMm: 12,
    });
    const inside = point({
      time: new Date(decisionNow.getTime() + 6 * 60 * 60 * 1000),
      temp: 20,
      apparentTemperature: 20,
      humidity: 45,
      windSpeed: 2,
      windGust: 3,
      pop: 0.05,
      precipitationMm: 0,
      uvIndex: 1,
      visibility: 10000,
      weatherCode: 1,
    });
    const atEnd = point({
      time: new Date(decisionNow.getTime() + 12 * 60 * 60 * 1000),
      temp: -25,
      apparentTemperature: -30,
      windSpeed: 28,
      windGust: 32,
      pop: 0.99,
      precipitationMm: 12,
    });
    const invalid = point({ time: new Date(Number.NaN), pop: 0.99, precipitationMm: 12 });

    const result = decide({ weather, hourly: [atNow, atEnd, invalid, inside] });

    expect(result.some(item => ['rain', 'wind', 'heat', 'cold'].includes(item.kind))).toBe(false);
    expect(result.some(item => item.kind === 'unavailable')).toBe(false);
  });

  it('uses gusts and apparent temperature for wind and heat decisions', () => {
    const result = decide({
      weather,
      hourly: [point({ temp: 30, apparentTemperature: 41, windSpeed: 5, windGust: 20 })],
    });
    expect(result.map(item => item.kind)).toEqual(expect.arrayContaining(['wind', 'heat']));
    expect(result.find(item => item.kind === 'wind')?.value).toBe(20);
    expect(result.find(item => item.kind === 'heat')).toMatchObject({ severity: 'high', value: 41 });
  });

  it('keeps poor current air quality separate from a future outdoor weather window', () => {
    const result = decide({
      weather,
      hourly: [point({ temp: 20, pop: 0.05, windSpeed: 2 })],
      airQuality: { aqi: 4, aqiLabel: 'Sağlıksız', pm25: 30, pm10: 50, o3: 70, meta: weather.meta },
    });
    expect(result.map(item => item.kind)).toContain('air-quality');
    expect(result.map(item => item.kind)).toContain('outdoor-window');
  });

  it('does not attach a future hour to heat that is only true right now', () => {
    const futureTime = new Date('2026-08-28T15:00:00Z');
    const result = decide({
      weather: { ...weather, feelsLike: 38 },
      hourly: [point({ time: futureTime, temp: 30, apparentTemperature: 31 })],
    });

    expect(result.find(item => item.kind === 'heat')).toMatchObject({
      kind: 'heat',
      value: 38,
    });
    expect(result.find(item => item.kind === 'heat')?.time).toBeUndefined();
  });

  it('does not attach a future hour to cold that is only true right now', () => {
    const futureTime = new Date('2026-08-28T15:00:00Z');
    const result = decide({
      weather: { ...weather, feelsLike: -4 },
      hourly: [point({ time: futureTime, temp: 4, apparentTemperature: 2 })],
    });

    expect(result.find(item => item.kind === 'cold')).toMatchObject({
      kind: 'cold',
      value: -4,
    });
    expect(result.find(item => item.kind === 'cold')?.time).toBeUndefined();
  });

  it('treats UV input as a modeled next-24-hour maximum when richer hourly UV is absent', () => {
    const result = decide({
      weather,
      hourly: [],
      uvIndexMax: 7.2,
    });
    expect(result[0]).toMatchObject({ kind: 'uv', severity: 'moderate', value: 7.2 });
  });

  it('uses rich hourly UV when it is stronger than the context maximum', () => {
    const result = decide({
      weather,
      hourly: [point({ uvIndex: 9 })],
      uvIndexMax: 6,
    });
    expect(result.find(item => item.kind === 'uv')).toMatchObject({ severity: 'high', value: 9 });
  });

  it('does not project current humidity or wind into a future outdoor score when hourly fields are missing', () => {
    const hourly = [
      point({ temp: 20, apparentTemperature: undefined, humidity: undefined, windSpeed: undefined }),
    ];
    const calmDryCurrent = decide({
      weather: { ...weather, humidity: 20, windSpeed: 0 },
      hourly,
    });
    const humidWindyCurrent = decide({
      weather: { ...weather, humidity: 95, windSpeed: 18 },
      hourly,
    });

    expect(calmDryCurrent.find(item => item.kind === 'outdoor-window')).toEqual(
      humidWindyCurrent.find(item => item.kind === 'outdoor-window')
    );
  });

  it('uses stable copy when the shared snapshot has no distinct best window', () => {
    const result = decide({
      weather,
      hourly: [point()],
      bestWindowTime: null,
    });

    expect(result).toEqual([{ kind: 'stable', severity: 'info' }]);
  });

  it('reports unavailable near-term guidance when no hourly forecast exists', () => {
    const result = decide({ weather, hourly: [] });
    expect(result).toEqual([{ kind: 'unavailable', severity: 'info' }]);
  });
});
