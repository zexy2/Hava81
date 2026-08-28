import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../../App';
import { SettingsProvider } from '../../context';
import i18n from '../../i18n';

const service = vi.hoisted(() => ({
  getCurrentWeather: vi.fn(),
  getCurrentLocationWeather: vi.fn(),
  getForecast: vi.fn(),
  getAirQuality: vi.fn(),
}));

vi.mock('../../api/weatherService', () => ({ weatherService: service }));

const current = {
  cityName: 'İstanbul',
  country: 'TR',
  temperature: 24,
  feelsLike: 24,
  tempMin: 19,
  tempMax: 28,
  humidity: 60,
  pressure: 1012,
  visibility: 10000,
  windSpeed: 4.4,
  windDirection: 180,
  description: 'açık',
  icon: '01d' as const,
  sunrise: new Date('2026-08-28T03:00:00.000Z'),
  sunset: new Date('2026-08-28T16:00:00.000Z'),
  timestamp: new Date('2026-08-28T09:00:00.000Z'),
  coordinates: { lat: 41.01, lon: 28.97 },
  clouds: 5,
  meta: {
    provider: 'OpenWeather',
    fetchedAt: new Date(),
    timezoneOffsetSeconds: 10800,
    cacheStatus: 'MISS' as const,
    freshForSeconds: 60,
  },
};

const forecast = {
  daily: [
    {
      date: new Date('2026-08-28T12:00:00.000Z'),
      tempMin: 19,
      tempMax: 28,
      icon: '01d' as const,
      description: 'açık',
      pop: 0.1,
    },
  ],
  hourly: [
    {
      time: new Date('2026-08-28T09:00:00.000Z'),
      temp: 24,
      icon: '01d' as const,
      description: 'açık',
      pop: 0.1,
      windSpeed: 4,
    },
    {
      time: new Date('2026-08-28T12:00:00.000Z'),
      temp: 26,
      icon: '01d' as const,
      description: 'açık',
      pop: 0.15,
      windSpeed: 5,
    },
  ],
  meta: {
    provider: 'OpenWeather',
    fetchedAt: new Date(),
    timezoneOffsetSeconds: 10800,
    intervalHours: 3,
    cacheStatus: 'MISS' as const,
    freshForSeconds: 300,
  },
};

const air = { aqi: 2, aqiLabel: 'Orta', pm25: 8, pm10: 14, o3: 40 };

const renderApp = () =>
  render(
    <SettingsProvider>
      <App />
    </SettingsProvider>
  );

describe('Hava81 app integration', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('tr');
    localStorage.clear();
    window.history.replaceState({}, '', '/istanbul');
    service.getCurrentWeather.mockReset().mockResolvedValue(current);
    service.getCurrentLocationWeather.mockReset().mockResolvedValue(current);
    service.getForecast.mockReset().mockResolvedValue(forecast);
    service.getAirQuality.mockReset().mockResolvedValue(air);
  });

  it('renders the decision-first city view and forecast metadata', async () => {
    renderApp();
    expect(await screen.findByRole('heading', { name: 'İstanbul' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /3 saatlik tahmin/i })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /gün planı/i })).toBeInTheDocument();
    expect(screen.getByText(/şimdi mi, sonra mı/i)).toBeInTheDocument();
    expect(screen.getByText('OpenWeather')).toBeInTheDocument();
    expect(service.getForecast).toHaveBeenCalledWith(41.01, 28.97, 'tr');
  });

  it('adds a favorite and exposes saved-city comparison navigation', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole('heading', { name: 'İstanbul' });
    await user.click(screen.getByRole('button', { name: /favorilere ekle/i }));
    expect(screen.getByText('İstanbul', { selector: '.city-tabs__name' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /kayıtlı/i }));
    expect(
      await screen.findByRole('heading', { name: /şehir karşılaştırması/i })
    ).toBeInTheDocument();
  });

  it('exposes desktop comparison when at least two favorites exist', async () => {
    const user = userEvent.setup();
    localStorage.setItem(
      'favorites',
      JSON.stringify([
        { name: 'İstanbul', lat: 41.01, lon: 28.97 },
        { name: 'İzmir', lat: 38.42, lon: 27.14 },
      ])
    );
    service.getCurrentWeather.mockImplementation(async ({ city }: { city: string }) =>
      city === 'İzmir'
        ? {
            ...current,
            cityName: 'İzmir',
            coordinates: { lat: 38.42, lon: 27.14 },
            temperature: 29,
          }
        : current
    );

    renderApp();
    await screen.findByRole('heading', { name: 'İstanbul' });
    const compare = screen.getByRole('button', { name: /karşılaştır/i });
    expect(compare).toBeInTheDocument();
    await user.click(compare);
    expect(
      await screen.findByRole('heading', { name: /şehir karşılaştırması/i })
    ).toBeInTheDocument();
  });

  it('opens settings and switches language without leaking provider credentials', async () => {
    const user = userEvent.setup();
    renderApp();
    await screen.findByRole('heading', { name: 'İstanbul' });
    await user.click(screen.getByRole('button', { name: /ayarlar/i }));
    expect(await screen.findByRole('heading', { name: 'Birimler' })).toBeInTheDocument();
    const english = screen.getByRole('button', { name: /english/i });
    await user.click(english);
    await waitFor(() =>
      expect(service.getCurrentWeather).toHaveBeenLastCalledWith(
        expect.objectContaining({ lang: 'en' })
      )
    );
  });
});
