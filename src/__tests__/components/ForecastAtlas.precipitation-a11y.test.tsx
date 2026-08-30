import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '../../i18n';
import { ForecastAtlas } from '../../components/hava81/ForecastAtlas';
import { SettingsProvider } from '../../context';

describe('ForecastAtlas precipitation accessibility', () => {
  it('announces measurable precipitation without inventing a zero-percent chance', () => {
    render(
      <SettingsProvider>
        <ForecastAtlas
          daily={[]}
          hourly={[
            {
              time: new Date('2026-08-29T00:00:00Z'),
              temp: 22,
              icon: '10n',
              description: 'hafif yağmur',
              pop: 0,
              precipitationMm: 0.4,
              windSpeed: 2,
            },
            {
              time: new Date('2026-08-29T01:00:00Z'),
              temp: 22,
              icon: '10n',
              description: 'hafif yağmur',
              pop: 0.35,
              precipitationMm: 0.8,
              windSpeed: 2,
            },
          ]}
          meta={{
            provider: 'Open-Meteo',
            fetchedAt: new Date(),
            timezoneOffsetSeconds: 0,
            intervalHours: 1,
          }}
        />
      </SettingsProvider>
    );

    const region = screen.getByRole('region', { name: /kaydırılabilir saatlik tahmin/i });
    const hours = within(region).getAllByRole('listitem');
    expect(within(region).queryByText(/yağış olasılığı yüzde 0/i)).not.toBeInTheDocument();
    expect(within(region).getByText(/00:00 · yağış 0,4 mm/i)).toBeInTheDocument();
    expect(within(hours[0]).getByRole('group', { name: /yağış 0,4 mm/i })).toBeInTheDocument();
    expect(hours[0]).not.toHaveTextContent('0%');
    expect(
      within(hours[1]).getByRole('group', {
        name: /yağış olasılığı %35; saatlik miktar 0,8 mm/i,
      })
    ).toBeInTheDocument();
  });
});
