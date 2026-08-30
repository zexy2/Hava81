import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RouteWeatherPanel } from '../../components/hava81/RouteWeatherPanel';
import { SettingsProvider } from '../../context';
import '../../i18n';

const api = vi.hoisted(() => ({
  getRouteWeather: vi.fn(),
}));

vi.mock('../../api/weatherService', () => ({ weatherService: api }));

const renderPanel = (currentCityName: string) =>
  render(
    <SettingsProvider>
      <RouteWeatherPanel currentCityName={currentCityName} />
    </SettingsProvider>
  );

describe('RouteWeatherPanel city identity', () => {
  beforeEach(() => {
    localStorage.clear();
    api.getRouteWeather.mockReset();
  });

  it('maps an ASCII provider city label to the canonical province option', async () => {
    const user = userEvent.setup();
    renderPanel("Istanbul");

    await user.click(screen.getByText('Rota havası'));

    expect(screen.getByLabelText('Başlangıç')).toHaveValue('İstanbul');
    expect(screen.getByLabelText('Varış')).toHaveValue('Ankara');
  });

  it('keeps route endpoints distinct when the active city changes to the selected destination', async () => {
    const user = userEvent.setup();
    const { rerender } = renderPanel('İstanbul');

    await user.click(screen.getByText('Rota havası'));
    expect(screen.getByLabelText('Başlangıç')).toHaveValue('İstanbul');
    expect(screen.getByLabelText('Varış')).toHaveValue('Ankara');

    rerender(
      <SettingsProvider>
        <RouteWeatherPanel currentCityName="Ankara" />
      </SettingsProvider>
    );

    expect(screen.getByLabelText('Başlangıç')).toHaveValue('Ankara');
    expect(screen.getByLabelText('Varış')).toHaveValue('İstanbul');
    expect(screen.getByRole('button', { name: 'Koridoru kontrol et' })).toBeEnabled();
  });

  it('updates the route origin when the active weather city changes', async () => {
    const user = userEvent.setup();
    const { rerender } = renderPanel('İstanbul');

    await user.click(screen.getByText('Rota havası'));
    expect(screen.getByLabelText('Başlangıç')).toHaveValue('İstanbul');

    rerender(
      <SettingsProvider>
        <RouteWeatherPanel currentCityName="Izmir" />
      </SettingsProvider>
    );

    expect(screen.getByLabelText('Başlangıç')).toHaveValue('İzmir');
  });
});
