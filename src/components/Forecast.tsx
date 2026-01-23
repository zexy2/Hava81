import React from 'react';
import type { DailyForecast, HourlyForecast } from '../types';
import { getWeatherIcon } from '../utils/weatherIcons';

interface ForecastProps {
  daily: DailyForecast[];
  hourly: HourlyForecast[];
}

function formatDay(date: Date): string {
  const days = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
  const today = new Date();
  
  if (date.toDateString() === today.toDateString()) {
    return 'Bugün';
  }
  
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.toDateString() === tomorrow.toDateString()) {
    return 'Yarın';
  }
  
  return days[date.getDay()];
}

function formatHour(date: Date): string {
  return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

export function Forecast({ daily, hourly }: ForecastProps) {
  return (
    <div className="forecast-container">
      {/* Hourly Forecast */}
      <div className="forecast-section">
        <h3 className="forecast-title">Saatlik Tahmin</h3>
        <div className="hourly-scroll">
          {hourly.slice(0, 12).map((hour, index) => (
            <div key={index} className="hourly-item">
              <span className="hourly-time">{formatHour(hour.time)}</span>
              <span className="hourly-icon">{getWeatherIcon(hour.icon)}</span>
              <span className="hourly-temp">{Math.round(hour.temp)}°</span>
            </div>
          ))}
        </div>
      </div>

      {/* Daily Forecast */}
      <div className="forecast-section">
        <h3 className="forecast-title">5 Günlük Tahmin</h3>
        <div className="daily-list">
          {daily.map((day, index) => (
            <div key={index} className="daily-item">
              <span className="daily-day">{formatDay(day.date)}</span>
              <span className="daily-icon">{getWeatherIcon(day.icon)}</span>
              <div className="daily-temps">
                <span className="daily-high">{Math.round(day.tempMax)}°</span>
                <span className="daily-low">{Math.round(day.tempMin)}°</span>
              </div>
              <span className="daily-desc">{day.description}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Forecast;
