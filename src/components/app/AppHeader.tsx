import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getCityMetadata } from '../../constants/cityMetadata';
import type { AtlasView } from '../../utils/atlasView';
import './AppHeader.css';
import { SearchBar } from '../SearchBar';
import { CityTabs } from '../CityTabs';
import type { FavoriteCity } from '../../types/weather.types';
import { LocationIcon, SearchIcon, SettingsIcon, StarIcon } from './AppIcons';

export interface AppHeaderProps {
  /** Mobile search sheet state (the search region is always rendered). */
  isMobileSearchOpen: boolean;
  searchInputRef: React.Ref<HTMLInputElement>;
  searchToggleRef: React.Ref<HTMLButtonElement>;
  cityRailRef: React.Ref<HTMLDivElement>;
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: (selectedCity?: string) => void;
  onCloseSearch: () => void;
  onToggleMobileSearch: () => void;
  isLoading: boolean;
  recentSearches: Array<{ city: string; timestamp: number }>;
  /** Inline "not found" state for the failed query (Faz 1.3). */
  searchNotFound: boolean;
  failedQuery: string;
  searchSuggestion: { name: string } | null;
  onLocate: () => void;
  hasWeather: boolean;
  activeCity: string;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  isPlanView: boolean;
  onOpenPlan: () => void;
  favorites: FavoriteCity[];
  isCompareActive: boolean;
  onOpenCompare: () => void;
  showMap: boolean;
  onToggleMap: () => void;
  isSettingsOpen: boolean;
  onOpenSettings: () => void;
  language: string;
  onSelectFavorite: (favorite: FavoriteCity) => void;
  onRemoveFavorite: (name: string) => void;
  onAddFavorite: () => void;
  /** Current view, for the desktop primary navigation. */
  activeView?: AtlasView;
  onNavigate?: (view: AtlasView) => void;
  /** Shortcut hint shown inside the search field (⌘K / Ctrl+K). */
  searchShortcutLabel?: string;
  /** Live reading for the condensed masthead; null until weather is known. */
  context?: { cityName: string; temperatureLabel: string | null } | null;
}

/** Scroll depth after which the masthead condenses and shows the context line. */
const CONDENSE_AT = 160;

function useCondensed(threshold: number) {
  const [condensed, setCondensed] = useState(false);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setCondensed(window.scrollY > threshold);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [threshold]);
  return condensed;
}

/** Navy app header: brand, search, quick actions and the saved-city rail (Faz 3.4). */
export function AppHeader({
  isMobileSearchOpen,
  searchInputRef,
  searchToggleRef,
  cityRailRef,
  query,
  onQueryChange,
  onSubmit,
  onCloseSearch,
  onToggleMobileSearch,
  isLoading,
  recentSearches,
  searchNotFound,
  failedQuery,
  searchSuggestion,
  onLocate,
  hasWeather,
  activeCity,
  isFavorite,
  onToggleFavorite,
  isPlanView,
  onOpenPlan,
  favorites,
  isCompareActive,
  onOpenCompare,
  showMap,
  onToggleMap,
  isSettingsOpen,
  onOpenSettings,
  language,
  onSelectFavorite,
  onRemoveFavorite,
  onAddFavorite,
  activeView = 'today',
  onNavigate,
  searchShortcutLabel,
  context = null,
}: AppHeaderProps) {
  const { t } = useTranslation();
  const condensed = useCondensed(CONDENSE_AT);
  const contextTemperature = context?.temperatureLabel ?? null;
  const contextCity = context ? (getCityMetadata(context.cityName)?.name ?? context.cityName) : '';
  const favoriteLabel = isFavorite ? t('weather.removeFromFavorites') : t('weather.addToFavorites');
  const mapLabel = showMap ? t('weather.hideMap') : t('weather.showMap');

  return (
    <header
      className={`atlas-header${isMobileSearchOpen ? ' atlas-header--search-open' : ''}`}
      data-condensed={condensed}
    >
      <div className="atlas-header__inner">
        <a className="atlas-brand" href="/">
          <span className="atlas-brand__name">
            Hava<em>81</em>
          </span>
        </a>

        <nav className="atlas-header__nav" aria-label={t('hava81.header.views')}>
          <button
            type="button"
            className="atlas-nav-link"
            onClick={() => onNavigate?.('today')}
            aria-current={activeView === 'today' ? 'page' : undefined}
          >
            {t('navigation.today')}
          </button>
          {hasWeather && (
            <button
              type="button"
              className="atlas-nav-link atlas-plan-button"
              onClick={onOpenPlan}
              aria-current={isPlanView ? 'page' : undefined}
            >
              {t('navigation.plan')}
            </button>
          )}
          <button
            type="button"
            className="atlas-nav-link atlas-icon-button--map"
            onClick={onToggleMap}
            disabled={!hasWeather}
            aria-expanded={showMap}
            aria-controls={showMap ? 'weather-map-region' : undefined}
            aria-current={activeView === 'map' ? 'page' : undefined}
            aria-label={mapLabel}
          >
            {t('navigation.map')}
          </button>
          {favorites.length >= 2 && (
            <button
              type="button"
              className="atlas-nav-link atlas-compare-button"
              onClick={onOpenCompare}
              aria-current={isCompareActive ? 'page' : undefined}
            >
              {t('hava81.compare.action')}
              <span className="atlas-nav-link__count" aria-hidden="true">
                {favorites.length}
              </span>
            </button>
          )}
        </nav>

        <p className="atlas-header__context" data-testid="header-context" aria-hidden={!condensed}>
          {context && condensed ? (
            <>
              <span className="atlas-header__context-city">{contextCity}</span>
              {contextTemperature !== null ? (
                <span className="atlas-header__context-temp">{contextTemperature}°</span>
              ) : null}
            </>
          ) : null}
        </p>

        <div className="atlas-header__search" id="atlas-search-region">
          <SearchBar
            ref={searchInputRef}
            value={query}
            onChange={onQueryChange}
            onSubmit={onSubmit}
            isLoading={isLoading}
            recentSearches={recentSearches}
            placeholder={t('weather.searchPlaceholder')}
            manualQueryHint={t('weather.districtSearchHint')}
            label={t('weather.searchLabel')}
            submitLabel={t('common.search')}
            loadingLabel={t('common.loading')}
            suggestionsLabel={t('weather.citySuggestions')}
            onDismiss={isMobileSearchOpen ? onCloseSearch : undefined}
          />
          {searchShortcutLabel ? (
            <kbd className="atlas-header__shortcut" aria-hidden="true">
              {searchShortcutLabel}
            </kbd>
          ) : null}
          {searchNotFound && (
            <p className="atlas-search-inline-error" role="alert">
              {t('weather.searchNotFound', { query: failedQuery })}{' '}
              {searchSuggestion && (
                <>
                  {t('weather.didYouMean')}{' '}
                  <button
                    type="button"
                    className="atlas-text-button"
                    onClick={() => {
                      onQueryChange(searchSuggestion.name);
                      onSubmit(searchSuggestion.name);
                    }}
                  >
                    {searchSuggestion.name}
                  </button>
                  ?
                </>
              )}
            </p>
          )}
        </div>

        <div className="atlas-header__actions" role="group" aria-label={t('weather.quickActions')}>
          <button
            ref={searchToggleRef}
            type="button"
            className="atlas-icon-button atlas-icon-button--search"
            onClick={onToggleMobileSearch}
            aria-expanded={isMobileSearchOpen}
            aria-controls="atlas-search-region"
            aria-label={isMobileSearchOpen ? t('hava81.closeSearch') : t('weather.searchLabel')}
          >
            <SearchIcon />
          </button>
          <button
            type="button"
            className="atlas-icon-button atlas-icon-button--location"
            onClick={onLocate}
            disabled={isLoading}
            aria-busy={isLoading}
            aria-label={t('weather.useMyLocation')}
            title={t('weather.useMyLocation')}
          >
            <LocationIcon />
          </button>
          <button
            type="button"
            className="atlas-icon-button"
            onClick={onToggleFavorite}
            disabled={!hasWeather}
            aria-pressed={isFavorite}
            aria-label={favoriteLabel}
            title={favoriteLabel}
          >
            <StarIcon filled={isFavorite} />
          </button>
          <button
            type="button"
            className="atlas-icon-button atlas-settings-button"
            onClick={onOpenSettings}
            aria-haspopup="dialog"
            aria-expanded={isSettingsOpen}
            aria-controls={isSettingsOpen ? 'settings-panel-dialog' : undefined}
            aria-label={t('common.settings')}
          >
            <span className="atlas-settings-button__language" aria-hidden="true">
              {language.toUpperCase()}
            </span>
            <SettingsIcon />
          </button>
        </div>
      </div>

      {favorites.length > 0 && (
        <div className="atlas-city-rail" ref={cityRailRef}>
          <CityTabs
            cities={favorites}
            activeCity={activeCity}
            onSelect={onSelectFavorite}
            onRemove={onRemoveFavorite}
            onAdd={onAddFavorite}
            canAdd={hasWeather && !isFavorite}
          />
        </div>
      )}
    </header>
  );
}
