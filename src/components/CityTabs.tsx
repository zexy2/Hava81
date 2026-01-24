import React, { useState } from 'react';
import type { FavoriteCity } from '../types';
import { getWeatherIcon } from '../utils/weatherIcons';
import './CityTabs.css';

interface CityTabsProps {
  cities: FavoriteCity[];
  activeCity: string;
  onSelect: (city: FavoriteCity) => void;
  onRemove: (name: string) => void;
  onAdd: () => void;
  canAdd: boolean;
}

export function CityTabs({ 
  cities, 
  activeCity, 
  onSelect, 
  onRemove, 
  onAdd,
  canAdd,
}: CityTabsProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    setStartX(e.pageX - e.currentTarget.offsetLeft);
    setScrollLeft(e.currentTarget.scrollLeft);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - e.currentTarget.offsetLeft;
    const walk = (x - startX) * 2;
    e.currentTarget.scrollLeft = scrollLeft - walk;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  if (cities.length === 0 && !canAdd) {
    return null;
  }

  return (
    <div className="city-tabs">
      <div 
        className="city-tabs__scroll"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {cities.map((city) => (
          <button
            key={city.name}
            className={`city-tabs__tab ${city.name === activeCity ? 'active' : ''}`}
            onClick={() => onSelect(city)}
          >
            <span className="city-tabs__icon">
              {city.icon ? getWeatherIcon(city.icon) : '📍'}
            </span>
            <span className="city-tabs__name">{city.name}</span>
            {city.temp !== undefined && (
              <span className="city-tabs__temp">{Math.round(city.temp)}°</span>
            )}
            <button
              className="city-tabs__remove"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(city.name);
              }}
              aria-label={`${city.name} şehrini kaldır`}
            >
              ×
            </button>
          </button>
        ))}
        
        {canAdd && (
          <button 
            className="city-tabs__add"
            onClick={onAdd}
            title="Bu şehri ekle"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        )}
      </div>
      
      {cities.length > 0 && (
        <div className="city-tabs__indicator">
          {cities.map((city, i) => (
            <span 
              key={i}
              className={`city-tabs__dot ${city.name === activeCity ? 'active' : ''}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default CityTabs;
