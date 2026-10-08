import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DecisionGlance } from '../../components/hava81/DecisionGlance';
import type { NormalizedWeatherData } from '../../types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'tr' },
  }),
}));

const sampleWeather: NormalizedWeatherData = {
  cityName: 'İzmir',
  country: 'TR',
  temperature: 25,
  feelsLike: 26,
  tempMin: 18,
  tempMax: 28,
  humidity: 55,
  pressure: 1013,
  visibility: 10000,
  windSpeed: 4,
  windDirection: 180,
  description: 'Parçalı bulutlu',
  icon: '02d',
  sunrise: new Date('2026-10-08T04:00:00Z'),
  sunset: new Date('2026-10-08T16:00:00Z'),
  timestamp: new Date('2026-10-08T12:00:00Z'),
  coordinates: { lat: 38.42, lon: 27.14 },
  clouds: 28,
  meta: {
    provider: 'OpenWeather',
    fetchedAt: new Date('2026-10-08T12:00:00Z'),
    timezoneOffsetSeconds: 10800,
  },
};

describe('Hava81 decision hero decorative weather state', () => {
  it.each([
    { icon: '01d', scene: 'clear', night: 'false', sun: true, moon: false },
    { icon: '01n', scene: 'clear', night: 'true', sun: false, moon: true },
    { icon: '03d', scene: 'cloud', night: 'false', sun: false, moon: false },
    { icon: '10n', scene: 'rain', night: 'true', sun: false, moon: false },
    { icon: '13d', scene: 'snow', night: 'false', sun: false, moon: false },
    { icon: '50d', scene: 'mist', night: 'false', sun: false, moon: false },
  ] as const)(
    'illustrates $icon without showing an inaccurate sun',
    ({ icon, scene, night, sun, moon }) => {
      const { container } = render(
        <DecisionGlance weather={{ ...sampleWeather, icon }} hourly={[]} forecastMeta={null} />
      );
      const section = screen.getByTestId('decision-glance');
      expect(section).toHaveAttribute('data-weather-scene', scene);
      expect(section).toHaveAttribute('data-night', night);
      expect(container.querySelector('.decision-glance__sun') !== null).toBe(sun);
      expect(container.querySelector('.decision-glance__moon') !== null).toBe(moon);
      expect(container.querySelector('.decision-glance__precipitation') !== null).toBe(
        scene === 'rain' || scene === 'snow'
      );
    }
  );
});
