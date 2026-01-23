import React from 'react';
import type { FavoriteCity } from '../types';
import { getWeatherIcon } from '../utils/weatherIcons';

interface FavoritesProps {
  favorites: FavoriteCity[];
  currentCity: string;
  onSelect: (city: FavoriteCity) => void;
  onRemove: (name: string) => void;
  onAdd: () => void;
  canAdd: boolean;
}

export function Favorites({ 
  favorites, 
  currentCity,
  onSelect, 
  onRemove, 
  onAdd,
  canAdd 
}: FavoritesProps) {
  if (favorites.length === 0 && !canAdd) {
    return null;
  }

  return (
    <div className="favorites-container">
      <div className="favorites-header">
        <h3 className="favorites-title">Favoriler</h3>
        {canAdd && (
          <button 
            className="favorites-add-btn"
            onClick={onAdd}
            title="Bu şehri favorilere ekle"
          >
            +
          </button>
        )}
      </div>
      
      {favorites.length > 0 && (
        <div className="favorites-list">
          {favorites.map((city) => (
            <div 
              key={city.name} 
              className={`favorite-item ${city.name === currentCity ? 'active' : ''}`}
              onClick={() => onSelect(city)}
            >
              <div className="favorite-info">
                <span className="favorite-icon">
                  {city.icon ? getWeatherIcon(city.icon) : '📍'}
                </span>
                <span className="favorite-name">{city.name}</span>
              </div>
              {city.temp !== undefined && (
                <span className="favorite-temp">{Math.round(city.temp)}°</span>
              )}
              <button 
                className="favorite-remove"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove(city.name);
                }}
                title="Favorilerden kaldır"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Favorites;
