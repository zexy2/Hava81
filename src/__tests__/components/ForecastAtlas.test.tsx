import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import '../../i18n';
import { ForecastAtlas } from '../../components/hava81/ForecastAtlas';
import { SettingsProvider } from '../../context';

const renderAtlas = () =>
  render(
    <SettingsProvider>
      <ForecastAtlas
        daily={[]}
        hourly={[
          {
            time: new Date('2026-08-29T00:00:00Z'),
            temp: 24,
            icon: '01n',
            description: 'açık',
            pop: 0,
            windSpeed: 2,
          },
          {
            time: new Date('2026-08-29T01:00:00Z'),
            temp: 23,
            icon: '01n',
            description: 'açık',
            pop: 0.15,
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

describe('ForecastAtlas hourly precipitation labels', () => {
  it('hides repeated visible 0% labels while preserving the accessible zero-rain meaning', () => {
    renderAtlas();
    const region = screen.getByRole('region', { name: /kaydırılabilir saatlik tahmin/i });
    expect(within(region).queryByText('0%')).not.toBeInTheDocument();
    expect(within(region).getByText('15%')).toBeInTheDocument();
    expect(within(region).getByText(/00:00 saatinde yağış beklenmiyor/i)).toHaveClass(
      'hava81-forecast-atlas__sr-only'
    );
  });
});
