import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CityTabs } from '../../components/CityTabs';
import '../../i18n';

vi.mock('../../context/SettingsContext', () => ({
  useSettings: () => ({ convertTemperature: (value: number) => value }),
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

    expect(screen.getByRole('button', { name: /İstanbul/ })).toHaveAttribute('aria-current', 'page');
  });
});
