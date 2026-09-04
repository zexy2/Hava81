import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RouteWeatherPanel } from '../../components/hava81/RouteWeatherPanel';
import { SettingsProvider } from '../../context';
import i18n from '../../i18n';

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

describe('RouteWeatherPanel better-departure action', () => {
  beforeEach(async () => {
    localStorage.clear();
    api.getRouteWeather.mockReset();
    await i18n.changeLanguage('tr');
  });

  it('applies the recommended departure and clears the stale route result', async () => {
    const now = new Date('2026-09-04T07:00:00.000Z').getTime();
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(now);
    api.getRouteWeather.mockResolvedValueOnce({
      kind: 'corridor-estimate',
      estimatedDistanceKm: 450,
      estimatedDurationMinutes: 300,
      requestedDeparture: '2026-09-04T08:00:00.000Z',
      score: 62,
      betterDeparture: {
        departure: '2026-09-04T11:00:00.000Z',
        score: 78,
        improvement: 16,
      },
      segments: [],
      disclaimer: 'Modeled corridor guidance.',
    });

    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByText('Rota havası'));
    await user.click(screen.getByRole('button', { name: 'Koridoru kontrol et' }));

    const recommendation = await screen.findByRole('button', {
      name: /yaklaşık 16 puan daha iyi görünüyor · bu saati kullan/i,
    });
    const announcement = screen.getByRole('status');
    expect(announcement).toHaveTextContent('62/100');
    expect(announcement).not.toContainElement(recommendation);

    await user.click(recommendation);

    const departureInput = screen.getByLabelText('Kalkış zamanı · Türkiye saati');
    expect(departureInput).toHaveValue('2026-09-04T14:00');
    expect(departureInput).toHaveFocus();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    nowSpy.mockRestore();
  });
});
