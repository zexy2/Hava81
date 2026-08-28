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
