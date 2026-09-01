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
  {
    time: new Date('2026-08-29T09:00:00Z'),
    temp: 19,
    apparentTemperature: 19,
    pop: 0,
    windSpeed: 2,
    icon: '01d',
  },
  {
    time: new Date('2026-08-29T15:00:00Z'),
    temp: 29,
    apparentTemperature: 30,
    pop: 0,
    windSpeed: 4,
    icon: '01d',
  },
  {
    time: new Date('2026-08-29T16:00:00Z'),
    temp: 30,
    apparentTemperature: 31,
    pop: 0.1,
    windSpeed: 4,
    icon: '01d',
  },
  {
    time: new Date('2026-08-29T17:00:00Z'),
    temp: 31,
    apparentTemperature: 32,
    pop: 0.1,
    windSpeed: 5,
    icon: '01d',
  },
];

describe('ActivityPlanner time range', () => {
  beforeEach(() => localStorage.clear());

  it('persists a preferred range and makes the displayed activity score explicitly range-based', () => {
    render(
      <SettingsProvider>
        <ActivityPlanner weather={weather} hourly={hourly} />
      </SettingsProvider>
    );

    expect(screen.getAllByText(/12 saatlik uygunluk · /i).length).toBeGreaterThan(0);
    const scoreExplanation = screen.getByText('Skorlar neden farklı?');
    expect(scoreExplanation).toBeInTheDocument();
    fireEvent.click(scoreExplanation);
    expect(
      screen.getByText(/aynı hava saatleri her aktivitenin kendi eşik ve ağırlıklarıyla/i)
    ).toBeVisible();

    fireEvent.change(screen.getByLabelText('Başlangıç'), { target: { value: '18:00' } });
    fireEvent.change(screen.getByLabelText('Bitiş'), { target: { value: '20:00' } });

    expect(screen.getAllByText(/18:00–20:00 uygunluğu · /i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Koşuda 10–22°C/i)).toBeInTheDocument();
    expect(
      screen.getAllByText(/Aktivite ölçütlerinin etkisi: \d+ → \d+ \([+-]?\d+\) puan/i).length
    ).toBeGreaterThan(0);
    expect(localStorage.getItem('hava81-decision-profile-v1')).toContain('18:00');
    expect(localStorage.getItem('hava81-decision-profile-v1')).toContain('20:00');
  });

  it('makes a partially selected activity range explicit instead of looking applied', () => {
    render(
      <SettingsProvider>
        <ActivityPlanner weather={weather} hourly={hourly} />
      </SettingsProvider>
    );

    const start = screen.getByLabelText('Başlangıç');
    const end = screen.getByLabelText('Bitiş');
    fireEvent.change(start, { target: { value: '18:00' } });

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Filtreyi uygulamak için başlangıç ve bitiş saatini birlikte seç.');
    expect(start).toHaveAttribute('aria-describedby', 'activity-window-incomplete');
    expect(end).toHaveAttribute('aria-describedby', 'activity-window-incomplete');
    expect(screen.getAllByText(/12 saatlik uygunluk · /i).length).toBeGreaterThan(0);

    fireEvent.change(end, { target: { value: '20:00' } });

    expect(screen.queryByText(/Filtreyi uygulamak için başlangıç ve bitiş saatini birlikte seç/i)).not.toBeInTheDocument();
    expect(start).not.toHaveAttribute('aria-describedby');
    expect(end).not.toHaveAttribute('aria-describedby');
    expect(screen.getAllByText(/18:00–20:00 uygunluğu · /i).length).toBeGreaterThan(0);
  });

  it('shows comfort criteria and sensitivity shifts in the selected temperature unit', () => {
    localStorage.setItem(
      'user-settings',
      JSON.stringify({
        temperatureUnit: 'imperial',
        windSpeedUnit: 'ms',
        themeMode: 'auto',
        language: 'tr',
      })
    );

    render(
      <SettingsProvider>
        <ActivityPlanner weather={weather} hourly={hourly} />
      </SettingsProvider>
    );

    expect(screen.getByText(/Koşuda 50–72°F/i)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'heat' } });
    expect(screen.getByText('Sıcak uyarıları yaklaşık 5°F daha erken başlar.')).toBeInTheDocument();
    expect(screen.queryByText(/Koşuda 10–22°C/i)).not.toBeInTheDocument();
  });

  it('disables unselected activities when three are already selected instead of replacing one', () => {
    render(
      <SettingsProvider>
        <ActivityPlanner weather={weather} hourly={hourly} />
      </SettingsProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Piknik' }));

    const limitStatus = screen.getByText(/Üç aktivite seçtin/i);
    expect(limitStatus).toBeVisible();
    expect(screen.getByRole('button', { name: 'Motosiklet' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Motosiklet' })).toHaveAttribute(
      'aria-describedby',
      limitStatus.id
    );
    expect(screen.getByRole('button', { name: 'Çamaşır' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Çamaşır' })).toHaveAttribute(
      'aria-describedby',
      limitStatus.id
    );
    expect(screen.getByRole('button', { name: 'Yürüyüş' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Koşu' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Piknik' })).toBeEnabled();
  });

  it('keeps advanced time-range behavior behind an explicit help disclosure', () => {
    render(
      <SettingsProvider>
        <ActivityPlanner weather={weather} hourly={hourly} />
      </SettingsProvider>
    );

    const helpSummary = screen.getByText('Nasıl çalışır?');
    const helpDetails = helpSummary.closest('details');
    expect(helpDetails).not.toBeNull();
    expect(helpDetails).not.toHaveAttribute('open');
    expect(screen.getByText(/Bitiş daha erkense aralık gece yarısını aşar/i)).not.toBeVisible();

    fireEvent.click(helpSummary);
    expect(helpDetails).toHaveAttribute('open');
    expect(screen.getByText(/Bitiş daha erkense aralık gece yarısını aşar/i)).toBeVisible();
  });

  it('keeps primary activity guidance visible while score criteria stay collapsed until requested', () => {
    render(
      <SettingsProvider>
        <ActivityPlanner weather={weather} hourly={hourly} />
      </SettingsProvider>
    );

    const details = screen.getAllByText('Skor detayı').map(summary => summary.closest('details'));
    expect(details).toHaveLength(2);
    expect(details.every(item => item && !item.hasAttribute('open'))).toBe(true);
    expect(screen.getAllByText(/Öne çıkan risk:/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByText('Skor detayı')[0]);
    expect(details[0]).toHaveAttribute('open');
    expect(screen.getAllByText(/Aktivite ölçütlerinin etkisi:/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Yürüyüşte 12–26°C/i)).toBeInTheDocument();
  });

  it('does not call an activity window dry when measurable precipitation exists at 0%', () => {
    const measurableRain: HourlyForecast[] = [15, 16, 17].map(hour => ({
      time: new Date(Date.UTC(2026, 7, 29, hour)),
      temp: 22,
      apparentTemperature: 22,
      pop: 0,
      precipitationMm: 0.4,
      windSpeed: 2,
      icon: '10d',
    }));

    render(
      <SettingsProvider>
        <ActivityPlanner weather={weather} hourly={measurableRain} />
      </SettingsProvider>
    );

    expect(screen.queryByText('Yağış beklenmiyor')).not.toBeInTheDocument();
    expect(screen.getAllByText('Yağış 0,4 mm')).toHaveLength(2);
  });

  it('shows probability and amount together in activity conditions', () => {
    const rainy: HourlyForecast[] = [15, 16, 17].map(hour => ({
      time: new Date(Date.UTC(2026, 7, 29, hour)),
      temp: 22,
      apparentTemperature: 22,
      pop: 0.35,
      precipitationMm: 0.8,
      windSpeed: 2,
      icon: '10d',
    }));

    render(
      <SettingsProvider>
        <ActivityPlanner weather={weather} hourly={rainy} />
      </SettingsProvider>
    );

    expect(screen.getAllByText('Yağış %35 · 0,8 mm')).toHaveLength(2);
  });

  it('shows near-best hours as a range and explains what temperature sensitivity changes', () => {
    const plateau: HourlyForecast[] = [15, 16, 17].map(hour => ({
      time: new Date(Date.UTC(2026, 7, 29, hour)),
      temp: 22,
      apparentTemperature: 22,
      pop: 0,
      windSpeed: 2,
      icon: '01d',
    }));
    render(
      <SettingsProvider>
        <ActivityPlanner weather={weather} hourly={plateau} />
      </SettingsProvider>
    );

    expect(screen.getByText('Standart konfor aralıkları kullanılır.')).toBeInTheDocument();
    expect(screen.getAllByText('En uygun aralık: 18:00–20:00').length).toBeGreaterThan(0);

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'heat' } });
    expect(screen.getByText('Sıcak uyarıları yaklaşık 3°C daha erken başlar.')).toBeInTheDocument();
  });
});
