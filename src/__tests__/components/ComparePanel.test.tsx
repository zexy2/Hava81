import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComparePanel } from '../../components/hava81/ComparePanel';
import { SettingsProvider } from '../../context';
import '../../i18n';

const api = vi.hoisted(() => ({
  getCurrentWeather: vi.fn(),
  getForecast: vi.fn(),
  getAirQuality: vi.fn(),
}));
vi.mock('../../api/weatherService', () => ({ weatherService: api }));

const makeWeather = (cityName: string, temperature: number) => ({
  cityName,
  country: 'TR',
  temperature,
  feelsLike: temperature,
  tempMin: temperature - 2,
  tempMax: temperature + 2,
  humidity: 55,
  pressure: 1012,
  visibility: 10000,
  windSpeed: 3,
  windDirection: 180,
  description: 'açık',
  icon: '01d' as const,
  sunrise: new Date(),
  sunset: new Date(),
  timestamp: new Date('2026-08-28T09:00:00Z'),
  coordinates: cityName === 'İstanbul' ? { lat: 41, lon: 29 } : { lat: 38, lon: 27 },
  clouds: 0,
  meta: { provider: 'OpenWeather', fetchedAt: new Date(), timezoneOffsetSeconds: 10800 },
});
const forecast = {
  daily: [],
  hourly: [
    {
      time: new Date('2026-08-28T09:00:00Z'),
      temp: 24,
      icon: '01d' as const,
      pop: 0.05,
      windSpeed: 3,
    },
    {
      time: new Date('2026-08-28T12:00:00Z'),
      temp: 27,
      icon: '01d' as const,
      pop: 0.1,
      windSpeed: 4,
    },
  ],
  meta: {
    provider: 'OpenWeather',
    fetchedAt: new Date(),
    timezoneOffsetSeconds: 10800,
    intervalHours: 3,
  },
};

describe('ComparePanel', () => {
  beforeEach(() => {
    localStorage.clear();
    api.getCurrentWeather
      .mockReset()
      .mockImplementation(({ city }: { city: string }) =>
        Promise.resolve(makeWeather(city, city === 'İstanbul' ? 24 : 28))
      );
    api.getForecast.mockReset().mockResolvedValue(forecast);
    api.getAirQuality
      .mockReset()
      .mockResolvedValue({ aqi: 2, aqiLabel: 'Orta', pm25: 8, pm10: 12, o3: 30 });
  });

  it('explains that two favorites are required', () => {
    render(
      <SettingsProvider>
        <ComparePanel cities={[{ name: 'İstanbul', lat: 41, lon: 29 }]} language="tr" />
      </SettingsProvider>
    );
    expect(screen.getByText(/en az iki şehri/i)).toBeVisible();
  });

  it('loads decision metrics and a weather-criteria winner', async () => {
    render(
      <SettingsProvider>
        <ComparePanel
          language="tr"
          cities={[
            { name: 'İstanbul', lat: 41, lon: 29 },
            { name: 'İzmir', lat: 38, lon: 27 },
          ]}
        />
      </SettingsProvider>
    );
    expect(await screen.findByRole('heading', { name: 'İstanbul' })).toBeVisible();
    expect(await screen.findByRole('heading', { name: 'İzmir' })).toBeVisible();
    const cityList = screen.getByRole('list', { name: /şehir karşılaştırması/i });
    expect(cityList).toBeVisible();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(await screen.findByText(/bu hava kriterlerinde öne çıkan/i)).toBeVisible();
    expect(api.getForecast).toHaveBeenCalledTimes(2);
    expect(api.getAirQuality).toHaveBeenCalledTimes(2);
  });
});
