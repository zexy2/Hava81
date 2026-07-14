import React from 'react';
import { useTranslation } from 'react-i18next';
import type { DailyForecast, HourlyForecast } from '../types';
import { getWeatherIcon } from '../utils/weatherIcons';
import { TemperatureChart } from './TemperatureChart';
import { useSettings } from '../context';

interface ForecastProps {
  daily: DailyForecast[];
  hourly: HourlyForecast[];
}

export function Forecast({ daily, hourly }: ForecastProps) {
  const { t } = useTranslation();
  const { convertTemperature, settings } = useSettings();

  const formatDay = (date: Date): string => {
    const daysEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const daysTr = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
    const days = settings.language === 'en' ? daysEn : daysTr;
    const today = new Date();

    if (date.toDateString() === today.toDateString()) {
      return t('days.today');
    }

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (date.toDateString() === tomorrow.toDateString()) {
      return t('days.tomorrow');
    }

    return days[date.getDay()];
  };

  const formatHour = (date: Date): string => {
    const locale = settings.language === 'en' ? 'en-US' : 'tr-TR';
    return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  };
  return (
    <div className="forecast-container">
      {/* Temperature Chart */}
      {hourly.length > 1 && <TemperatureChart data={hourly.slice(0, 12)} />}

      {/* Hourly Forecast */}
      <div className="forecast-section">
        <h3 className="forecast-title">{t('weather.hourlyForecast')}</h3>
        <div className="hourly-scroll">
          {hourly.slice(0, 12).map((hour, index) => (
            <div key={index} className="hourly-item">
              <span className="hourly-time">{formatHour(hour.time)}</span>
              <span className="hourly-icon">{getWeatherIcon(hour.icon)}</span>
              <span className="hourly-temp">{convertTemperature(Math.round(hour.temp))}°</span>
            </div>
          ))}
        </div>
      </div>

      {/* Daily Forecast */}
      <div className="forecast-section">
        <h3 className="forecast-title">{t('weather.forecast')}</h3>
        <div className="daily-list">
          {daily.map((day, index) => (
            <div key={index} className="daily-item">
              <span className="daily-day">{formatDay(day.date)}</span>
              <span className="daily-icon">{getWeatherIcon(day.icon)}</span>
              <div className="daily-temps">
                <span className="daily-high">{convertTemperature(Math.round(day.tempMax))}°</span>
                <span className="daily-low">{convertTemperature(Math.round(day.tempMin))}°</span>
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
