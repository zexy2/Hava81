import { act, render, screen } from '@testing-library/react';
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

  it('stops presenting stale current wind as a live observation at the provider TTL', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-08-28T15:00:00Z'));
      const expiringWeather: NormalizedWeatherData = {
        ...weather,
        meta: {
          ...weather.meta,
          fetchedAt: new Date('2026-08-28T15:00:00Z'),
          freshForSeconds: 30,
        },
      };

      render(
        <SettingsProvider>
          <EnvironmentRail weather={expiringWeather} onOpenMap={vi.fn()} mapExpanded={false} />
        </SettingsProvider>
      );

      expect(screen.getByText(/GD ·/i)).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_200);
      });

      expect(screen.queryByText(/GD ·/i)).not.toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('Anlık veri güncel değil');
    } finally {
      vi.useRealTimers();
    }
  });

  it('renders sunrise and sunset in the weather location timezone instead of the device timezone', () => {
    render(
      <SettingsProvider>
        <EnvironmentRail weather={weather} onOpenMap={vi.fn()} mapExpanded={false} />
      </SettingsProvider>
    );

    const sunset = screen.getByText('19:30');
    const sunrise = screen.getByText('06:00');
    expect(sunset).toBeInTheDocument();
    expect(sunrise).toBeInTheDocument();
    expect(sunset.closest('time')).toHaveAttribute('datetime', '2026-08-28T16:30:00.000Z');
    expect(sunrise.closest('time')).toHaveAttribute('datetime', '2026-08-28T03:00:00.000Z');
    expect(sunrise.parentElement).toHaveTextContent('Doğuş 06:00 · Gün Uzunluğu · 13 s 30 dk');
    expect(screen.queryByText('16:30')).not.toBeInTheDocument();
    expect(screen.queryByText('03:00')).not.toBeInTheDocument();
  });
});
