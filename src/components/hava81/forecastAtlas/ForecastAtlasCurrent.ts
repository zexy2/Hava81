/**
 * Faz 1.2: the "Now" tile shows the same "now" provider as the main card (current
 * observation, °C) instead of the model's hourly value, so the screen has one "now".
 */
export interface ForecastAtlasCurrent {
  temperature: number;
  icon: string;
  description: string;
}
