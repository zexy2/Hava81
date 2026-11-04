/**
 * Contract for the batch-4 map component fixes (PR #1743). Each test names the issue it closes.
 *
 * FROZEN: written before the implementation and not edited afterwards. If a check is wrong,
 * raise it with the owner instead of changing it.
 */
import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../../i18n';
import { SettingsProvider } from '../../context';
import { TURKISH_CITIES } from '../../constants/cities';
import type { NormalizedWeatherData } from '../../types';
import { WeatherMap } from '../../components/WeatherMap';

const service = vi.hoisted(() => ({ getProvinceTemperatures: vi.fn() }));

vi.mock('../../api/weatherService', () => ({
  weatherService: service,
  MAX_FORECAST_FUTURE_SKEW_MS: 60_000,
  MAX_PROVINCE_OBSERVATION_AGE_MS: 3 * 60 * 60_000,
}));

vi.mock('../../components/map/MapSurface', () => ({
  MapSurface: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className} data-testid="map-surface">
      {children}
    </div>
  ),
  MapMarker: ({ label, children }: { label: string; children: ReactNode }) => (
    <button type="button" title={label}>
      {children}
    </button>
  ),
  MapPopup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  MapZoomControls: () => null,
}));

const weather: NormalizedWeatherData = {
  cityName: 'İzmir',
  country: 'TR',
  temperature: 27,
  feelsLike: 27,
  tempMin: 22,
  tempMax: 31,
  humidity: 50,
  pressure: 1010,
  visibility: 10000,
  windSpeed: 3,
  windDirection: 200,
  description: 'açık',
  icon: '01d',
  sunrise: new Date('2026-08-29T03:00:00Z'),
  sunset: new Date('2026-08-29T16:00:00Z'),
  timestamp: new Date(),
  coordinates: { lat: 38.42, lon: 27.14 },
  clouds: 0,
  meta: {
    provider: 'OpenWeather',
    fetchedAt: new Date(),
    timezoneOffsetSeconds: 10800,
    freshForSeconds: 600,
  },
};

type Reading = { precipitation?: number; precipitationProbability?: number; windSpeed?: number };
const provinces = (pick: (plate: number) => Reading | null) => {
  const byPlate = new Map();
  for (const city of TURKISH_CITIES) {
    const reading = pick(city.plateCode);
    if (!reading) continue;
    byPlate.set(city.plateCode, {
      plate: city.plateCode,
      name: city.name,
      lat: city.coordinates.lat,
      lon: city.coordinates.lon,
      temperature: 15,
      icon: '02d',
      description: 'az bulutlu',
      observedAt: new Date(),
      ...reading,
    });
  }
  return {
    byPlate,
    provider: 'MET Norway',
    attribution: 'MET Norway · CC BY 4.0',
    fetchedAt: new Date(),
  };
};

const renderMap = () =>
  render(
    <SettingsProvider>
      <WeatherMap weather={weather} onCitySelect={vi.fn()} />
    </SettingsProvider>
  );

const attribution = () => document.querySelector('.weather-map__attribution')?.textContent ?? '';

describe('WeatherMap, batch 4', () => {
  beforeEach(() => {
    localStorage.clear();
    service.getProvinceTemperatures.mockReset();
  });

  // #1719
  it('#1719 the credit names the layer and hour on screen, and precipitation is not radar', async () => {
    service.getProvinceTemperatures.mockResolvedValue(
      provinces(() => ({ precipitation: 0.2, windSpeed: 4 }))
    );
    renderMap();
    await waitFor(() => expect(attribution()).toMatch(/MET Norway/));

    fireEvent.click(screen.getByRole('button', { name: 'Yağış' }));
    await waitFor(() => expect(attribution()).toMatch(/yağış/i));
    expect(attribution()).toMatch(/radar değil/i);
    expect(attribution()).not.toMatch(/sıcaklı/i);

    fireEvent.click(screen.getByRole('button', { name: 'Rüzgâr' }));
    await waitFor(() => expect(attribution()).toMatch(/rüzgâr/i));
    expect(attribution()).not.toMatch(/radar/i);
  });

  // #1720 #1732
  it('#1720 #1732 a thin layer says how many provinces it has instead of painting the country', async () => {
    // Wind only in Marmara and the Black Sea: plenty of provinces, two regions.
    const north = new Set(
      TURKISH_CITIES.filter(city => city.region === 'Marmara' || city.region === 'Karadeniz').map(
        city => city.plateCode
      )
    );
    service.getProvinceTemperatures.mockResolvedValue(
      provinces(plate => (north.has(plate) ? { windSpeed: 4 } : {}))
    );
    renderMap();
    await waitFor(() => expect(attribution()).toMatch(/MET Norway/));
    fireEvent.click(screen.getByRole('button', { name: 'Rüzgâr' }));
    const status = await screen.findByText(/29\s*\/\s*81/);
    expect(status).toBeInTheDocument();
    expect(document.querySelector('[data-layer-coverage]')).toHaveAttribute(
      'data-layer-coverage',
      'partial'
    );
  });

  it('#1732 a full layer reports full coverage and no partial notice', async () => {
    service.getProvinceTemperatures.mockResolvedValue(provinces(() => ({ windSpeed: 4 })));
    renderMap();
    await waitFor(() => expect(attribution()).toMatch(/MET Norway/));
    fireEvent.click(screen.getByRole('button', { name: 'Rüzgâr' }));
    await waitFor(() =>
      expect(document.querySelector('[data-layer-coverage]')).toHaveAttribute(
        'data-layer-coverage',
        'full'
      )
    );
    expect(screen.queryByText(/\/\s*81/)).not.toBeInTheDocument();
  });

  // #1728
  it('#1728 precipitation with no reading is unavailable, not dry', async () => {
    service.getProvinceTemperatures.mockResolvedValue(provinces(() => ({ windSpeed: 4 })));
    renderMap();
    await waitFor(() => expect(attribution()).toMatch(/MET Norway/));
    fireEvent.click(screen.getByRole('button', { name: 'Yağış' }));
    await waitFor(() =>
      expect(document.querySelector('[data-layer-coverage]')).toHaveAttribute(
        'data-layer-coverage',
        'none'
      )
    );
  });
});
