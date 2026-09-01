import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '../../i18n';
import { EnvironmentRail } from '../../components/hava81/EnvironmentRail';
import { SettingsProvider } from '../../context';
import type { NormalizedWeatherData } from '../../types';

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
  timestamp: new Date('2026-08-28T15:00:00Z'),
  coordinates: { lat: 41.01, lon: 28.97 },
  clouds: 5,
  meta: { provider: 'OpenWeather', fetchedAt: new Date(), timezoneOffsetSeconds: 10800 },
};

describe('EnvironmentRail', () => {
  it('associates the map disclosure button with the map region', () => {
    render(
      <SettingsProvider>
        <EnvironmentRail weather={weather} onOpenMap={vi.fn()} mapExpanded={false} />
      </SettingsProvider>
    );

    const mapButton = screen.getByRole('button', { name: /haritayı göster/i });
    expect(mapButton).toHaveAttribute('aria-controls', 'weather-map-region');
    expect(mapButton).toHaveAttribute('aria-expanded', 'false');
    expect(mapButton).not.toHaveAttribute('aria-pressed');
  });

  it('renders sunrise and sunset in the weather location timezone instead of the device timezone', () => {
    render(
      <SettingsProvider>
        <EnvironmentRail weather={weather} onOpenMap={vi.fn()} mapExpanded={false} />
      </SettingsProvider>
    );

    expect(screen.getByText('19:30')).toBeInTheDocument();
    expect(screen.getByText(/Doğuş 06:00 · Gün Uzunluğu · 13 s 30 dk/i)).toBeInTheDocument();
    expect(screen.queryByText('16:30')).not.toBeInTheDocument();
    expect(screen.queryByText(/Doğuş 03:00/i)).not.toBeInTheDocument();
  });
});
