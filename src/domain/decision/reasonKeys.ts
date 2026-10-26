import type { DecisionReasonCode } from './types';

/** i18n key under `hava81.dailyPlan.reasons` for every decision reason code. */
export const REASON_I18N_KEY: Readonly<Record<DecisionReasonCode, string>> = {
  'extreme-heat': 'extremeHeat',
  heat: 'heat',
  freezing: 'freezing',
  cold: 'cold',
  'heavy-rain': 'heavyRain',
  'rain-risk': 'rainRisk',
  'strong-wind': 'strongWind',
  windy: 'windy',
  'gusty-wind': 'gustyWind',
  'poor-air-quality': 'poorAirQuality',
  'sensitive-air-quality': 'sensitiveAirQuality',
  'high-uv': 'highUv',
  'low-visibility': 'lowVisibility',
  'severe-weather': 'severeWeather',
  muggy: 'muggy',
  dust: 'dust',
  pollen: 'pollen',
};
