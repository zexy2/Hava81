import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../../i18n';
import { WeatherDecisionField } from '../../components/hava81/WeatherDecisionField';
import { SettingsProvider } from '../../context';
import type { NormalizedWeatherData } from '../../types';

const weather: NormalizedWeatherData = {
  cityName: 'İstanbul',
  country: 'TR',
  temperature: 26,
  feelsLike: 25,
  tempMin: 26,
  tempMax: 26,
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

describe('WeatherDecisionField daily range', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-29T13:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('uses the daily forecast rather than current-provider temp_min/temp_max', () => {
    render(
      <SettingsProvider>
        <WeatherDecisionField
          weather={weather}
          hourly={[]}
          daily={[
            {
              date: new Date('2026-08-29T12:00:00Z'),
              tempMin: 20,
              tempMax: 32,
              icon: '01d',
              description: 'açık',
              pop: 0,
            },
          ]}
        />
      </SettingsProvider>
    );
    expect(screen.getByText('Bugünün yüksek / düşük')).toBeInTheDocument();
    expect(screen.getByText('32°C / 20°C')).toBeInTheDocument();
    expect(screen.queryByText('26°C / 26°C')).not.toBeInTheDocument();
  });
  it('shows one temperature when the daily high and low are exactly equal', () => {
    render(
      <SettingsProvider>
        <WeatherDecisionField
          weather={weather}
          hourly={[]}
          daily={[
            {
              date: new Date('2026-08-29T12:00:00Z'),
              tempMin: 26,
              tempMax: 26,
              icon: '01d',
              description: 'açık',
              pop: 0,
            },
          ]}
        />
      </SettingsProvider>
    );

    expect(screen.getByText('26°C')).toBeInTheDocument();
    expect(screen.queryByText('26°C / 26°C')).not.toBeInTheDocument();
  });

  it('collapses effectively identical daily high and low values below a tenth of a degree', () => {
    render(
      <SettingsProvider>
        <WeatherDecisionField
          weather={weather}
          hourly={[]}
          daily={[
            {
              date: new Date('2026-08-29T12:00:00Z'),
              tempMin: 26.01,
              tempMax: 26.04,
              icon: '01d',
              description: 'açık',
              pop: 0,
            },
          ]}
        />
      </SettingsProvider>
    );

    expect(screen.getByText('26°C')).toBeInTheDocument();
    expect(screen.queryByText('26,0°C / 26,0°C')).not.toBeInTheDocument();
  });

  it('uses one decimal only when whole-degree rounding would hide a real daily range', () => {
    render(
      <SettingsProvider>
        <WeatherDecisionField
          weather={weather}
          hourly={[]}
          daily={[
            {
              date: new Date('2026-08-29T12:00:00Z'),
              tempMin: 25.6,
              tempMax: 26.4,
              icon: '01d',
              description: 'açık',
              pop: 0,
            },
          ]}
        />
      </SettingsProvider>
    );

    expect(screen.getByText('26,4°C / 25,6°C')).toBeInTheDocument();
    expect(screen.queryByText('26°C / 26°C')).not.toBeInTheDocument();
  });

  it('uses the selected temperature and wind units in planning messages', () => {
    localStorage.setItem(
      'user-settings',
      JSON.stringify({
        temperatureUnit: 'imperial',
        windSpeedUnit: 'kmh',
        themeMode: 'auto',
        language: 'tr',
      })
    );

    render(
      <SettingsProvider>
        <WeatherDecisionField
          weather={{ ...weather, feelsLike: 35, windSpeed: 10 }}
          hourly={[]}
        />
      </SettingsProvider>
    );

    expect(screen.getByText(/Rüzgâr veya hamleler 36 km\/h seviyesine çıkabilir/i)).toBeInTheDocument();
    expect(screen.getByText(/Hissedilen sıcaklık 95°F seviyesine çıkabilir/i)).toBeInTheDocument();
    expect(screen.queryByText(/10(?:[,.]0)? m\/s seviyesine çıkabilir/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/35°C seviyesine çıkabilir/i)).not.toBeInTheDocument();
  });

  it('formats measurable rain amounts with the active locale', () => {
    render(
      <SettingsProvider>
        <WeatherDecisionField
          weather={weather}
          hourly={[
            {
              time: new Date('2026-08-29T14:00:00Z'),
              temp: 24,
              pop: 0.8,
              precipitationMm: 0.8,
              windSpeed: 3,
              icon: '10d',
            },
          ]}
        />
      </SettingsProvider>
    );

    expect(screen.getByText(/saatlik yaklaşık 0,8 mm yağış bekleniyor/i)).toBeInTheDocument();
  });

  it('does not show a contradictory 0% chance when measurable rain amount triggers the decision', () => {
    render(
      <SettingsProvider>
        <WeatherDecisionField
          weather={weather}
          hourly={[
            {
              time: new Date('2026-08-29T14:00:00Z'),
              temp: 24,
              pop: 0,
              precipitationMm: 0.8,
              windSpeed: 3,
              icon: '10d',
            },
          ]}
        />
      </SettingsProvider>
    );

    expect(screen.getByText(/saatlik yaklaşık 0,8 mm yağış bekleniyor; şemsiye iyi fikir/i)).toBeInTheDocument();
    expect(screen.queryByText(/yağış olasılığı %0/i)).not.toBeInTheDocument();
  });

  it('does not claim 0,0 mm when rain probability is high but modeled amount is zero', () => {
    render(
      <SettingsProvider>
        <WeatherDecisionField
          weather={weather}
          hourly={[
            {
              time: new Date('2026-08-29T14:00:00Z'),
              temp: 24,
              pop: 0.8,
              precipitationMm: 0,
              windSpeed: 3,
              icon: '10d',
            },
          ]}
        />
      </SettingsProvider>
    );

    expect(screen.getByText(/yağış olasılığı %80; şemsiye iyi fikir/i)).toBeInTheDocument();
    expect(screen.queryByText(/0,0 mm/i)).not.toBeInTheDocument();
  });

  it('does not claim the near forecast is stable when hourly decision data is unavailable', () => {
    render(
      <SettingsProvider>
        <WeatherDecisionField weather={weather} hourly={[]} />
      </SettingsProvider>
    );

    expect(screen.getByText('Yakın saatler için karar verisi henüz hazır değil.')).toBeInTheDocument();
    expect(screen.queryByText('Yakın tahmin aralığında belirgin bir risk görünmüyor.')).not.toBeInTheDocument();
  });

  it('does not expose the whole decision surface as a live region', () => {
    const { container } = render(
      <SettingsProvider>
        <WeatherDecisionField weather={weather} hourly={[]} />
      </SettingsProvider>
    );

    const section = container.querySelector('.hava81-decision-field');
    expect(section).toHaveAttribute('aria-labelledby');
    expect(section).not.toHaveAttribute('aria-live');
  });

  it('advances freshness text at the next minute boundary without waiting a full minute from mount', async () => {
    vi.setSystemTime(new Date('2026-08-29T13:00:30Z'));
    render(
      <SettingsProvider>
        <WeatherDecisionField
          weather={{
            ...weather,
            meta: {
              ...weather.meta,
              fetchedAt: new Date('2026-08-29T13:00:00Z'),
            },
          }}
          hourly={[]}
        />
      </SettingsProvider>
    );

    expect(screen.getByText('şimdi güncellendi')).toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(31_000);
    });

    expect(screen.getByText('1 dk önce')).toBeInTheDocument();
  });

  it('does not present a far-future fetchedAt timestamp as freshly updated', () => {
    render(
      <SettingsProvider>
        <WeatherDecisionField
          weather={{
            ...weather,
            meta: {
              ...weather.meta,
              fetchedAt: new Date('2026-08-29T13:02:00Z'),
            },
          }}
          hourly={[]}
        />
      </SettingsProvider>
    );

    expect(screen.getByText('Güncellik bilinmiyor')).toBeInTheDocument();
    expect(screen.queryByText('şimdi güncellendi')).not.toBeInTheDocument();
  });

  it("does not label tomorrow's forecast as today when the current-day daily row is missing", () => {
    render(
      <SettingsProvider>
        <WeatherDecisionField
          weather={weather}
          hourly={[]}
          daily={[
            {
              date: new Date('2026-08-30T12:00:00Z'),
              tempMin: 21,
              tempMax: 34,
              icon: '01d',
              description: 'açık',
              pop: 0,
            },
          ]}
        />
      </SettingsProvider>
    );

    const label = screen.getByText('Bugünün yüksek / düşük');
    expect(label.parentElement).toHaveTextContent('—');
    expect(screen.queryByText('34°C / 21°C')).not.toBeInTheDocument();
  });
});
