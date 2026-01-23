/**
 * Weather API Types
 * OpenWeather API response type definitions
 */

export interface WeatherCondition {
  id: number;
  main: string;
  description: string;
  icon: WeatherIconCode;
}

export interface MainWeatherData {
  temp: number;
  feels_like: number;
  temp_min: number;
  temp_max: number;
  pressure: number;
  humidity: number;
  sea_level?: number;
  grnd_level?: number;
}

export interface WindData {
  speed: number;
  deg: number;
  gust?: number;
}

export interface CloudData {
  all: number;
}

export interface SystemData {
  type?: number;
  id?: number;
  country: string;
  sunrise: number;
  sunset: number;
}

export interface Coordinates {
  lon: number;
  lat: number;
}

export interface WeatherResponse {
  coord: Coordinates;
  weather: WeatherCondition[];
  base: string;
  main: MainWeatherData;
  visibility: number;
  wind: WindData;
  clouds: CloudData;
  dt: number;
  sys: SystemData;
  timezone: number;
  id: number;
  name: string;
  cod: number;
}

// Weather Icon Codes from OpenWeather
export type WeatherIconCode =
  | '01d' | '01n'  // clear sky
  | '02d' | '02n'  // few clouds
  | '03d' | '03n'  // scattered clouds
  | '04d' | '04n'  // broken clouds
  | '09d' | '09n'  // shower rain
  | '10d' | '10n'  // rain
  | '11d' | '11n'  // thunderstorm
  | '13d' | '13n'  // snow
  | '50d' | '50n'; // mist

// Processed/Normalized weather data for UI
export interface NormalizedWeatherData {
  cityName: string;
  country: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  pressure: number;
  visibility: number;
  windSpeed: number;
  windDirection: number;
  description: string;
  icon: WeatherIconCode;
  sunrise: Date;
  sunset: Date;
  timestamp: Date;
  coordinates: Coordinates;
}

// Weather fetch params
export interface WeatherQueryParams {
  city: string;
  units?: 'metric' | 'imperial' | 'standard';
  lang?: string;
}

// API Error response
export interface WeatherApiError {
  cod: string | number;
  message: string;
}
