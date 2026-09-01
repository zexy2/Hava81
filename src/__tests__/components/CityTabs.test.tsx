import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CityTabs } from '../../components/CityTabs';
import '../../i18n';

vi.mock('../../context/SettingsContext', () => ({
  useSettings: () => ({
    convertTemperature: (value: number) => value,
    getTemperatureSymbol: () => '°C',
  }),
}));

describe('CityTabs', () => {
  it('marks a saved province active across localized provider spellings', () => {
    render(
      <CityTabs
        cities={[{ name: 'İstanbul', lat: 41.01, lon: 28.97, temp: 20, icon: '01d' }]}
        activeCity="Istanbul"
        onSelect={vi.fn()}
        onRemove={vi.fn()}
        onAdd={vi.fn()}
        canAdd={false}
      />
    );

    expect(
      screen.getByRole('button', { name: 'İstanbul hava durumunu göster, 20°C' })
    ).toHaveAttribute('aria-current', 'page');
  });

  it('keeps the fallback label when a saved city has no cached temperature', () => {
    render(
      <CityTabs
        cities={[{ name: 'Ankara', lat: 39.93, lon: 32.86 }]}
        activeCity=""
        onSelect={vi.fn()}
        onRemove={vi.fn()}
        onAdd={vi.fn()}
        canAdd={false}
      />
    );

    expect(screen.getByRole('button', { name: 'Ankara hava durumunu göster' })).toBeVisible();
  });
});
