import React from 'react';
import { useTranslation } from 'react-i18next';
import { SearchBar } from '../SearchBar';
import { CityTabs } from '../CityTabs';
import type { FavoriteCity } from '../../types/weather.types';
import { LocationIcon, MapIcon, SearchIcon, SettingsIcon, StarIcon } from './AppIcons';

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
}: AppHeaderProps) {
  const { t } = useTranslation();
  const favoriteLabel = isFavorite ? t('weather.removeFromFavorites') : t('weather.addToFavorites');
  const mapLabel = showMap ? t('weather.hideMap') : t('weather.showMap');

  return (
    <header className={`atlas-header${isMobileSearchOpen ? ' atlas-header--search-open' : ''}`}>
      <div className="atlas-header__inner">
        <a className="atlas-brand" href="/">
          <span className="atlas-brand__name">Hava81</span>
          <span className="atlas-brand__index" aria-hidden="true">
            <b>81</b>
            <small>ATLAS</small>
          </span>
        </a>

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
          {hasWeather && (
            <button
              type="button"
              className="atlas-plan-button"
              onClick={onOpenPlan}
              aria-current={isPlanView ? 'page' : undefined}
            >
              {t('navigation.plan')}
            </button>
          )}
          {favorites.length >= 2 && (
            <button
              type="button"
              className="atlas-compare-button"
              onClick={onOpenCompare}
              aria-current={isCompareActive ? 'page' : undefined}
            >
              {t('hava81.compare.action')}
              <span aria-hidden="true">{favorites.length}</span>
            </button>
          )}
          <button
            type="button"
            className="atlas-icon-button atlas-icon-button--map"
            onClick={onToggleMap}
            disabled={!hasWeather}
            aria-expanded={showMap}
            aria-controls={showMap ? 'weather-map-region' : undefined}
            aria-label={mapLabel}
            title={mapLabel}
          >
            <MapIcon />
          </button>
          <button
            type="button"
            className="atlas-icon-button atlas-settings-button"
            onClick={onOpenSettings}
            aria-haspopup="dialog"
            aria-expanded={isSettingsOpen}
            aria-controls="settings-panel-dialog"
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
