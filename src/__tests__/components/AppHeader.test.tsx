import { createRef } from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '../../i18n';
import i18n from '../../i18n';
import { AppHeader, type AppHeaderProps } from '../../components/app/AppHeader';
import app from '../../styles/App.css?inline';
import { computed, mountStyles, unmountStyles } from '../helpers/styles';

const favorites = [
  { name: 'İstanbul', lat: 41.01, lon: 28.97 },
  { name: 'Ankara', lat: 39.93, lon: 32.85 },
];

const renderHeader = (overrides: Partial<AppHeaderProps> = {}) => {
  const props: AppHeaderProps = {
    isMobileSearchOpen: false,
    searchInputRef: createRef<HTMLInputElement>(),
    searchToggleRef: createRef<HTMLButtonElement>(),
    cityRailRef: createRef<HTMLDivElement>(),
    query: '',
    onQueryChange: vi.fn(),
    onSubmit: vi.fn(),
    onCloseSearch: vi.fn(),
    onToggleMobileSearch: vi.fn(),
    isLoading: false,
    recentSearches: [],
    searchNotFound: false,
    failedQuery: '',
    searchSuggestion: null,
    onLocate: vi.fn(),
    hasWeather: true,
    activeCity: 'İstanbul',
    isFavorite: true,
    onToggleFavorite: vi.fn(),
    isPlanView: false,
    onOpenPlan: vi.fn(),
    favorites,
    isCompareActive: false,
    onOpenCompare: vi.fn(),
    showMap: false,
    onToggleMap: vi.fn(),
    isSettingsOpen: false,
    onOpenSettings: vi.fn(),
    language: 'tr',
    onSelectFavorite: vi.fn(),
    onRemoveFavorite: vi.fn(),
    onAddFavorite: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<AppHeader {...props} />) };
};

afterEach(() => unmountStyles());

describe('AppHeader', () => {
  it('exposes quick actions as a named group instead of a navigation landmark', () => {
    renderHeader();
    const header = screen.getByRole('banner');
    const group = within(header).getByRole('group', { name: i18n.t('weather.quickActions') });
    expect(group).toHaveClass('atlas-header__actions');
    expect(within(header).queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('marks the saved comparison view as the current page, not a pressed toggle', () => {
    const { rerender, props } = renderHeader();
    const compare = screen.getByRole('button', {
      name: new RegExp(i18n.t('hava81.compare.action')),
    });
    expect(compare).not.toHaveAttribute('aria-current');
    expect(compare).not.toHaveAttribute('aria-pressed');
    fireEvent.click(compare);
    expect(props.onOpenCompare).toHaveBeenCalledTimes(1);

    rerender(<AppHeader {...props} isCompareActive />);
    expect(compare).toHaveAttribute('aria-current', 'page');
  });

  it('styles the current comparison view differently from the idle action', () => {
    mountStyles([app]);
    const { rerender, props } = renderHeader();
    const compare = screen.getByRole('button', {
      name: new RegExp(i18n.t('hava81.compare.action')),
    });
    const idle = [computed(compare, 'color'), computed(compare, 'background')].join('|');
    rerender(<AppHeader {...props} isCompareActive />);
    const current = [computed(compare, 'color'), computed(compare, 'background')].join('|');
    expect(current).not.toBe(idle);
  });

  it('offers comparison only with two or more saved cities', () => {
    renderHeader({ favorites: favorites.slice(0, 1) });
    expect(
      screen.queryByRole('button', { name: new RegExp(i18n.t('hava81.compare.action')) })
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /İstanbul/ }).length).toBeGreaterThan(0);
  });

  it('marks Planla as current and disables weather-dependent actions before data exists', () => {
    const { rerender, props } = renderHeader({ isPlanView: true });
    expect(screen.getByRole('button', { name: i18n.t('navigation.plan') })).toHaveAttribute(
      'aria-current',
      'page'
    );

    rerender(<AppHeader {...props} hasWeather={false} isFavorite={false} favorites={[]} />);
    expect(
      screen.queryByRole('button', { name: i18n.t('navigation.plan') })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: i18n.t('weather.showMap') })).toBeDisabled();
    expect(screen.getByRole('button', { name: i18n.t('weather.addToFavorites') })).toBeDisabled();
  });

  it('wires the mobile search toggle, map toggle, location and settings dialog', () => {
    const { props, rerender } = renderHeader();
    const search = screen.getByRole('button', { name: i18n.t('weather.searchLabel') });
    expect(search).toHaveAttribute('aria-expanded', 'false');
    expect(search).toHaveAttribute('aria-controls', 'atlas-search-region');
    fireEvent.click(search);
    expect(props.onToggleMobileSearch).toHaveBeenCalled();

    const closedMap = screen.getByRole('button', { name: i18n.t('weather.showMap') });
    expect(closedMap).toHaveAttribute('aria-expanded', 'false');
    expect(closedMap).not.toHaveAttribute('aria-controls');

    rerender(<AppHeader {...props} isMobileSearchOpen showMap />);
    expect(screen.getByRole('banner')).toHaveClass('atlas-header--search-open');
    expect(screen.getByRole('button', { name: i18n.t('hava81.closeSearch') })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    const map = screen.getByRole('button', { name: i18n.t('weather.hideMap') });
    expect(map).toHaveAttribute('aria-expanded', 'true');
    expect(map).toHaveAttribute('aria-controls', 'weather-map-region');
    fireEvent.click(map);
    expect(props.onToggleMap).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: i18n.t('weather.useMyLocation') }));
    expect(props.onLocate).toHaveBeenCalled();

    const settings = screen.getByRole('button', { name: i18n.t('common.settings') });
    expect(settings).toHaveAttribute('aria-haspopup', 'dialog');
    expect(settings).toHaveAttribute('aria-expanded', 'false');
    expect(settings).not.toHaveAttribute('aria-controls');
    expect(settings).toHaveTextContent('TR');
    fireEvent.click(settings);
    expect(props.onOpenSettings).toHaveBeenCalled();
    rerender(<AppHeader {...props} isSettingsOpen />);
    expect(settings).toHaveAttribute('aria-expanded', 'true');
    expect(settings).toHaveAttribute('aria-controls', 'settings-panel-dialog');
  });

  it('toggles the favorite state with a matching pressed state and label', () => {
    const { props } = renderHeader();
    const star = screen.getByRole('button', { name: i18n.t('weather.removeFromFavorites') });
    expect(star).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(star);
    expect(props.onToggleFavorite).toHaveBeenCalled();
  });

  it('shows the inline not-found error with a one-click suggestion', () => {
    const { props } = renderHeader({
      searchNotFound: true,
      failedQuery: 'Istanbl',
      searchSuggestion: { name: 'İstanbul' },
    });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Istanbl');
    fireEvent.click(within(alert).getByRole('button', { name: 'İstanbul' }));
    expect(props.onQueryChange).toHaveBeenCalledWith('İstanbul');
    expect(props.onSubmit).toHaveBeenCalledWith('İstanbul');
  });

  it('renders the saved-city rail only when cities are saved', () => {
    const { container, rerender, props } = renderHeader();
    expect(container.querySelector('.atlas-city-rail')).not.toBeNull();
    rerender(<AppHeader {...props} favorites={[]} />);
    expect(container.querySelector('.atlas-city-rail')).toBeNull();
  });
});
