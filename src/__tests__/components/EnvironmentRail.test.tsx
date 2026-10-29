import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import '../../i18n';
import { EnvironmentRail } from '../../components/hava81/EnvironmentRail';
import { SettingsProvider } from '../../context';
import type { AirQuality, NormalizedWeatherData } from '../../types';

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
  it('labels the wind direction instead of printing raw degrees', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-08-28T15:00:00Z'));
      render(
        <SettingsProvider>
          <EnvironmentRail
            weather={{
              ...weather,
              windDirection: 19,
              meta: { ...weather.meta, fetchedAt: new Date() },
            }}
            onOpenMap={vi.fn()}
            mapExpanded={false}
          />
        </SettingsProvider>
      );
      expect(screen.getByText('Kuzeyden · 19°')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows the sunset during daylight', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-08-28T15:00:00Z'));
      render(
        <SettingsProvider>
          <EnvironmentRail weather={weather} onOpenMap={vi.fn()} mapExpanded={false} />
        </SettingsProvider>
      );
      expect(screen.getByText('Batış')).toBeInTheDocument();
      expect(screen.queryByText('Gün doğumu')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('switches to the next sunrise after sunset', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-08-28T18:00:00Z')); // 21:00 local, after sunset
      render(
        <SettingsProvider>
          <EnvironmentRail weather={weather} onOpenMap={vi.fn()} mapExpanded={false} />
        </SettingsProvider>
      );
      expect(screen.getByText('Gün doğumu')).toBeInTheDocument();
      const value = screen.getByText('Gün doğumu').nextElementSibling;
      expect(value?.querySelector('time')).toHaveAttribute('datetime', '2026-08-29T03:00:00.000Z');
      expect(value).toHaveTextContent('06:00');
      expect(value?.nextElementSibling).toHaveTextContent('Batış 19:30');
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows today's sunrise before dawn", () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      vi.setSystemTime(new Date('2026-08-28T01:00:00Z')); // 04:00 local
      render(
        <SettingsProvider>
          <EnvironmentRail weather={weather} onOpenMap={vi.fn()} mapExpanded={false} />
        </SettingsProvider>
      );
      const value = screen.getByText('Gün doğumu').nextElementSibling;
      expect(value?.querySelector('time')).toHaveAttribute('datetime', '2026-08-28T03:00:00.000Z');
    } finally {
      vi.useRealTimers();
    }
  });

  it('references the map region only while the map disclosure is expanded', () => {
    const { rerender } = render(
      <SettingsProvider>
        <EnvironmentRail weather={weather} onOpenMap={vi.fn()} mapExpanded={false} />
      </SettingsProvider>
    );

    const closedMapButton = screen.getByRole('button', { name: /haritayı göster/i });
    expect(closedMapButton).not.toHaveAttribute('aria-controls');
    expect(closedMapButton).toHaveAttribute('aria-expanded', 'false');
    expect(closedMapButton).not.toHaveAttribute('aria-pressed');

    rerender(
      <SettingsProvider>
        <EnvironmentRail weather={weather} onOpenMap={vi.fn()} mapExpanded />
      </SettingsProvider>
    );

    const openMapButton = screen.getByRole('button', { name: /haritayı gizle/i });
    expect(openMapButton).toHaveAttribute('aria-controls', 'weather-map-region');
    expect(openMapButton).toHaveAttribute('aria-expanded', 'true');
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

      expect(screen.getByText(/dan · \d+°/i)).toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(30_200);
      });

      expect(screen.queryByText(/dan · \d+°/i)).not.toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent('Anlık veri güncel değil');
    } finally {
      vi.useRealTimers();
    }
  });

  it('discloses the provider observation time separately from the fetch time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-28T15:00:00Z'));
    const airQuality: AirQuality = {
      aqi: 2,
      aqiLabel: 'Fair',
      pm25: 11.2,
      pm10: 18,
      o3: 52,
      meta: {
        provider: 'OpenWeather',
        fetchedAt: new Date('2026-08-28T15:00:00Z'),
        observedAt: new Date('2026-08-28T14:50:00Z'),
        freshForSeconds: 300,
      },
    };

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

    const observationTime = screen.getByText('Gözlem 17:50');
    expect(observationTime.tagName).toBe('TIME');
    expect(observationTime).toHaveAttribute('datetime', '2026-08-28T14:50:00.000Z');
  });

  it('renders sunrise and sunset in the weather location timezone instead of the device timezone', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-08-28T15:00:00Z'));
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
    } finally {
      vi.useRealTimers();
    }
  });

  it("expires yesterday's daylight times at local midnight while current weather remains fresh", async () => {
    vi.useFakeTimers();
    try {
      const fetchedAt = new Date('2026-08-28T20:59:30Z');
      vi.setSystemTime(fetchedAt);
      const weatherBeforeMidnight: NormalizedWeatherData = {
        ...weather,
        meta: { ...weather.meta, fetchedAt, freshForSeconds: 3600 },
      };

      render(
        <SettingsProvider>
          <EnvironmentRail
            weather={weatherBeforeMidnight}
            onOpenMap={vi.fn()}
            mapExpanded={false}
          />
        </SettingsProvider>
      );

      expect(screen.getByText('19:30')).toBeInTheDocument();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(31_000);
      });

      expect(screen.queryByText('19:30')).not.toBeInTheDocument();
      expect(screen.queryByText('06:00')).not.toBeInTheDocument();
      expect(screen.getByRole('status')).toHaveTextContent(
        'Gün doğuşu ve batış bilgisi güncel değil'
      );
    } finally {
      vi.useRealTimers();
    }
  });
});
