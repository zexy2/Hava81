import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComparePanel } from '../../components/hava81/ComparePanel';
import { SettingsProvider } from '../../context';
import '../../i18n';

const getCurrentWeather = vi.hoisted(() => vi.fn());
vi.mock('../../api/weatherService', () => ({ weatherService: { getCurrentWeather } }));

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
  timestamp: new Date(),
  coordinates: { lat: 40, lon: 30 },
  clouds: 0,
  meta: { provider: 'OpenWeather', fetchedAt: new Date(), timezoneOffsetSeconds: 10800 },
});

describe('ComparePanel', () => {
  beforeEach(() => {
    getCurrentWeather
      .mockReset()
      .mockImplementation(({ city }: { city: string }) =>
        Promise.resolve(makeWeather(city, city === 'İstanbul' ? 24 : 28))
      );
  });

  it('explains that two favorites are required', () => {
    render(
      <SettingsProvider>
        <ComparePanel cities={[{ name: 'İstanbul', lat: 41, lon: 29 }]} language="tr" />
      </SettingsProvider>
    );
    expect(screen.getByText(/en az iki şehri/i)).toBeVisible();
  });

  it('loads and renders up to three favorite cities', async () => {
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
    expect(getCurrentWeather).toHaveBeenCalledTimes(2);
  });
});
