import React, { memo, useMemo } from 'react';
import { getWeatherIcon, formatTime, getWindDirection } from '../utils/weatherIcons';
import type { NormalizedWeatherData } from '../types/weather.types';

interface WeatherCardProps {
  weather: NormalizedWeatherData;
  className?: string;
}

interface WeatherTile {
  label: string;
  value: string;
}

export const WeatherCard: React.FC<WeatherCardProps> = memo(({
  weather,
  className = '',
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
  } = weather;

  const tiles = useMemo<WeatherTile[]>(() => [
    { label: 'Hissedilen', value: `${feelsLike}°C` },
    { label: 'Nem', value: `${humidity}%` },
    { label: 'Rüzgar', value: `${windSpeed.toFixed(1)} m/s ${getWindDirection(windDirection)}` },
    { label: 'Basınç', value: `${pressure} hPa` },
    { label: 'Görüş', value: `${(visibility / 1000).toFixed(1)} km` },
    { label: 'Gün Doğumu', value: formatTime(sunrise) },
  ], [feelsLike, humidity, windSpeed, windDirection, pressure, visibility, sunrise]);

  return (
    <section 
      className={`weather-card ${className}`}
      aria-label={`${cityName} hava durumu`}
      aria-live="polite"
    >
      <div className="weather-card__heading">
        <div className="weather-card__icon" aria-label={description}>
          {getWeatherIcon(icon)}
        </div>
        <div className="weather-card__info">
          <h3 className="weather-card__city">
            {cityName}, {country}
          </h3>
          <p className="weather-card__description">{description}</p>
        </div>
        <div className="weather-card__temp">{temperature}°</div>
      </div>

      <div className="weather-card__grid" role="list">
        {tiles.map((tile) => (
          <div className="weather-card__tile" key={tile.label} role="listitem">
            <p className="weather-card__value">{tile.value}</p>
            <p className="weather-card__label">{tile.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
});

WeatherCard.displayName = 'WeatherCard';

export default WeatherCard;
