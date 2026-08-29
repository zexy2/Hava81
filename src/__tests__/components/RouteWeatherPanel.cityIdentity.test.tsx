import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RouteWeatherPanel } from '../../components/hava81/RouteWeatherPanel';
import '../../i18n';

const api = vi.hoisted(() => ({
  getRouteWeather: vi.fn(),
}));

vi.mock('../../api/weatherService', () => ({ weatherService: api }));

describe('RouteWeatherPanel city identity', () => {
  beforeEach(() => {
    api.getRouteWeather.mockReset();
  });

  it('maps an ASCII provider city label to the canonical province option', async () => {
    const user = userEvent.setup();
    render(<RouteWeatherPanel currentCityName="Istanbul" />);

    await user.click(screen.getByText('Rota havası'));

    expect(screen.getByLabelText('Başlangıç')).toHaveValue('İstanbul');
    expect(screen.getByLabelText('Varış')).toHaveValue('Ankara');
  });

  it('updates the route origin when the active weather city changes', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<RouteWeatherPanel currentCityName="İstanbul" />);

    await user.click(screen.getByText('Rota havası'));
    expect(screen.getByLabelText('Başlangıç')).toHaveValue('İstanbul');

    rerender(<RouteWeatherPanel currentCityName="Izmir" />);

    expect(screen.getByLabelText('Başlangıç')).toHaveValue('İzmir');
  });
});
