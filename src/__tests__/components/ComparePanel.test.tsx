import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComparePanel } from '../../components/hava81/ComparePanel';
import { SettingsProvider } from '../../context';
import '../../i18n';

const api = vi.hoisted(() => ({
  getCurrentWeather: vi.fn(),
  getForecast: vi.fn(),
  getHourlyForecast: vi.fn(),
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
    api.getHourlyForecast.mockReset().mockResolvedValue({
      hourly: forecast.hourly.map((item, index) => ({
        ...item,
        time: new Date(item.time.getTime() + index * 60 * 60 * 1000),
        apparentTemperature: item.temp,
        humidity: 55,
        precipitationMm: 0,
        windGust: (item.windSpeed ?? 0) + 2,
        uvIndex: 3,
        visibility: 20000,
        weatherCode: 0,
      })),
      meta: { ...forecast.meta, provider: 'Open-Meteo', intervalHours: 1 },
    });
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
    expect(screen.getByRole('heading', { name: /şehir karşılaştırması/i })).toHaveFocus();
  });

  it('shows measurable near-term precipitation even when probability is 0%', async () => {
    api.getHourlyForecast.mockResolvedValue({
      hourly: [{
        time: new Date('2026-08-28T09:00:00Z'),
        temp: 24,
        icon: '10d',
        pop: 0,
        windSpeed: 3,
        precipitationMm: 0.4,
      }],
      meta: { ...forecast.meta, provider: 'Open-Meteo', intervalHours: 1 },
    });

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
    expect(screen.getAllByText('0,4 mm')).toHaveLength(2);
    expect(screen.queryByText('%0 · 0,4 mm')).not.toBeInTheDocument();
    expect(screen.getAllByText('Yağış')).toHaveLength(2);
  });


  it('shows a dry label instead of 0% when no precipitation amount is modeled', async () => {
    api.getHourlyForecast.mockResolvedValue({
      hourly: [{
        time: new Date('2026-08-28T09:00:00Z'),
        temp: 24,
        icon: '01d',
        pop: 0,
        windSpeed: 3,
        precipitationMm: 0,
      }],
      meta: { ...forecast.meta, provider: 'Open-Meteo', intervalHours: 1 },
    });

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
    expect(screen.getAllByText('Beklenmiyor')).toHaveLength(2);
    expect(screen.queryByText('%0')).not.toBeInTheDocument();
  });

  it('keeps precipitation probability and amount tied to the same forecast hour', async () => {
    api.getHourlyForecast.mockResolvedValue({
      hourly: [
        {
          time: new Date('2026-08-28T09:00:00Z'),
          temp: 24,
          icon: '10d',
          pop: 0.8,
          windSpeed: 3,
          precipitationMm: 0,
        },
        {
          time: new Date('2026-08-28T10:00:00Z'),
          temp: 24,
          icon: '10d',
          pop: 0.2,
          windSpeed: 3,
          precipitationMm: 6,
        },
      ],
      meta: { ...forecast.meta, provider: 'Open-Meteo', intervalHours: 1 },
    });

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
    expect(screen.getAllByText('%20 · 6,0 mm')).toHaveLength(2);
    expect(screen.queryByText('%80 · 6,0 mm')).not.toBeInTheDocument();
  });

  it('makes the three-city comparison limit explicit when more favorites are saved', async () => {
    render(
      <SettingsProvider>
        <ComparePanel
          language="tr"
          cities={[
            { name: 'İstanbul', lat: 41, lon: 29 },
            { name: 'Ankara', lat: 39.93, lon: 32.86 },
            { name: 'İzmir', lat: 38, lon: 27 },
            { name: 'Antalya', lat: 36.89, lon: 30.7 },
          ]}
        />
      </SettingsProvider>
    );

    expect(
      screen.getByText(/ilk 3 şehir karşılaştırılıyor: İstanbul, Ankara, İzmir/i)
    ).toBeVisible();
    expect(await screen.findByRole('heading', { name: 'İstanbul' })).toBeVisible();
    expect(await screen.findByRole('heading', { name: 'Ankara' })).toBeVisible();
    expect(await screen.findByRole('heading', { name: 'İzmir' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Antalya' })).not.toBeInTheDocument();
    expect(api.getCurrentWeather).toHaveBeenCalledTimes(3);
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
    expect(api.getHourlyForecast).toHaveBeenCalledTimes(2);
    expect(api.getAirQuality).toHaveBeenCalledTimes(2);
  });


  it('clears stale city cards while a changed comparison is loading', async () => {
    const { rerender } = render(
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

    api.getCurrentWeather.mockImplementationOnce(() => new Promise(() => {}));

    rerender(
      <SettingsProvider>
        <ComparePanel
          language="en"
          cities={[
            { name: 'İstanbul', lat: 41, lon: 29 },
            { name: 'İzmir', lat: 38, lon: 27 },
          ]}
        />
      </SettingsProvider>
    );

    expect(screen.queryByRole('heading', { name: 'İstanbul' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'İzmir' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Yükleniyor...');

  });

  it('explains partial failures while keeping successful city results usable', async () => {
    api.getCurrentWeather.mockImplementation(({ city }: { city: string }) =>
      city === 'İzmir'
        ? Promise.reject(new Error('SECRET_PROVIDER_FAILURE'))
        : Promise.resolve(makeWeather(city, 24))
    );

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
    expect(screen.getByText(/Bazı şehirlerin verisi güncellenemedi/i)).toBeVisible();
    expect(screen.queryByText(/SECRET_PROVIDER_FAILURE/)).not.toBeInTheDocument();
  });

  it('shows a bounded unavailable state when every comparison city fails', async () => {
    api.getCurrentWeather.mockRejectedValue(new Error('SECRET_TOTAL_FAILURE'));

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

    expect(await screen.findByText('Şehir karşılaştırması şu anda güncellenemedi.')).toBeVisible();
    expect(screen.queryByText(/SECRET_TOTAL_FAILURE/)).not.toBeInTheDocument();
  });
});
