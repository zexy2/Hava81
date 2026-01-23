/**
 * WeatherCard Component - Enhanced Version
 * Displays weather information with animations and accessibility
 */

import React, { memo, useMemo } from 'react';
import { getWeatherIcon, formatTime, getWindDirection } from '../utils/weatherIcons';
import type { NormalizedWeatherData } from '../types/weather.types';

interface WeatherCardProps {
  weather: NormalizedWeatherData;
  className?: string;
  showExtendedInfo?: boolean;
}

interface WeatherTile {
  label: string;
  value: string;
  icon?: string;
}

export const WeatherCard: React.FC<WeatherCardProps> = memo(({
  weather,
  className = '',
  showExtendedInfo = true,
}) => {
  const {
    cityName,
    country,
    temperature,
    feelsLike,
    humidity,
    pressure,
    visibility,
    windSpeed,
    windDirection,
    description,
    icon,
    sunrise,
    sunset,
  } = weather;

  const tiles = useMemo<WeatherTile[]>(() => {
    const baseTiles: WeatherTile[] = [
      {
        label: 'Sıcaklık',
        value: `${temperature}°C`,
        icon: '🌡️',
      },
      {
        label: 'Hissedilen',
        value: `${feelsLike}°C`,
        icon: '🤔',
      },
      {
        label: 'Nem',
        value: `${humidity}%`,
        icon: '💧',
      },
      {
        label: 'Rüzgar',
        value: `${windSpeed.toFixed(1)} m/s ${getWindDirection(windDirection)}`,
        icon: '💨',
      },
    ];

    if (showExtendedInfo) {
      baseTiles.push(
        {
          label: 'Basınç',
          value: `${pressure} hPa`,
          icon: '📊',
        },
        {
          label: 'Görüş',
          value: `${(visibility / 1000).toFixed(1)} km`,
          icon: '👁️',
        },
        {
          label: 'Gün Doğumu',
          value: formatTime(sunrise),
          icon: '🌅',
        },
        {
          label: 'Gün Batımı',
          value: formatTime(sunset),
          icon: '🌇',
        }
      );
    }

    return baseTiles;
  }, [
    temperature, feelsLike, humidity, windSpeed, windDirection,
    pressure, visibility, sunrise, sunset, showExtendedInfo
  ]);

  return (
    <section 
      className={`weather-card ${className}`}
      aria-label={`${cityName} hava durumu`}
      aria-live="polite"
    >
      <div className="weather-card__heading">
        <span 
          className="weather-card__icon"
          role="img"
          aria-label={description}
        >
          {getWeatherIcon(icon)}
        </span>
        <div className="weather-card__info">
          <h3 className="weather-card__city">
            {cityName}
            {country && <span className="weather-card__country">, {country}</span>}
          </h3>
          <p className="weather-card__description">{description}</p>
        </div>
      </div>

      <div className="weather-card__temperature">
        <span className="weather-card__temp-value">{temperature}</span>
        <span className="weather-card__temp-unit">°C</span>
      </div>

      <div 
        className="weather-card__grid"
        role="list"
        aria-label="Hava durumu detayları"
      >
        {tiles.map((tile) => (
          <article 
            className="weather-card__tile" 
            key={tile.label}
            role="listitem"
          >
            {tile.icon && (
              <span className="weather-card__tile-icon" aria-hidden="true">
                {tile.icon}
              </span>
            )}
            <p className="weather-card__value">{tile.value}</p>
            <p className="weather-card__label">{tile.label}</p>
          </article>
        ))}
      </div>
    </section>
  );
});

WeatherCard.displayName = 'WeatherCard';

export default WeatherCard;
