import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../i18n';
import { AtlasBottomNav } from '../../components/hava81/AtlasBottomNav';

describe('AtlasBottomNav', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('tr');
  });

  it('offers Planla as its own destination between Today and Map', () => {
    const onSelect = vi.fn();
    render(<AtlasBottomNav active="plan" onSelect={onSelect} hasSaved={false} canMap />);
    const nav = screen.getByRole('navigation', { name: 'Ana gezinme' });
    const labels = within(nav)
      .getAllByRole('button')
      .map(button => button.textContent?.trim());
    expect(labels).toEqual(['Bugün', 'Planla', 'Harita', 'Karşılaştır']);
    const plan = within(nav).getByRole('button', { name: 'Planla' });
    expect(plan).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('button', { name: 'Bugün' })).not.toHaveAttribute('aria-current');

    fireEvent.click(within(nav).getByRole('button', { name: 'Bugün' }));
    expect(onSelect).toHaveBeenCalledWith('today');
    fireEvent.click(plan);
    expect(onSelect).toHaveBeenLastCalledWith('plan');
  });

  it('uses the English label "Plan"', async () => {
    await i18n.changeLanguage('en');
    render(<AtlasBottomNav active="today" onSelect={() => {}} hasSaved canMap={false} />);
    expect(screen.getByRole('button', { name: 'Plan' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Map' })).toBeDisabled();
  });
});
