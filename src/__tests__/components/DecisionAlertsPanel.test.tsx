import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '../../i18n';
import { DecisionAlertsPanel } from '../../components/hava81/DecisionAlertsPanel';
import type { HourlyForecast, NormalizedWeatherData } from '../../types';

const weather: NormalizedWeatherData = {
  cityName: 'İstanbul',
  country: 'TR',
  temperature: 27,
  feelsLike: 28,
  tempMin: 22,
  tempMax: 29,
  humidity: 55,
  pressure: 1012,
  visibility: 10000,
  windSpeed: 4,
  windDirection: 120,
  description: 'açık',
  icon: '01d',
  sunrise: new Date('2026-08-28T03:00:00Z'),
  sunset: new Date('2026-08-28T16:30:00Z'),
  timestamp: new Date('2026-08-28T09:00:00Z'),
  coordinates: { lat: 41.01, lon: 28.97 },
  clouds: 5,
  meta: { provider: 'OpenWeather', fetchedAt: new Date(), timezoneOffsetSeconds: 10800 },
};

const hourly: HourlyForecast[] = [
  { time: new Date('2026-08-28T10:00:00Z'), temp: 27, pop: 0.1, windSpeed: 4, icon: '01d' },
  { time: new Date('2026-08-28T13:00:00Z'), temp: 29, pop: 0.1, windSpeed: 5, icon: '01d' },
];

describe('DecisionAlertsPanel', () => {
  it('does not present a clickable opt-in when browser permission is blocked', () => {
    const requestPermission = vi.fn();
    vi.stubGlobal('Notification', { permission: 'denied', requestPermission });

    render(<DecisionAlertsPanel weather={weather} hourly={hourly} />);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(requestPermission).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });
});
