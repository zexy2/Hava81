import { render } from '@testing-library/react';
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

const rainyHourly: HourlyForecast[] = [
  { time: new Date('2026-08-28T10:00:00Z'), temp: 27, pop: 0.95, windSpeed: 4, icon: '10d' },
  { time: new Date('2026-08-28T13:00:00Z'), temp: 29, pop: 0.95, windSpeed: 5, icon: '10d' },
];

describe('DecisionAlertsPanel stalled delivery', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-28T09:00:00Z'));
    localStorage.setItem('hava81-alerts-v1', 'enabled');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'serviceWorker');
    localStorage.clear();
  });

  it('releases the pending guard when showNotification never settles', async () => {
    const showNotification = vi.fn(() => new Promise<void>(() => {}));
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { ready: Promise.resolve({ showNotification }) },
    });
    const notification = vi.fn();
    Object.assign(notification, { permission: 'granted', requestPermission: vi.fn() });
    vi.stubGlobal('Notification', notification);

    const { rerender } = render(
      <DecisionAlertsPanel weather={weather} hourly={rainyHourly} />
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(showNotification).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5_001);
    rerender(
      <DecisionAlertsPanel
        weather={{
          ...weather,
          meta: { ...weather.meta, fetchedAt: new Date('2026-08-28T09:05:00Z') },
        }}
        hourly={rainyHourly}
      />
    );
    await vi.advanceTimersByTimeAsync(0);

    expect(showNotification).toHaveBeenCalledTimes(2);
    expect(notification).not.toHaveBeenCalled();
    expect(
      Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).some(key =>
        key?.startsWith('hava81-alert-sent:')
      )
    ).toBe(false);
  });
});
