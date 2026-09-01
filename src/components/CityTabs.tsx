import React from 'react';
import { useTranslation } from 'react-i18next';
import type { FavoriteCity } from '../types/weather.types';
import { getCityMetadata } from '../constants/cityMetadata';
import { useSettings } from '../context/SettingsContext';
import { citySlug } from '../utils/cityRoute';
import { WeatherSymbol } from './hava81/WeatherSymbol';
import './CityTabs.css';

interface CityTabsProps {
  cities: FavoriteCity[];
  activeCity: string;
  onSelect: (city: FavoriteCity) => void;
  onRemove: (name: string) => void;
  onAdd: () => void;
  canAdd: boolean;
}

const CloseIcon = () => (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
    <path d="m7 7 10 10M17 7 7 17" />
  </svg>
);

const AddIcon = () => (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export function CityTabs({ cities, activeCity, onSelect, onRemove, onAdd, canAdd }: CityTabsProps) {
  const { t } = useTranslation();
  const { convertTemperature, getTemperatureSymbol } = useSettings();
  const activeCityKey = citySlug(activeCity);

  if (cities.length === 0 && !canAdd) return null;

  return (
    <div className="city-tabs">
      <div className="city-tabs__scroll" role="group" aria-label={t('weather.favoriteCities')}>
        {cities.map(favorite => {
          const isActive = citySlug(favorite.name) === activeCityKey;
          const metadata = getCityMetadata(favorite.name);
          const plateCode = metadata ? String(metadata.plateCode).padStart(2, '0') : '--';
          const displayTemperature =
            favorite.temp !== undefined ? Math.round(convertTemperature(favorite.temp)) : undefined;

          return (
            <div key={favorite.name} className={`city-tabs__item ${isActive ? 'active' : ''}`}>
              <button
                type="button"
                className="city-tabs__tab"
                onClick={() => onSelect(favorite)}
                aria-current={isActive ? 'page' : undefined}
                aria-label={
                  displayTemperature === undefined
                    ? t('weather.selectCity', { city: favorite.name })
                    : t('weather.selectCityWithTemperature', {
                        city: favorite.name,
                        temperature: displayTemperature,
                        unit: getTemperatureSymbol(),
                      })
                }
              >
                <span className="city-tabs__plate" aria-hidden="true">
                  {plateCode}
                </span>
                {favorite.icon && (
                  <WeatherSymbol code={favorite.icon} size={18} className="city-tabs__symbol" />
                )}
                <span className="city-tabs__name">{favorite.name}</span>
                {displayTemperature !== undefined && (
                  <span className="city-tabs__temp">{displayTemperature}°</span>
                )}
              </button>

              <button
                type="button"
                className="city-tabs__remove"
                onClick={() => onRemove(favorite.name)}
                aria-label={t('weather.removeCity', { city: favorite.name })}
              >
                <CloseIcon />
              </button>
            </div>
          );
        })}

        {canAdd && (
          <button
            type="button"
            className="city-tabs__add"
            onClick={onAdd}
            title={t('weather.addCurrentCity')}
            aria-label={t('weather.addCurrentCity')}
          >
            <AddIcon />
          </button>
        )}
      </div>
    </div>
  );
}

export default CityTabs;
