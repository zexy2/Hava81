import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../i18n';
import { CommutePlanPanel } from '../../components/hava81/CommutePlanPanel';
import { SettingsProvider } from '../../context';
import type { HourlyForecast, NormalizedWeatherData } from '../../types';

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

const hourly: HourlyForecast[] = [
  { time: new Date('2026-08-29T06:00:00Z'), temp: 23, pop: 0.1, windSpeed: 4, icon: '01d' },
  { time: new Date('2026-08-29T09:00:00Z'), temp: 27, pop: 0.15, windSpeed: 5, icon: '01d' },
  { time: new Date('2026-08-29T12:00:00Z'), temp: 28, pop: 0.2, windSpeed: 6, icon: '01d' },
  { time: new Date('2026-08-29T15:00:00Z'), temp: 19, pop: 0.65, windSpeed: 12, icon: '10d' },
  { time: new Date('2026-08-29T18:00:00Z'), temp: 17, pop: 0.7, windSpeed: 13, icon: '10n' },
];

describe('CommutePlanPanel', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-28T16:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('turns saved leave/return times into a practical preparation decision', () => {
    render(
      <SettingsProvider>
        <CommutePlanPanel weather={weather} hourly={hourly} />
      </SettingsProvider>
    );

    fireEvent.change(screen.getByLabelText('Çıkış'), { target: { value: '08:30' } });
    fireEvent.change(screen.getByLabelText('Dönüş'), { target: { value: '18:00' } });

    const verdict = screen.getByRole('status');
    expect(verdict).toHaveAttribute('aria-live', 'polite');
    expect(verdict).toHaveAttribute('aria-atomic', 'true');
    expect(verdict).toHaveTextContent('Şemsiyeyi al');
    expect(screen.getByText('Şemsiyeyi al')).toBeInTheDocument();
    expect(screen.getByText(/Planlanan pencere:/)).toHaveTextContent('Cmt 08:30 → Cmt 18:00');
    expect(screen.getByText(/Dönüşte yağmur riski/i)).toBeInTheDocument();
    const windows = screen.getByRole('list', { name: 'Çıkış ve dönüş hava pencereleri' });
    expect(windows).toBeInTheDocument();
    expect(windows).toHaveTextContent(/\d+\/100 · (Çok uygun|Uygun|Dikkat|Zorlayıcı)/);
    expect(localStorage.getItem('hava81-decision-profile-v1')).toContain('08:30');
    expect(localStorage.getItem('hava81-decision-profile-v1')).toContain('18:00');
  });

  it('shows measurable rain amount instead of saying precipitation is not expected at 0%', () => {
    const measurableRain: HourlyForecast[] = [
      {
        time: new Date('2026-08-29T09:00:00Z'),
        temp: 22,
        pop: 0,
        precipitationMm: 0.4,
        windSpeed: 3,
        icon: '10d',
      },
      {
        time: new Date('2026-08-29T12:00:00Z'),
        temp: 22,
        pop: 0,
        precipitationMm: 0.4,
        windSpeed: 3,
        icon: '10d',
      },
    ];

    render(
      <SettingsProvider>
        <CommutePlanPanel weather={weather} hourly={measurableRain} />
      </SettingsProvider>
    );

    fireEvent.change(screen.getByLabelText('Çıkış'), { target: { value: '12:00' } });
    fireEvent.change(screen.getByLabelText('Dönüş'), { target: { value: '15:00' } });

    expect(screen.queryByText('Beklenmiyor')).not.toBeInTheDocument();
    expect(screen.getAllByText('0,4 mm')).toHaveLength(2);
    expect(screen.getByRole('status')).toHaveTextContent('Şemsiye yanında olsun');
  });

  it('shows precipitation probability and amount together in commute windows', () => {
    const rainy: HourlyForecast[] = [
      {
        time: new Date('2026-08-29T09:00:00Z'),
        temp: 22,
        pop: 0.35,
        precipitationMm: 0.8,
        windSpeed: 3,
        icon: '10d',
      },
      {
        time: new Date('2026-08-29T12:00:00Z'),
        temp: 22,
        pop: 0.35,
        precipitationMm: 0.8,
        windSpeed: 3,
        icon: '10d',
      },
    ];

    render(
      <SettingsProvider>
        <CommutePlanPanel weather={weather} hourly={rainy} />
      </SettingsProvider>
    );

    fireEvent.change(screen.getByLabelText('Çıkış'), { target: { value: '12:00' } });
    fireEvent.change(screen.getByLabelText('Dönüş'), { target: { value: '15:00' } });

    expect(screen.getAllByText('%35 · 0,8 mm')).toHaveLength(2);
  });

  it('makes heat the preparation headline when rain is absent but the selected windows are hot', () => {
    const hotHourly: HourlyForecast[] = [
      {
        time: new Date('2026-08-29T09:00:00Z'),
        temp: 31,
        apparentTemperature: 33,
        pop: 0,
        windSpeed: 4,
        icon: '01d',
      },
      {
        time: new Date('2026-08-29T12:00:00Z'),
        temp: 33,
        apparentTemperature: 35,
        pop: 0,
        windSpeed: 5,
        icon: '01d',
      },
    ];
    render(
      <SettingsProvider>
        <CommutePlanPanel weather={weather} hourly={hotHourly} />
      </SettingsProvider>
    );

    fireEvent.change(screen.getByLabelText('Çıkış'), { target: { value: '12:00' } });
    fireEvent.change(screen.getByLabelText('Dönüş'), { target: { value: '15:00' } });

    const verdict = screen.getByRole('status');
    expect(verdict).toHaveTextContent(/Hissedilen 35°C; su ve gölge planla/i);
    expect(verdict).not.toHaveTextContent(/Hava kalitesi AQI/i);
    expect(verdict).not.toHaveTextContent('Şemsiye gerekmiyor');
  });

  it('makes a partial commute time selection explicit and associates it with both inputs', () => {
    render(
      <SettingsProvider>
        <CommutePlanPanel weather={weather} hourly={hourly} />
      </SettingsProvider>
    );

    const outbound = screen.getByLabelText('Çıkış');
    const returnInput = screen.getByLabelText('Dönüş');
    fireEvent.change(outbound, { target: { value: '08:30' } });

    const incomplete = screen.getByRole('status');
    expect(incomplete).toHaveTextContent(/çıkış ve dönüş saatini birlikte seç/i);
    expect(outbound).toHaveAttribute('aria-describedby', incomplete.id);
    expect(returnInput).toHaveAttribute('aria-describedby', incomplete.id);

    fireEvent.change(returnInput, { target: { value: '18:00' } });

    expect(screen.queryByText(/çıkış ve dönüş saatini birlikte seç/i)).not.toBeInTheDocument();
    expect(outbound).not.toHaveAttribute('aria-describedby');
    expect(returnInput).not.toHaveAttribute('aria-describedby');
  });

  it('explains when both saved times are outside available forecast coverage', () => {
    render(
      <SettingsProvider>
        <CommutePlanPanel weather={weather} hourly={[]} />
      </SettingsProvider>
    );

    fireEvent.change(screen.getByLabelText('Çıkış'), { target: { value: '08:30' } });
    fireEvent.change(screen.getByLabelText('Dönüş'), { target: { value: '18:00' } });

    expect(screen.getByText(/yeterince yakın tahmin henüz yok/i)).toBeInTheDocument();
    expect(screen.queryByText(/İki saati de seçtiğinde/i)).not.toBeInTheDocument();
  });

  it('explains a meaningful Hava81 score improvement even when no special gear is needed', () => {
    const improving: HourlyForecast[] = [
      {
        time: new Date('2026-08-29T09:00:00Z'),
        temp: 22,
        apparentTemperature: 22,
        pop: 0,
        windSpeed: 3,
        visibility: 300,
        icon: '50d',
      },
      {
        time: new Date('2026-08-29T12:00:00Z'),
        temp: 22,
        apparentTemperature: 22,
        pop: 0,
        windSpeed: 3,
        visibility: 10000,
        icon: '01d',
      },
    ];
    render(
      <SettingsProvider>
        <CommutePlanPanel weather={weather} hourly={improving} />
      </SettingsProvider>
    );

    fireEvent.change(screen.getByLabelText('Çıkış'), { target: { value: '12:00' } });
    fireEvent.change(screen.getByLabelText('Dönüş'), { target: { value: '15:00' } });

    expect(screen.getByRole('status')).toHaveTextContent(
      /Dönüşün Hava81 puanı çıkıştan yaklaşık \d+ puan daha yüksek/i
    );
    expect(screen.getByRole('status')).toHaveTextContent(/hava açısından daha rahat görünüyor/i);
  });
});
