import { describe, expect, it } from 'vitest';
import { clearSkyAt, overcastAt, paletteFor, smooth } from '../../components/sky/skyPalette';
import { resolveSkyScene, skyPhaseAt, sunAt, type SkyScene } from '../../components/sky/skyScene';
import type { HourlyForecast, NormalizedWeatherData, WeatherIconCode } from '../../types';

const MIN = 60_000;
const HOUR = 60 * MIN;
const sunrise = Date.UTC(2026, 7, 28, 3, 0); // 06:00 local (UTC+3)
const sunset = Date.UTC(2026, 7, 28, 16, 0); // 19:00 local

const weather = (overrides: Partial<NormalizedWeatherData> = {}): NormalizedWeatherData =>
  ({
    cityName: 'İstanbul',
    temperature: 20,
    feelsLike: 20,
    humidity: 50,
    windSpeed: 4,
    description: 'açık',
    icon: '01d',
    clouds: 10,
    visibility: 10000,
    sunrise: new Date(sunrise),
    sunset: new Date(sunset),
    ...overrides,
  }) as NormalizedWeatherData;

const scene = (overrides: Partial<SkyScene> = {}): SkyScene => ({
  condition: 'clear',
  phase: 'day',
  cloudCover: 0.1,
  intensity: 0,
  windSpeed: 4,
  sunrise,
  sunset,
  ...overrides,
});

describe('sunAt', () => {
  it('rises in the east, peaks at solar noon and sets in the west', () => {
    expect(sunAt(sunrise, sunrise, sunset)).toEqual({ elevation: 0, azimuth: 0 });
    const noon = sunAt((sunrise + sunset) / 2, sunrise, sunset);
    expect(noon.elevation).toBeCloseTo(1, 5);
    expect(noon.azimuth).toBeCloseTo(0.5, 5);
    const evening = sunAt(sunset, sunrise, sunset);
    expect(evening.elevation).toBeCloseTo(0, 5);
    expect(evening.azimuth).toBe(1);
  });

  it('is low and on the morning side shortly after sunrise', () => {
    const early = sunAt(sunrise + HOUR, sunrise, sunset);
    expect(early.elevation).toBeGreaterThan(0);
    expect(early.elevation).toBeLessThan(0.3);
    expect(early.azimuth).toBeLessThan(0.5);
  });

  it('falls to full night about 100 minutes after sunset, on the evening side', () => {
    const dusk = sunAt(sunset + 30 * MIN, sunrise, sunset);
    expect(dusk.elevation).toBeCloseTo(-0.3, 5);
    expect(dusk.azimuth).toBe(1);
    expect(sunAt(sunset + 3 * HOUR, sunrise, sunset).elevation).toBe(-1);
  });

  it('uses the morning side before sunrise, measured from the next sunrise', () => {
    const dawn = sunAt(sunrise - 20 * MIN, sunrise, sunset);
    expect(dawn.elevation).toBeCloseTo(-0.2, 5);
    expect(dawn.azimuth).toBe(0);
  });

  it('measures across midnight from the previous sunset and the next sunrise', () => {
    // Late evening on the same calendar day, then past midnight before sunrise.
    expect(sunAt(sunset + 50 * MIN, sunrise, sunset).azimuth).toBe(1);
    const lateNight = sunAt(sunrise + 22 * HOUR, sunrise, sunset);
    expect(lateNight.elevation).toBeLessThan(0);
    expect(lateNight.azimuth).toBe(0);
  });

  it('falls back to a mid-day or night sun without valid times', () => {
    expect(sunAt(0, Number.NaN, sunset)).toEqual({ elevation: 0.6, azimuth: 0.5 });
    expect(sunAt(0, sunset, sunrise, true)).toEqual({ elevation: -0.6, azimuth: 0.5 });
  });
});

describe('skyPhaseAt', () => {
  it('names twilight around sunrise and sunset, day between and night outside', () => {
    expect(skyPhaseAt(sunrise + 10 * MIN, new Date(sunrise), new Date(sunset), false)).toBe('dawn');
    expect(skyPhaseAt(sunset - 10 * MIN, new Date(sunrise), new Date(sunset), false)).toBe('dusk');
    expect(skyPhaseAt(sunrise + 5 * HOUR, new Date(sunrise), new Date(sunset), false)).toBe('day');
    expect(skyPhaseAt(sunset + 3 * HOUR, new Date(sunrise), new Date(sunset), false)).toBe('night');
  });

  it('falls back to the icon day/night flag when the times are unusable', () => {
    const invalid = new Date(Number.NaN);
    expect(skyPhaseAt(0, invalid, invalid, true)).toBe('night');
    expect(skyPhaseAt(0, invalid, invalid, false)).toBe('day');
  });
});

describe('resolveSkyScene', () => {
  it('maps every weather icon family to a distinct sky condition', () => {
    const conditionOf = (icon: WeatherIconCode) =>
      resolveSkyScene(weather({ icon }), [], sunrise + 5 * HOUR).condition;
    expect(conditionOf('01d')).toBe('clear');
    expect(conditionOf('02d')).toBe('partly');
    expect(conditionOf('03d')).toBe('partly');
    expect(conditionOf('04d')).toBe('cloudy');
    expect(conditionOf('09d')).toBe('rain');
    expect(conditionOf('10d')).toBe('rain');
    expect(conditionOf('11d')).toBe('storm');
    expect(conditionOf('13d')).toBe('snow');
    expect(conditionOf('50d')).toBe('fog');
  });

  it('treats very low visibility as fog even under a clear icon', () => {
    expect(resolveSkyScene(weather({ visibility: 400 }), [], sunrise + HOUR).condition).toBe('fog');
  });

  it('carries sunrise and sunset so the sky can follow the sun', () => {
    const resolved = resolveSkyScene(weather(), [], sunrise + HOUR);
    expect(resolved.sunrise).toBe(sunrise);
    expect(resolved.sunset).toBe(sunset);
  });

  it('scales rain intensity with the measured amount of the hour in progress', () => {
    const now = sunrise + 4 * HOUR;
    const hour = (precipitationMm?: number, pop?: number): HourlyForecast[] => [
      {
        time: new Date(now - 10 * MIN),
        temp: 18,
        icon: '10d',
        description: 'yağmur',
        pop: pop ?? 0,
        precipitationMm,
        windSpeed: 4,
      } as HourlyForecast,
    ];
    const light = resolveSkyScene(weather({ icon: '10d' }), hour(0.4), now).intensity;
    const heavy = resolveSkyScene(weather({ icon: '10d' }), hour(4), now).intensity;
    expect(heavy).toBeGreaterThan(light);
    expect(heavy).toBe(1);
    // Probability only: a moderate default from the chance of rain.
    expect(
      resolveSkyScene(weather({ icon: '10d' }), hour(undefined, 0.5), now).intensity
    ).toBeCloseTo(0.5, 5);
    // No current hour at all: a moderate default.
    expect(resolveSkyScene(weather({ icon: '10d' }), [], now).intensity).toBe(0.5);
    expect(resolveSkyScene(weather(), hour(4), now).intensity).toBe(0);
  });

  it('keeps wet and foggy skies well covered and uses defaults for missing values', () => {
    const now = sunrise + HOUR;
    expect(resolveSkyScene(weather({ icon: '10d', clouds: 10 }), [], now).cloudCover).toBe(0.75);
    const noClouds = (icon: WeatherIconCode) =>
      resolveSkyScene(weather({ icon, clouds: Number.NaN as unknown as number }), [], now)
        .cloudCover;
    expect(noClouds('01d')).toBe(0.05);
    expect(noClouds('02d')).toBe(0.4);
    expect(noClouds('04d')).toBe(0.85);
    expect(resolveSkyScene(weather({ windSpeed: Number.NaN }), [], now).windSpeed).toBe(2);
  });
});

describe('sky palette', () => {
  const warmth = (rgb: readonly number[]) => rgb[0] - rgb[2];

  it('turns the horizon warm at sunset and deep blue at noon', () => {
    const sunsetSky = clearSkyAt({ elevation: 0, azimuth: 1 });
    const noonSky = clearSkyAt({ elevation: 1, azimuth: 0.5 });
    expect(warmth(sunsetSky.horizon)).toBeGreaterThan(80);
    expect(warmth(noonSky.zenith)).toBeLessThan(-100);
  });

  it('gives dusk a redder horizon than dawn', () => {
    const dawn = clearSkyAt({ elevation: -0.22, azimuth: 0 });
    const dusk = clearSkyAt({ elevation: -0.22, azimuth: 1 });
    expect(dusk.horizon[0] - dusk.horizon[1]).toBeGreaterThan(dawn.horizon[0] - dawn.horizon[1]);
  });

  it('is darkest at night and clamps beyond the first and last stops', () => {
    const night = clearSkyAt({ elevation: -1, azimuth: 1 });
    expect(Math.max(...night.zenith)).toBeLessThan(40);
    expect(clearSkyAt({ elevation: 2, azimuth: 0.5 })).toEqual(
      clearSkyAt({ elevation: 0.85, azimuth: 0.5 })
    );
  });

  it('keeps every daytime highlight below white so white type stays readable', () => {
    for (const elevation of [0.2, 0.5, 0.85, 1]) {
      for (const colour of Object.values(clearSkyAt({ elevation, azimuth: 0.5 }))) {
        expect(Math.max(...colour)).toBeLessThanOrEqual(240);
      }
    }
  });

  it('brightens an overcast sky with the sun and warms it near the horizon', () => {
    const dim = overcastAt({ elevation: -0.6, azimuth: 0 });
    const bright = overcastAt({ elevation: 0.8, azimuth: 0.5 });
    const low = overcastAt({ elevation: 0, azimuth: 1 });
    expect(bright.zenith[0]).toBeGreaterThan(dim.zenith[0]);
    expect(warmth(low.horizon)).toBeGreaterThan(warmth(bright.horizon));
  });

  it('separates clear, partly and overcast skies, and darkens storms', () => {
    const noon = { elevation: 1, azimuth: 0.5 };
    const blueness = (s: SkyScene) => {
      const { zenith } = paletteFor(s, noon);
      return zenith[2] - zenith[0];
    };
    expect(blueness(scene())).toBeGreaterThan(blueness(scene({ condition: 'partly' })));
    expect(blueness(scene({ condition: 'partly' }))).toBeGreaterThan(
      blueness(scene({ condition: 'cloudy' }))
    );
    const rain = paletteFor(scene({ condition: 'rain' }), noon);
    const storm = paletteFor(scene({ condition: 'storm' }), noon);
    expect(storm.lit[0]).toBeLessThan(rain.lit[0]);
  });

  it('smooth eases between its edges and clamps outside them', () => {
    expect(smooth(0, 1, -1)).toBe(0);
    expect(smooth(0, 1, 2)).toBe(1);
    expect(smooth(0, 1, 0.5)).toBeCloseTo(0.5, 5);
  });
});
