import React, { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { getWeatherIcon, formatTime, getWindDirection } from '../utils/weatherIcons';
import { useSettings } from '../context';
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
  const { t } = useTranslation();
  const { convertTemperature, convertWindSpeed, getTemperatureSymbol, getWindSpeedSymbol } = useSettings();
  
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

  const tempSymbol = getTemperatureSymbol();
  const windSymbol = getWindSpeedSymbol();
  const displayTemp = convertTemperature(temperature);
  const displayFeelsLike = convertTemperature(feelsLike);
  const displayWindSpeed = convertWindSpeed(windSpeed);

  const tiles = useMemo<WeatherTile[]>(() => [
    { label: t('weather.feelsLike'), value: `${displayFeelsLike}${tempSymbol}` },
    { label: t('weather.humidity'), value: `${humidity}%` },
    { label: t('weather.wind'), value: `${displayWindSpeed} ${windSymbol} ${getWindDirection(windDirection)}` },
    { label: t('weather.pressure'), value: `${pressure} hPa` },
    { label: t('weather.visibility'), value: `${(visibility / 1000).toFixed(1)} km` },
    { label: t('weather.sunrise'), value: formatTime(sunrise) },
  ], [t, displayFeelsLike, tempSymbol, humidity, displayWindSpeed, windSymbol, windDirection, pressure, visibility, sunrise]);

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
        <div className="weather-card__temp">{displayTemp}°</div>
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
