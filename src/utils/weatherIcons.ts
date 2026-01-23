/**
 * Weather Icon Utilities
 */

type WeatherIconCode =
  | '01d' | '01n'
  | '02d' | '02n'
  | '03d' | '03n'
  | '04d' | '04n'
  | '09d' | '09n'
  | '10d' | '10n'
  | '11d' | '11n'
  | '13d' | '13n'
  | '50d' | '50n';

const WEATHER_ICONS: Record<WeatherIconCode, string> = {
  '01d': '☀️',
  '01n': '🌙',
  '02d': '⛅',
  '02n': '☁️',
  '03d': '☁️',
  '03n': '☁️',
  '04d': '☁️',
  '04n': '☁️',
  '09d': '🌧️',
  '09n': '🌧️',
  '10d': '🌦️',
  '10n': '🌧️',
  '11d': '⛈️',
  '11n': '⛈️',
  '13d': '❄️',
  '13n': '❄️',
  '50d': '🌫️',
  '50n': '🌫️',
};

const WEATHER_DESCRIPTIONS: Record<string, string> = {
  '01': 'Açık hava',
  '02': 'Az bulutlu',
  '03': 'Parçalı bulutlu',
  '04': 'Çok bulutlu',
  '09': 'Sağanak yağışlı',
  '10': 'Yağmurlu',
  '11': 'Gök gürültülü fırtına',
  '13': 'Karlı',
  '50': 'Sisli',
};

export const getWeatherIcon = (code?: string): string => {
  if (!code) return '🌤️';
  return WEATHER_ICONS[code as WeatherIconCode] ?? '🌤️';
};

export const getWeatherDescription = (code?: string): string => {
  if (!code) return 'Bilinmiyor';
  const baseCode = code.substring(0, 2);
  return WEATHER_DESCRIPTIONS[baseCode] ?? 'Bilinmiyor';
};

export const getWindDirection = (degrees: number): string => {
  const directions = ['K', 'KD', 'D', 'GD', 'G', 'GB', 'B', 'KB'];
  const index = Math.round(degrees / 45) % 8;
  return directions[index];
};

export const formatTemperature = (temp: number, unit: 'C' | 'F' = 'C'): string => {
  return `${Math.round(temp)}°${unit}`;
};

export const formatVisibility = (meters: number): string => {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${meters} m`;
};

export const formatTime = (date: Date | string | number): string => {
  try {
    const dateObj = date instanceof Date ? date : new Date(date);
    if (isNaN(dateObj.getTime())) {
      return '--:--';
    }
    return dateObj.toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '--:--';
  }
};

export const weatherUtils = {
  getWeatherIcon,
  getWeatherDescription,
  getWindDirection,
  formatTemperature,
  formatVisibility,
  formatTime,
};

export default weatherUtils;
