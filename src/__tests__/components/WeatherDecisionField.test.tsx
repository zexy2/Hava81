import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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
    expect(screen.getByText("Bugünün yüksek / düşük")).toBeInTheDocument();
    expect(screen.getByText('32°C / 20°C')).toBeInTheDocument();
    expect(screen.queryByText('26°C / 26°C')).not.toBeInTheDocument();
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

});
