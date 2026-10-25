import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../../i18n';
import i18n from '../../i18n';
import { SettingsProvider } from '../../context';
import type { NormalizedWeatherData } from '../../types';
import { WeatherMap } from '../../components/WeatherMap';

/**
 * Faz 3.4: WeatherMap is rendered with a thin react-leaflet stand-in (jsdom has no layout or
 * canvas), so its own DOM — heading, region, markers, popups, tile status — is tested directly.
 */
const leaflet = vi.hoisted(() => ({
  tileHandlers: {} as Record<string, () => void>,
  mapHandlers: {} as Record<string, (event: { target: { getZoom: () => number } }) => void>,
  map: {
    getContainer: () => ({ clientWidth: 1024 }),
    setView: vi.fn(),
    flyTo: vi.fn(),
  },
}));

const service = vi.hoisted(() => ({
  getProvinceTemperatures: vi.fn(),
}));

vi.mock('../../api/weatherService', () => ({
  weatherService: service,
  MAX_FORECAST_FUTURE_SKEW_MS: 60_000,
  MAX_PROVINCE_OBSERVATION_AGE_MS: 3 * 60 * 60_000,
}));

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className} data-testid="leaflet-map">
      {children}
    </div>
  ),
  TileLayer: ({
    url,
    eventHandlers,
  }: {
    url: string;
    eventHandlers: Record<string, () => void>;
  }) => {
    leaflet.tileHandlers = eventHandlers;
    return <div data-testid="tiles" data-url={url} />;
  },
  Marker: ({ title, children }: { title: string; children: ReactNode }) => (
    <div data-testid="marker" title={title}>
      {children}
    </div>
  ),
  Popup: ({ children }: { children: ReactNode }) => <div className="popup">{children}</div>,
  useMap: () => leaflet.map,
  useMapEvents: (handlers: typeof leaflet.mapHandlers) => {
    leaflet.mapHandlers = handlers;
    return leaflet.map;
  },
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

const renderMap = (props: Partial<Parameters<typeof WeatherMap>[0]> = {}) => {
  const onCitySelect = vi.fn();
  render(
    <SettingsProvider>
      <WeatherMap weather={weather} onCitySelect={onCitySelect} {...props} />
    </SettingsProvider>
  );
  return { onCitySelect };
};

const provinceTemperatures = (observedAt = new Date()) => ({
  byPlate: new Map([[6, {
    plate: 6,
    name: 'Ankara',
    lat: 39.93,
    lon: 32.85,
    temperature: 18,
    icon: '02d',
    description: 'parçalı bulutlu',
    observedAt,
  }]]),
  provider: 'Open-Meteo',
  fetchedAt: new Date(),
});

describe('WeatherMap', () => {
  beforeEach(() => {
    localStorage.clear();
    service.getProvinceTemperatures.mockReset().mockResolvedValue(null);
  });

  it('names the interactive map region from its visible heading', () => {
    renderMap();
    const heading = screen.getByRole('heading', { level: 3, name: i18n.t('weather.mapTitle') });
    const region = screen.getByRole('region', { name: i18n.t('weather.mapTitle') });
    expect(region).toHaveAttribute('aria-labelledby', heading.id);
    expect(region).toContainElement(screen.getByTestId('leaflet-map'));
  });

  it('labels the current city marker with its temperature and offers featured provinces', () => {
    const { onCitySelect } = renderMap();
    const markers = screen.getAllByTestId('marker');
    expect(markers[0]).toHaveAttribute('title', 'İzmir: 27°C');
    const ankara = markers.find(marker => marker.getAttribute('title')?.startsWith('Ankara:'));
    expect(ankara).toBeDefined();
    expect(
      markers.some(
        marker => marker.getAttribute('title')?.startsWith('İzmir: ') && marker !== markers[0]
      )
    ).toBe(false);

    fireEvent.click(
      within(ankara!).getByRole('button', { name: i18n.t('weather.viewCityWeather') })
    );
    expect(onCitySelect).toHaveBeenCalledWith(expect.objectContaining({ name: 'Ankara' }));
  });

  it('flies to the selected city when it changes', () => {
    renderMap();
    expect(leaflet.map.flyTo).toHaveBeenCalledWith([38.42, 27.14], 8, { duration: 0.4 });
  });

  it('keeps an honest tile status: loading, loaded, failed on both providers, retry', () => {
    renderMap();
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    act(() => leaflet.tileHandlers.load());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    const primary = screen.getByTestId('tiles').getAttribute('data-url');
    act(() => leaflet.tileHandlers.tileerror());
    expect(screen.getByTestId('tiles').getAttribute('data-url')).not.toBe(primary);
    act(() => leaflet.tileHandlers.tileerror());
    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
    expect(alert).toHaveTextContent(i18n.t('weather.mapTilesUnavailable'));

    fireEvent.click(within(alert).getByRole('button', { name: i18n.t('weather.mapTilesRetry') }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByTestId('tiles').getAttribute('data-url')).toBe(primary);
  });

  it('reveals all 81 provinces with live temperatures once zoomed into the atlas', async () => {
    service.getProvinceTemperatures.mockResolvedValue(provinceTemperatures());
    renderMap();
    const before = screen.getAllByTestId('marker').length;
    expect(service.getProvinceTemperatures).not.toHaveBeenCalled();

    act(() => leaflet.mapHandlers.zoomend({ target: { getZoom: () => 7 } }));
    await waitFor(() => expect(service.getProvinceTemperatures).toHaveBeenCalled());
    expect(screen.getAllByTestId('marker').length).toBeGreaterThan(before);
    await waitFor(() =>
      expect(
        screen
          .getAllByTestId('marker')
          .find(marker => marker.getAttribute('title')?.startsWith('Ankara:'))
      ).toHaveAttribute('title', expect.stringMatching(/18°C$/))
    );
  });

  it('removes province temperatures when their source observations expire in an open map', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
    try {
      service.getProvinceTemperatures.mockResolvedValue(provinceTemperatures(new Date()));
      renderMap();
      act(() => leaflet.mapHandlers.zoomend({ target: { getZoom: () => 7 } }));
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      const ankara = () => screen.getAllByTestId('marker').find(marker =>
        marker.getAttribute('title')?.startsWith('Ankara:')
      );
      expect(ankara()?.getAttribute('title')).toMatch(/18°C$/);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(3 * 60 * 60_000 + 101);
      });

      expect(ankara()).toBeDefined();
      expect(ankara()?.getAttribute('title')).not.toMatch(/18°C$/);
      expect(screen.queryByText(/Open-Meteo/)).not.toBeInTheDocument();
      expect(service.getProvinceTemperatures.mock.calls.length).toBeGreaterThan(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('continues expiring remaining province samples when a refresh fails', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
    try {
      const initial = provinceTemperatures(new Date());
      const byPlate = new Map(initial.byPlate);
      byPlate.set(16, {
        plate: 16,
        name: 'Bursa',
        lat: 40.19,
        lon: 29.06,
        temperature: 24,
        icon: '01d',
        description: 'açık',
        observedAt: new Date(Date.now() - 60 * 60_000),
      });
      service.getProvinceTemperatures
        .mockResolvedValueOnce({ ...initial, byPlate })
        .mockRejectedValue(new Error('temporary refresh failure'));
      renderMap();
      act(() => leaflet.mapHandlers.zoomend({ target: { getZoom: () => 7 } }));
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      const markerFor = (name: string) => screen.getAllByTestId('marker').find(marker =>
        marker.getAttribute('title')?.startsWith(`${name}:`)
      );
      expect(markerFor('Ankara')?.getAttribute('title')).toMatch(/18°C$/);
      expect(markerFor('Bursa')?.getAttribute('title')).toMatch(/24°C$/);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2 * 60 * 60_000 + 101);
      });
      expect(markerFor('Bursa')?.getAttribute('title')).not.toMatch(/24°C$/);
      expect(markerFor('Ankara')?.getAttribute('title')).toMatch(/18°C$/);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(60 * 60_000 + 101);
      });
      expect(markerFor('Ankara')?.getAttribute('title')).not.toMatch(/18°C$/);
      expect(screen.queryByText(/Open-Meteo/)).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not show a future-dated province observation as a live temperature', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date());
    try {
      service.getProvinceTemperatures.mockResolvedValue(
        provinceTemperatures(new Date(Date.now() + 2 * 60_000))
      );
      renderMap();
      act(() => leaflet.mapHandlers.zoomend({ target: { getZoom: () => 7 } }));
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await Promise.resolve();
      });

      const ankara = screen.getAllByTestId('marker').find(marker =>
        marker.getAttribute('title')?.startsWith('Ankara:')
      );
      expect(ankara?.getAttribute('title')).not.toMatch(/18°C$/);
      expect(screen.queryByText(/Open-Meteo/)).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('refreshes province observations when a backgrounded map becomes visible again', async () => {
    service.getProvinceTemperatures.mockResolvedValue(provinceTemperatures());
    renderMap();
    act(() => leaflet.mapHandlers.zoomend({ target: { getZoom: () => 7 } }));
    await waitFor(() => expect(service.getProvinceTemperatures).toHaveBeenCalledTimes(1));

    act(() => document.dispatchEvent(new Event('visibilitychange')));
    await waitFor(() => expect(service.getProvinceTemperatures).toHaveBeenCalledTimes(2));
  });

  it('shows the stale-data marker instead of an old temperature', () => {
    renderMap({
      weather: {
        ...weather,
        meta: { ...weather.meta, fetchedAt: new Date(Date.now() - 6 * 60 * 60 * 1000) },
      },
    });
    expect(screen.getAllByTestId('marker')[0]).toHaveAttribute(
      'title',
      `İzmir: ${i18n.t('weather.staleCurrentData')}`
    );
  });
});
