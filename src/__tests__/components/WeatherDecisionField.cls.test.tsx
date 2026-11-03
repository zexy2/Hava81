/**
 * #1782: the decision rail keeps the same rows while the forecast loads, so its arrival does
 * not push the page down.
 *
 * FROZEN: written before the implementation and not edited afterwards. If a check is wrong,
 * raise it with the owner instead of changing it.
 */
import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../i18n';
import { WeatherDecisionField } from '../../components/hava81/WeatherDecisionField';
import { SettingsProvider } from '../../context';
import type { ForecastMeta, NormalizedWeatherData } from '../../types';

const weather: NormalizedWeatherData = {
  cityName: 'İstanbul',
  country: 'TR',
  temperature: 26,
  feelsLike: 25,
  tempMin: 26,
  tempMax: 26,
  humidity: 55,
  pressure: 1012,
  visibility: 10000,
  windSpeed: 3,
  windDirection: 180,
  description: 'açık',
  icon: '01d',
  sunrise: new Date('2026-08-29T03:00:00Z'),
  sunset: new Date('2026-08-29T16:00:00Z'),
  timestamp: new Date('2026-08-29T09:00:00Z'),
  coordinates: { lat: 41.01, lon: 28.97 },
  clouds: 0,
  meta: {
    provider: 'OpenWeather',
    fetchedAt: new Date('2026-08-29T13:00:00Z'),
    timezoneOffsetSeconds: 10800,
  },
};

const forecastMeta: ForecastMeta = {
  provider: 'MET Norway',
  fetchedAt: new Date('2026-08-29T13:00:00Z'),
  timezoneOffsetSeconds: 10800,
  intervalHours: 1,
  freshForSeconds: 600,
};

const rail = () => document.querySelector('.hava81-decision-field__rail') as HTMLElement;
const metrics = () => [...rail().querySelectorAll('.hava81-decision-field__metric')];

const renderField = (props: Partial<Parameters<typeof WeatherDecisionField>[0]>) =>
  render(
    <SettingsProvider>
      <WeatherDecisionField weather={weather} hourly={[]} {...props} />
    </SettingsProvider>
  );

describe('WeatherDecisionField loading layout', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-29T13:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('#1782 reserves the UV row with a dash while the forecast is still loading', () => {
    renderField({});
    expect(metrics()).toHaveLength(3);
    const uv = within(rail())
      .getByText('UV İndeksi')
      .closest('.hava81-decision-field__metric') as HTMLElement;
    expect(within(uv).getByText('—')).toBeInTheDocument();
  });

  it('#1782 shows the UV value in the same row once it arrives', () => {
    renderField({ forecastMeta, uvIndexMax: 7.1 });
    expect(metrics()).toHaveLength(3);
    expect(within(rail()).getByText('7,1')).toBeInTheDocument();
  });

  it('#1782 drops the row when the loaded forecast has no UV, rather than showing a dash forever', () => {
    renderField({ forecastMeta });
    expect(metrics()).toHaveLength(2);
    expect(screen.queryByText('UV İndeksi')).not.toBeInTheDocument();
  });
});
