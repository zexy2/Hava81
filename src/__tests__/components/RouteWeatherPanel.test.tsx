import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RouteWeatherPanel } from '../../components/hava81/RouteWeatherPanel';
import '../../i18n';

const api = vi.hoisted(() => ({
  getRouteWeather: vi.fn(),
}));

vi.mock('../../api/weatherService', () => ({ weatherService: api }));

describe('RouteWeatherPanel', () => {
  beforeEach(() => {
    api.getRouteWeather.mockReset();
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
          windSpeed: 4,
          description: 'açık',
          score: 82,
          risk: 'low',
        },
      ],
      disclaimer: 'Modeled corridor guidance.',
    });

    render(<RouteWeatherPanel currentCityName="İstanbul" />);
    await user.click(screen.getByText('Rota havası'));
    await user.click(screen.getByRole('button', { name: 'Koridoru kontrol et' }));

    const result = await screen.findByRole('status');
    expect(result).toHaveAttribute('aria-live', 'polite');
    expect(result).toHaveAttribute('aria-atomic', 'true');
    expect(result).toHaveTextContent('78/100');
  });

  it('keeps raw route-provider failures out of the visible error message', async () => {
    const user = userEvent.setup();
    api.getRouteWeather.mockRejectedValueOnce(
      new Error('secret routing upstream detail: provider.internal.example')
    );

    render(<RouteWeatherPanel currentCityName="İstanbul" />);
    await user.click(screen.getByText('Rota havası'));
    await user.click(screen.getByRole('button', { name: 'Koridoru kontrol et' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Rota hava verisi alınamadı.');
    expect(alert).not.toHaveTextContent('secret routing upstream detail');
  });
});
