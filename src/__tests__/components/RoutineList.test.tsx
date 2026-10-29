import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../i18n';
import { ActivityPlanner } from '../../components/hava81/ActivityPlanner';
import { SettingsProvider } from '../../context';
import { ROUTINES_KEY } from '../../storage/routineStore';
import type { ForecastMeta, HourlyForecast, NormalizedWeatherData } from '../../types';

// 2026-08-29 is a Saturday. 09:00 local (06:00Z).
const NOW = new Date('2026-08-29T06:00:00Z');
const weather: NormalizedWeatherData = {
  cityName: 'İstanbul',
  country: 'TR',
  temperature: 22,
  feelsLike: 22,
  tempMin: 18,
  tempMax: 27,
  humidity: 55,
  pressure: 1012,
  visibility: 10000,
  windSpeed: 3,
  windDirection: 180,
  description: 'açık',
  icon: '01d',
  sunrise: new Date('2026-08-29T03:30:00Z'),
  sunset: new Date('2026-08-29T16:40:00Z'),
  timestamp: NOW,
  coordinates: { lat: 41.01, lon: 28.97 },
  clouds: 0,
  meta: { provider: 'OpenWeather', fetchedAt: NOW, timezoneOffsetSeconds: 10800 },
};
const meta = (): ForecastMeta => ({
  provider: 'OpenMeteo',
  fetchedAt: new Date(),
  timezoneOffsetSeconds: 10800,
  intervalHours: 1,
  freshForSeconds: 1_800,
});
const hourly: HourlyForecast[] = Array.from({ length: 48 }, (_, index) => {
  const time = new Date(NOW.getTime() + index * 3_600_000);
  const localHour = (9 + index) % 24;
  const isDay = localHour >= 7 && localHour < 19;
  return {
    time,
    temp: 22,
    apparentTemperature: 22,
    humidity: 50,
    pop: 0.05,
    precipitationMm: 0,
    windSpeed: 2.5,
    windGust: 4,
    uvIndex: isDay ? 3 : 0,
    visibility: 20000,
    weatherCode: 1,
    icon: isDay ? '01d' : '01n',
    isDay,
  };
});

const renderPlanner = () =>
  render(
    <SettingsProvider>
      <ActivityPlanner weather={weather} hourly={hourly} forecastMeta={meta()} />
    </SettingsProvider>
  );

describe('My plans', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it('offers templates first; one tap adds a scored plan that is stored', () => {
    // A brand-new user: no old profile to migrate.
    localStorage.setItem(ROUTINES_KEY, JSON.stringify({ schemaVersion: 1, routines: [] }));
    renderPlanner();
    const list = screen.getByRole('region', { name: 'Planlarım' });
    fireEvent.click(within(list).getByRole('button', { name: /Hafta sonu piknik/ }));

    const row = within(list).getByRole('button', { name: /Piknik planını düzenle/ });
    expect(row).toHaveTextContent(/Bugün/);
    expect(row).toHaveTextContent(/\d{2}/);
    const stored = JSON.parse(localStorage.getItem(ROUTINES_KEY) ?? '{}');
    expect(stored.routines).toHaveLength(1);
    expect(stored.routines[0]).toMatchObject({
      activity: 'picnic',
      schedule: { kind: 'flexible' },
    });
  });

  it('builds a custom plan in the editor, then deletes it', () => {
    localStorage.setItem(ROUTINES_KEY, JSON.stringify({ schemaVersion: 1, routines: [] }));
    renderPlanner();
    const list = screen.getByRole('region', { name: 'Planlarım' });
    fireEvent.click(within(list).getByRole('button', { name: 'Plan ekle' }));
    const editor = within(list).getByRole('form', { name: 'Yeni plan' });
    fireEvent.click(within(editor).getByRole('button', { name: /Bisiklet/ }));
    fireEvent.click(within(editor).getByRole('button', { name: 'Hafta sonu' }));
    fireEvent.click(within(editor).getByRole('button', { name: 'Kaydet' }));

    expect(within(list).getByRole('button', { name: /Bisiklet planını düzenle/ })).toBeVisible();
    const stored = JSON.parse(localStorage.getItem(ROUTINES_KEY) ?? '{}');
    expect(stored.routines[0]).toMatchObject({
      activity: 'bike',
      schedule: { kind: 'fixed', days: [0, 6], start: '18:30' },
    });

    fireEvent.click(within(list).getByRole('button', { name: /Bisiklet planını düzenle/ }));
    fireEvent.click(within(list).getByRole('button', { name: 'Planı sil' }));
    expect(JSON.parse(localStorage.getItem(ROUTINES_KEY) ?? '{}').routines).toEqual([]);
  });

  it('an old profile becomes plans without losing anything', () => {
    localStorage.setItem(
      'hava81-decision-profile-v1',
      JSON.stringify({ activities: ['walk', 'dog'], temperatureSensitivity: 'balanced' })
    );
    renderPlanner();
    const list = screen.getByRole('region', { name: 'Planlarım' });
    expect(within(list).getByRole('button', { name: /Yürüyüş planını düzenle/ })).toBeVisible();
    expect(
      within(list).getByRole('button', { name: /Köpek gezdirme planını düzenle/ })
    ).toBeVisible();
  });

  it('a day is required before saving', () => {
    localStorage.setItem(ROUTINES_KEY, JSON.stringify({ schemaVersion: 1, routines: [] }));
    renderPlanner();
    const list = screen.getByRole('region', { name: 'Planlarım' });
    fireEvent.click(within(list).getByRole('button', { name: 'Plan ekle' }));
    const editor = within(list).getByRole('form', { name: 'Yeni plan' });
    // Default walk is every day: turn all seven off.
    for (const day of ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']) {
      fireEvent.click(within(editor).getByRole('button', { name: day }));
    }
    expect(within(editor).getByRole('alert')).toHaveTextContent('En az bir gün seç.');
    expect(within(editor).getByRole('button', { name: 'Kaydet' })).toBeDisabled();
  });
});
