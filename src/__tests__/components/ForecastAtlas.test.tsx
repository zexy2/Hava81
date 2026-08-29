import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

const renderRangeAtlas = (count = 24) =>
  render(
    <SettingsProvider>
      <ForecastAtlas
        daily={[]}
        hourly={Array.from({ length: count }, (_, index) => ({
          time: new Date(Date.UTC(2026, 7, 29, index)),
          temp: 20 + index / 10,
          icon: '01d',
          description: 'açık',
          pop: 0,
          windSpeed: 2,
        }))}
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

  it('describes and selects the actual available horizon when fewer than 24 hours are returned', () => {
    renderRangeAtlas(8);

    expect(
      screen.getByRole('heading', { name: /saatlik tahmin · sonraki 8 saat/i })
    ).toBeInTheDocument();
    const range = screen.getByRole('group', { name: /gösterilecek saat aralığı/i });
    expect(within(range).getByRole('button', { name: '8 saat' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(within(range).queryByRole('button', { name: '12 saat' })).not.toBeInTheDocument();
    expect(within(range).queryByRole('button', { name: '24 saat' })).not.toBeInTheDocument();
  });

  it('lets users narrow the real-hourly display without changing forecast data', async () => {
    const user = userEvent.setup();
    renderRangeAtlas();

    const range = screen.getByRole('group', { name: /gösterilecek saat aralığı/i });
    expect(within(range).getByRole('button', { name: '24 saat' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(
      within(screen.getByRole('region', { name: /kaydırılabilir saatlik tahmin/i })).getAllByRole(
        'listitem'
      )
    ).toHaveLength(24);

    await user.click(within(range).getByRole('button', { name: '6 saat' }));

    expect(within(range).getByRole('button', { name: '6 saat' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(
      screen.getByRole('heading', { name: /saatlik tahmin · sonraki 6 saat/i })
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: /kaydırılabilir saatlik tahmin/i })).getAllByRole(
        'listitem'
      )
    ).toHaveLength(6);
  });
});
