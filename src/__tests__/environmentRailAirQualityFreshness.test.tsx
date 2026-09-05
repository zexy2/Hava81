import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '../i18n';
import { EnvironmentRail } from '../components/hava81/EnvironmentRail';
import { SettingsProvider } from '../context';
import type { AirQuality, NormalizedWeatherData } from '../types';

const weather: NormalizedWeatherData = {
  cityName: 'İstanbul',
  country: 'TR',
  temperature: 24,
  feelsLike: 24,
  tempMin: 21,
  tempMax: 26,
  humidity: 55,
  pressure: 1012,
  visibility: 10000,
  windSpeed: 3,
  windDirection: 90,
  description: 'açık',
  icon: '01d',
  sunrise: new Date('2026-09-05T03:30:00Z'),
  sunset: new Date('2026-09-05T16:30:00Z'),
  timestamp: new Date('2026-09-05T02:00:00Z'),
  coordinates: { lat: 41.01, lon: 28.97 },
  clouds: 5,
  meta: {
    provider: 'OpenWeather',
    fetchedAt: new Date('2026-09-05T02:00:00Z'),
    timezoneOffsetSeconds: 10800,
    freshForSeconds: 300,
  },
};

const airQuality: AirQuality = {
  aqi: 2,
  aqiLabel: 'Fair',
  pm25: 11.2,
  pm10: 18,
  o3: 52,
  meta: {
    provider: 'OpenWeather',
    fetchedAt: new Date('2026-09-05T02:00:00Z'),
    freshForSeconds: 30,
  },
};

afterEach(() => {
  vi.useRealTimers();
});

describe('EnvironmentRail air-quality freshness', () => {
  it('removes AQI and PM2.5 once provider evidence reaches its TTL', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-05T02:00:00Z'));

    render(
      <SettingsProvider>
        <EnvironmentRail
          weather={weather}
          airQuality={airQuality}
          onOpenMap={vi.fn()}
          mapExpanded={false}
        />
      </SettingsProvider>
    );

    expect(screen.getByText('2 / 5')).toBeInTheDocument();
    expect(screen.getByText(/PM2\.5 11,2 µg\/m³/i)).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_200);
    });

    expect(screen.queryByText('2 / 5')).not.toBeInTheDocument();
    expect(screen.queryByText(/PM2\.5 11,2 µg\/m³/i)).not.toBeInTheDocument();
  });
});
