import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 7, 28, 12, 0, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('does not present a clickable opt-in when browser permission is blocked', () => {
    const requestPermission = vi.fn();
    vi.stubGlobal('Notification', { permission: 'denied', requestPermission });

    render(<DecisionAlertsPanel weather={weather} hourly={hourly} />);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it('lets a previously enabled user turn alerts off after browser permission becomes blocked', async () => {
    const user = userEvent.setup();
    localStorage.setItem('hava81-alerts-v1', 'enabled');
    const requestPermission = vi.fn();
    vi.stubGlobal('Notification', { permission: 'denied', requestPermission });

    render(<DecisionAlertsPanel weather={weather} hourly={hourly} />);

    const button = screen.getByRole('button');
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute('aria-pressed', 'true');
    await user.click(button);

    expect(localStorage.getItem('hava81-alerts-v1')).toBeNull();
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).toBeDisabled();
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it('does not mark a decision alert as sent when notification delivery fails', async () => {
    localStorage.setItem('hava81-alerts-v1', 'enabled');
    const notification = vi.fn(function NotificationMock() {
      throw new Error('delivery failed');
    });
    Object.assign(notification, { permission: 'granted', requestPermission: vi.fn() });
    vi.stubGlobal('Notification', notification);

    const rainyHourly = hourly.map(item => ({ ...item, pop: 0.95 }));
    render(<DecisionAlertsPanel weather={weather} hourly={rainyHourly} />);

    await waitFor(() => expect(notification).toHaveBeenCalled());
    expect(
      Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).some(key =>
        key?.startsWith('hava81-alert-sent:')
      )
    ).toBe(false);
  });

  it('does not deliver a decision alert during quiet hours', async () => {
    vi.setSystemTime(new Date(2026, 7, 28, 23, 0, 0));
    localStorage.setItem('hava81-alerts-v1', 'enabled');
    const notification = vi.fn();
    Object.assign(notification, { permission: 'granted', requestPermission: vi.fn() });
    vi.stubGlobal('Notification', notification);

    const rainyHourly = hourly.map(item => ({ ...item, pop: 0.95 }));
    render(<DecisionAlertsPanel weather={weather} hourly={rainyHourly} />);

    await Promise.resolve();
    expect(notification).not.toHaveBeenCalled();
  });
});
