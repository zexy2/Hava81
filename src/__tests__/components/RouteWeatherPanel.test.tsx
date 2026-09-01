import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RouteWeatherPanel } from '../../components/hava81/RouteWeatherPanel';
import { SettingsProvider } from '../../context';
import '../../i18n';
import type { RouteWeatherResult } from '../../types';

const api = vi.hoisted(() => ({
  getRouteWeather: vi.fn(),
}));

vi.mock('../../api/weatherService', () => ({ weatherService: api }));

const renderPanel = () =>
  render(
    <SettingsProvider>
      <RouteWeatherPanel currentCityName="İstanbul" />
    </SettingsProvider>
  );

describe('RouteWeatherPanel', () => {
  beforeEach(() => {
    localStorage.clear();
    api.getRouteWeather.mockReset();
  });

  it('swaps origin and destination with one action', async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByText('Rota havası'));

    expect(screen.getByLabelText('Başlangıç')).toHaveValue('İstanbul');
    expect(screen.getByLabelText('Varış')).toHaveValue('Ankara');

    await user.click(screen.getByRole('button', { name: 'Yönü değiştir' }));

    expect(screen.getByLabelText('Başlangıç')).toHaveValue('Ankara');
    expect(screen.getByLabelText('Varış')).toHaveValue('İstanbul');
  });

  it('explains why route checking is unavailable for identical cities', async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByText('Rota havası'));
    await user.selectOptions(screen.getByLabelText('Varış'), 'İstanbul');

    const check = screen.getByRole('button', { name: 'Koridoru kontrol et' });
    expect(check).toBeDisabled();
    expect(check).toHaveAttribute('aria-describedby', 'route-weather-same-city');
    expect(screen.getByRole('status')).toHaveTextContent(
      'Başlangıç ve varış için farklı şehirler seç.'
    );
  });

  it('announces a completed route-weather decision without moving focus', async () => {
    const user = userEvent.setup();
    api.getRouteWeather.mockResolvedValueOnce({
      kind: 'corridor-estimate',
      estimatedDistanceKm: 450,
      estimatedDurationMinutes: 300,
      requestedDeparture: '2026-08-28T18:00:00.000Z',
      score: 78,
      segments: [
        {
          fraction: 0,
          lat: 41.01,
          lon: 28.97,
          eta: '2026-08-28T18:00:00.000Z',
          temperature: 25,
          precipitationProbability: 20,
          precipitationMm: 0.4,
          windSpeed: 4,
          description: 'açık',
          score: 82,
          risk: 'low',
        },
      ],
      disclaimer: 'Modeled corridor guidance.',
    });

    renderPanel();
    await user.click(screen.getByText('Rota havası'));
    await user.click(screen.getByRole('button', { name: 'Koridoru kontrol et' }));

    const result = await screen.findByRole('status');
    expect(result).toHaveAttribute('aria-live', 'polite');
    expect(result).toHaveAttribute('aria-atomic', 'true');
    expect(result).toHaveTextContent('78/100');
    expect(result).toHaveTextContent('Uygun');
    expect(result).toHaveTextContent('82/100 · Uygun');
    expect(result).toHaveTextContent('%20 · 0,4 mm');
    expect(screen.getByRole('list', { name: 'Rota boyunca hava örnekleri' })).toHaveAttribute(
      'tabindex',
      '0'
    );
  });

  it('shows a dry label instead of 0% for a dry route segment', async () => {
    const user = userEvent.setup();
    api.getRouteWeather.mockResolvedValueOnce({
      kind: 'corridor-estimate',
      estimatedDistanceKm: 450,
      estimatedDurationMinutes: 300,
      requestedDeparture: '2026-08-28T18:00:00.000Z',
      score: 90,
      segments: [
        {
          fraction: 0,
          lat: 41.01,
          lon: 28.97,
          eta: '2026-08-28T18:00:00.000Z',
          temperature: 25,
          precipitationProbability: 0,
          precipitationMm: 0,
          windSpeed: 4,
          description: 'açık',
          score: 92,
          risk: 'low',
        },
      ],
      disclaimer: 'Modeled corridor guidance.',
    });

    renderPanel();
    await user.click(screen.getByText('Rota havası'));
    await user.click(screen.getByRole('button', { name: 'Koridoru kontrol et' }));

    const result = await screen.findByRole('status');
    expect(result).toHaveTextContent('Yağış yok');
    expect(result).not.toHaveTextContent('%0');
  });

  it('renders route segment temperature and wind with the selected units', async () => {
    localStorage.setItem(
      'user-settings',
      JSON.stringify({
        temperatureUnit: 'imperial',
        windSpeedUnit: 'kmh',
        themeMode: 'auto',
        language: 'tr',
      })
    );
    const user = userEvent.setup();
    api.getRouteWeather.mockResolvedValueOnce({
      kind: 'corridor-estimate',
      estimatedDistanceKm: 450,
      estimatedDurationMinutes: 300,
      requestedDeparture: '2026-08-28T18:00:00.000Z',
      score: 78,
      segments: [
        {
          fraction: 0,
          lat: 41.01,
          lon: 28.97,
          eta: '2026-08-28T18:00:00.000Z',
          temperature: 25,
          precipitationProbability: 20,
          windSpeed: 4,
          description: 'açık',
          score: 82,
          risk: 'low',
        },
      ],
      disclaimer: 'Modeled corridor guidance.',
    });

    renderPanel();
    await user.click(screen.getByText('Rota havası'));
    await user.click(screen.getByRole('button', { name: 'Koridoru kontrol et' }));

    const result = await screen.findByRole('status');
    expect(result).toHaveTextContent('77°F');
    expect(result).toHaveTextContent('Rüzgar 14 km/h');
    expect(result).not.toHaveTextContent('25° ·');
    expect(result).not.toHaveTextContent('4.0 m/s');
  });

  it('removes a stale route result when departure changes', async () => {
    const user = userEvent.setup();
    api.getRouteWeather.mockResolvedValueOnce({
      kind: 'corridor-estimate',
      estimatedDistanceKm: 450,
      estimatedDurationMinutes: 300,
      requestedDeparture: '2026-08-28T18:00:00.000Z',
      score: 78,
      segments: [],
      disclaimer: 'Modeled corridor guidance.',
    });

    renderPanel();
    await user.click(screen.getByText('Rota havası'));
    await user.click(screen.getByRole('button', { name: 'Koridoru kontrol et' }));
    expect(await screen.findByRole('status')).toHaveTextContent('78/100');

    fireEvent.change(screen.getByLabelText('Kalkış zamanı · Türkiye saati'), {
      target: { value: '2026-08-29T10:00' },
    });

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('ignores a late route response after the departure input changes', async () => {
    const user = userEvent.setup();
    let resolveRoute!: (value: RouteWeatherResult) => void;
    api.getRouteWeather.mockImplementationOnce(
      () =>
        new Promise<RouteWeatherResult>(resolve => {
          resolveRoute = resolve;
        })
    );

    renderPanel();
    await user.click(screen.getByText('Rota havası'));
    await user.click(screen.getByRole('button', { name: 'Koridoru kontrol et' }));
    expect(screen.getByRole('button', { name: 'Yükleniyor...' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Kalkış zamanı · Türkiye saati'), {
      target: { value: '2026-08-29T10:00' },
    });
    expect(screen.getByRole('button', { name: 'Koridoru kontrol et' })).toBeEnabled();

    await act(async () => {
      resolveRoute({
        kind: 'corridor-estimate',
        estimatedDistanceKm: 450,
        estimatedDurationMinutes: 300,
        requestedDeparture: '2026-08-28T18:00:00.000Z',
        score: 41,
        segments: [],
        disclaimer: 'Old modeled corridor guidance.',
      });
    });

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByText('41/100')).not.toBeInTheDocument();
  });

  it('removes the previous result while a fresh route request is loading', async () => {
    const user = userEvent.setup();
    api.getRouteWeather.mockResolvedValueOnce({
      kind: 'corridor-estimate',
      estimatedDistanceKm: 450,
      estimatedDurationMinutes: 300,
      requestedDeparture: '2026-08-28T18:00:00.000Z',
      score: 78,
      segments: [],
      disclaimer: 'Modeled corridor guidance.',
    });

    renderPanel();
    await user.click(screen.getByText('Rota havası'));
    const check = screen.getByRole('button', { name: 'Koridoru kontrol et' });
    await user.click(check);
    expect(await screen.findByRole('status')).toHaveTextContent('78/100');

    api.getRouteWeather.mockImplementationOnce(() => new Promise(() => {}));
    await user.click(check);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Yükleniyor...' })).toBeDisabled();
  });

  it('rejects a departure outside the supported horizon before calling the API', async () => {
    const user = userEvent.setup();

    renderPanel();
    await user.click(screen.getByText('Rota havası'));
    fireEvent.change(screen.getByLabelText('Kalkış zamanı · Türkiye saati'), {
      target: { value: '2099-01-01T12:00' },
    });
    await user.click(screen.getByRole('button', { name: 'Koridoru kontrol et' }));

    expect(api.getRouteWeather).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Kalkış zamanı şimdi ile önümüzdeki 18 saat arasında olmalı.'
    );
  });

  it('keeps raw route-provider failures out of the visible error message', async () => {
    const user = userEvent.setup();
    api.getRouteWeather.mockRejectedValueOnce(
      new Error('secret routing upstream detail: provider.internal.example')
    );

    renderPanel();
    await user.click(screen.getByText('Rota havası'));
    await user.click(screen.getByRole('button', { name: 'Koridoru kontrol et' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Rota hava verisi alınamadı.');
    expect(alert).not.toHaveTextContent('secret routing upstream detail');
  });
});
