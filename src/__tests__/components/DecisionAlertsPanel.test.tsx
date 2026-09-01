import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    vi.setSystemTime(new Date('2026-08-28T09:00:00Z')); // 12:00 in İstanbul
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'serviceWorker');
    localStorage.clear();
  });

  it('clearly distinguishes modeled alerts from official MGM warnings', () => {
    vi.stubGlobal('Notification', { permission: 'default', requestPermission: vi.fn() });

    render(<DecisionAlertsPanel weather={weather} hourly={hourly} />);

    expect(screen.getByText(/hava81 model rehberidir/i)).toHaveTextContent(
      /resmî MGM MeteoUyarı değildir/i
    );
  });

  it('distinguishes an unsupported browser from blocked notification permission', () => {
    vi.stubGlobal('Notification', undefined);

    render(<DecisionAlertsPanel weather={weather} hourly={hourly} />);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent(/desteklenmiyor/i);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(/tarayıcı.*desteklemiyor/i);
    expect(status).not.toHaveTextContent(/tarayıcı ayarlarından/i);
    expect(button).toHaveAttribute('aria-describedby', status.id);
  });

  it('refreshes externally changed notification permission when the tab becomes visible', () => {
    const notificationApi = { permission: 'default' as NotificationPermission, requestPermission: vi.fn() };
    vi.stubGlobal('Notification', notificationApi);

    render(<DecisionAlertsPanel weather={weather} hourly={hourly} />);
    expect(screen.getByRole('button')).toBeEnabled();

    notificationApi.permission = 'denied';
    fireEvent(document, new Event('visibilitychange'));

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent(/engelli/i);
    expect(screen.getByRole('status')).toHaveTextContent(/tarayıcı ayarlarından/i);
  });

  it('does not present a clickable opt-in when browser permission is blocked', () => {
    const requestPermission = vi.fn();
    vi.stubGlobal('Notification', { permission: 'denied', requestPermission });

    render(<DecisionAlertsPanel weather={weather} hourly={hourly} />);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(/tarayıcı ayarlarından/i);
    expect(button).toHaveAttribute('aria-describedby', status.id);
    expect(requestPermission).not.toHaveBeenCalled();
  });

  it('keeps notification permission requests single-flight while permission is pending', async () => {
    const user = userEvent.setup();
    let resolvePermission!: (permission: NotificationPermission) => void;
    const permissionPromise = new Promise<NotificationPermission>(resolve => {
      resolvePermission = resolve;
    });
    const requestPermission = vi.fn(() => permissionPromise);
    vi.stubGlobal('Notification', { permission: 'default', requestPermission });

    render(<DecisionAlertsPanel weather={weather} hourly={hourly} />);

    const button = screen.getByRole('button');
    await user.click(button);
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveTextContent(/yükleniyor/i);

    await user.click(button);
    expect(requestPermission).toHaveBeenCalledTimes(1);

    resolvePermission('denied');
    await waitFor(() => expect(button).toHaveAttribute('aria-busy', 'false'));
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent(/engelli/i);
  });

  it('recovers cleanly if the browser rejects the permission request', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('Notification', {
      permission: 'default',
      requestPermission: vi.fn().mockRejectedValue(new Error('prompt failed')),
    });

    render(<DecisionAlertsPanel weather={weather} hourly={hourly} />);

    const button = screen.getByRole('button');
    await user.click(button);
    await waitFor(() => expect(button).toHaveAttribute('aria-busy', 'false'));
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(localStorage.getItem('hava81-alerts-v1')).toBeNull();
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

  it('keeps a delivered alert deduped for the session when its marker cannot be persisted', async () => {
    localStorage.setItem('hava81-alerts-v1', 'enabled');
    const originalSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
      this: Storage,
      key: string,
      value: string
    ) {
      if (key.startsWith('hava81-alert-sent:'))
        throw new DOMException('quota', 'QuotaExceededError');
      return originalSetItem.call(this, key, value);
    });
    const notification = vi.fn();
    Object.assign(notification, { permission: 'granted', requestPermission: vi.fn() });
    vi.stubGlobal('Notification', notification);

    const rainyHourly = hourly.map(item => ({ ...item, pop: 0.95 }));
    const { rerender } = render(<DecisionAlertsPanel weather={weather} hourly={rainyHourly} />);
    await waitFor(() => expect(notification).toHaveBeenCalledTimes(1));

    rerender(
      <DecisionAlertsPanel
        weather={{
          ...weather,
          meta: { ...weather.meta, fetchedAt: new Date('2026-08-28T09:05:00Z') },
        }}
        hourly={rainyHourly}
      />
    );
    await Promise.resolve();

    expect(notification).toHaveBeenCalledTimes(1);
    expect(
      Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).some(key =>
        key?.startsWith('hava81-alert-sent:')
      )
    ).toBe(false);
  });

  it('keeps alert delivery single-flight while service-worker delivery is pending', async () => {
    localStorage.setItem('hava81-alerts-v1', 'enabled');
    let resolveDelivery!: () => void;
    const deliveryPromise = new Promise<void>(resolve => {
      resolveDelivery = resolve;
    });
    const showNotification = vi.fn(() => deliveryPromise);
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { ready: Promise.resolve({ showNotification }) },
    });
    const notification = vi.fn();
    Object.assign(notification, { permission: 'granted', requestPermission: vi.fn() });
    vi.stubGlobal('Notification', notification);

    const rainyHourly = hourly.map(item => ({ ...item, pop: 0.95 }));
    const { rerender } = render(<DecisionAlertsPanel weather={weather} hourly={rainyHourly} />);
    await waitFor(() => expect(showNotification).toHaveBeenCalledTimes(1));

    rerender(
      <DecisionAlertsPanel
        weather={{
          ...weather,
          meta: { ...weather.meta, fetchedAt: new Date('2026-08-28T09:05:00Z') },
        }}
        hourly={rainyHourly}
      />
    );
    await Promise.resolve();
    expect(showNotification).toHaveBeenCalledTimes(1);

    resolveDelivery();
    await waitFor(() =>
      expect(
        Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).some(key =>
          key?.startsWith('hava81-alert-sent:')
        )
      ).toBe(true)
    );
  });

  it('releases the pending delivery guard after service-worker delivery fails', async () => {
    localStorage.setItem('hava81-alerts-v1', 'enabled');
    const showNotification = vi
      .fn()
      .mockRejectedValueOnce(new Error('delivery failed'))
      .mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: { ready: Promise.resolve({ showNotification }) },
    });
    const notification = vi.fn();
    Object.assign(notification, { permission: 'granted', requestPermission: vi.fn() });
    vi.stubGlobal('Notification', notification);

    const rainyHourly = hourly.map(item => ({ ...item, pop: 0.95 }));
    const { rerender } = render(<DecisionAlertsPanel weather={weather} hourly={rainyHourly} />);
    await waitFor(() => expect(showNotification).toHaveBeenCalledTimes(1));
    await Promise.resolve();
    await Promise.resolve();

    rerender(
      <DecisionAlertsPanel
        weather={{
          ...weather,
          meta: { ...weather.meta, fetchedAt: new Date('2026-08-28T09:05:00Z') },
        }}
        hourly={rainyHourly}
      />
    );
    await waitFor(() => expect(showNotification).toHaveBeenCalledTimes(2));
  });

  it('releases the pending delivery guard when service-worker readiness stalls', async () => {
    vi.useFakeTimers();
    localStorage.setItem('hava81-alerts-v1', 'enabled');
    let readyReads = 0;
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        get ready() {
          readyReads += 1;
          return new Promise<ServiceWorkerRegistration>(() => {});
        },
      },
    });
    const notification = vi.fn();
    Object.assign(notification, { permission: 'granted', requestPermission: vi.fn() });
    vi.stubGlobal('Notification', notification);

    const rainyHourly = hourly.map(item => ({ ...item, pop: 0.95 }));
    const { rerender } = render(<DecisionAlertsPanel weather={weather} hourly={rainyHourly} />);
    await Promise.resolve();
    expect(readyReads).toBe(1);

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
    await Promise.resolve();

    expect(readyReads).toBe(2);
    expect(notification).not.toHaveBeenCalled();
    expect(
      Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index)).some(key =>
        key?.startsWith('hava81-alert-sent:')
      )
    ).toBe(false);
  });

  it('fails closed when alert dedupe storage becomes unavailable', async () => {
    const originalGetItem = Storage.prototype.getItem;
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (
      this: Storage,
      key: string
    ) {
      if (key === 'hava81-alerts-v1') return 'enabled';
      if (key.startsWith('hava81-alert-sent:')) throw new DOMException('blocked', 'SecurityError');
      return originalGetItem.call(this, key);
    });
    const notification = vi.fn();
    Object.assign(notification, { permission: 'granted', requestPermission: vi.fn() });
    vi.stubGlobal('Notification', notification);

    const rainyHourly = hourly.map(item => ({ ...item, pop: 0.95 }));
    render(<DecisionAlertsPanel weather={weather} hourly={rainyHourly} />);

    await Promise.resolve();
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
    expect(notification).not.toHaveBeenCalled();
  });

  it('does not enable alerts when persisted opt-in cannot be stored', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('Notification', {
      permission: 'default',
      requestPermission: vi.fn().mockResolvedValue('granted'),
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('blocked', 'SecurityError');
    });

    render(<DecisionAlertsPanel weather={weather} hourly={hourly} />);
    const button = screen.getByRole('button');
    await user.click(button);

    expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  it('includes the localized score band in difficult-day notification copy', async () => {
    localStorage.setItem('hava81-alerts-v1', 'enabled');
    const notification = vi.fn();
    Object.assign(notification, { permission: 'granted', requestPermission: vi.fn() });
    vi.stubGlobal('Notification', notification);

    const difficultWeather = { ...weather, temperature: 45, feelsLike: 50, tempMin: 42, tempMax: 47 };
    const difficultHourly = hourly.map(item => ({ ...item, temp: 45, feelsLike: 50 }));
    render(<DecisionAlertsPanel weather={difficultWeather} hourly={difficultHourly} />);

    await waitFor(() => expect(notification).toHaveBeenCalledTimes(1));
    const [, options] = notification.mock.calls[0];
    expect(options.body).toMatch(/\d+\/100 · Zorlayıcı/);
  });

  it('dedupes alerts by the weather location calendar day instead of UTC', async () => {
    vi.setSystemTime(new Date('2026-08-29T00:30:00Z')); // 19:30 on Aug 28 at UTC-5
    localStorage.setItem('hava81-alerts-v1', 'enabled');
    const notification = vi.fn();
    Object.assign(notification, { permission: 'granted', requestPermission: vi.fn() });
    vi.stubGlobal('Notification', notification);

    const rainyHourly = hourly.map(item => ({ ...item, pop: 0.95 }));
    const westernWeather = {
      ...weather,
      meta: { ...weather.meta, timezoneOffsetSeconds: -18000 },
    };
    render(<DecisionAlertsPanel weather={westernWeather} hourly={rainyHourly} />);

    await waitFor(() => expect(notification).toHaveBeenCalledTimes(1));
    const sentKeys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index));
    expect(sentKeys.some(key => key?.startsWith('hava81-alert-sent:2026-08-28:'))).toBe(true);
    expect(sentKeys.some(key => key?.startsWith('hava81-alert-sent:2026-08-29:'))).toBe(false);
  });

  it('uses the weather location timezone for quiet hours', async () => {
    vi.setSystemTime(new Date('2026-08-28T19:30:00Z')); // 22:30 in İstanbul
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
