import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import '../../i18n';
import { ActivityPlanner } from '../../components/hava81/ActivityPlanner';
import { SettingsProvider } from '../../context';
import type { HourlyForecast, NormalizedWeatherData } from '../../types';

const weather: NormalizedWeatherData = {
  cityName: 'İstanbul',
  country: 'TR',
  temperature: 24,
  feelsLike: 24,
  tempMin: 20,
  tempMax: 30,
  humidity: 55,
  pressure: 1012,
  visibility: 10000,
  windSpeed: 3,
  windDirection: 180,
  description: 'açık',
  icon: '01d',
  sunrise: new Date('2026-08-29T03:00:00Z'),
  sunset: new Date('2026-08-29T16:00:00Z'),
  timestamp: new Date('2026-08-29T09:00:00Z'),
  coordinates: { lat: 41.01, lon: 28.97 },
  clouds: 0,
  meta: { provider: 'OpenWeather', fetchedAt: new Date(), timezoneOffsetSeconds: 10800 },
};

const hourly: HourlyForecast[] = [
  { time: new Date('2026-08-29T09:00:00Z'), temp: 19, apparentTemperature: 19, pop: 0, windSpeed: 2, icon: '01d' },
  { time: new Date('2026-08-29T15:00:00Z'), temp: 29, apparentTemperature: 30, pop: 0, windSpeed: 4, icon: '01d' },
  { time: new Date('2026-08-29T16:00:00Z'), temp: 30, apparentTemperature: 31, pop: 0.1, windSpeed: 4, icon: '01d' },
  { time: new Date('2026-08-29T17:00:00Z'), temp: 31, apparentTemperature: 32, pop: 0.1, windSpeed: 5, icon: '01d' },
];

describe('ActivityPlanner time range', () => {
  beforeEach(() => localStorage.clear());

  it('persists a preferred range and makes the displayed activity score explicitly range-based', () => {
    render(
      <SettingsProvider>
        <ActivityPlanner weather={weather} hourly={hourly} />
      </SettingsProvider>
    );

    expect(screen.getAllByText('12 saatlik uygunluk').length).toBeGreaterThan(0);
    const scoreExplanation = screen.getByText('Skorlar neden farklı?');
    expect(scoreExplanation).toBeInTheDocument();
    fireEvent.click(scoreExplanation);
    expect(
      screen.getByText(/aynı hava saatleri her aktivitenin kendi eşik ve ağırlıklarıyla/i)
    ).toBeVisible();

    fireEvent.change(screen.getByLabelText('Başlangıç'), { target: { value: '18:00' } });
    fireEvent.change(screen.getByLabelText('Bitiş'), { target: { value: '20:00' } });

    expect(screen.getAllByText('18:00–20:00 uygunluğu').length).toBeGreaterThan(0);
    expect(screen.getByText(/Koşuda 10–22°C/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Aktivite ölçütlerinin etkisi: [+-]?\d+ puan/i).length).toBeGreaterThan(0);
    expect(localStorage.getItem('hava81-decision-profile-v1')).toContain('18:00');
    expect(localStorage.getItem('hava81-decision-profile-v1')).toContain('20:00');
  });
});
