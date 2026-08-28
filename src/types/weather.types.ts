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
  | '01d'
  | '01n' // clear sky
  | '02d'
  | '02n' // few clouds
  | '03d'
  | '03n' // scattered clouds
  | '04d'
  | '04n' // broken clouds
  | '09d'
  | '09n' // shower rain
  | '10d'
  | '10n' // rain
  | '11d'
  | '11n' // thunderstorm
  | '13d'
  | '13n' // snow
  | '50d'
  | '50n'; // mist

export interface WeatherDataMeta {
  provider: string;
  fetchedAt: Date;
  timezoneOffsetSeconds?: number;
  intervalHours?: number;
  cacheStatus?: 'HIT' | 'MISS' | 'COALESCED';
  freshForSeconds?: number;
}

// Processed/Normalized weather data for UI
export interface NormalizedWeatherData {
  cityName: string;
  country: string;
  temperature: number;
  feelsLike: number;
  tempMin: number;
  tempMax: number;
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
  clouds: number;
  meta: WeatherDataMeta;
}

// Forecast types
export interface ForecastItem {
  dt: number;
  main: MainWeatherData;
  weather: WeatherCondition[];
  clouds: CloudData;
  wind: WindData;
  visibility: number;
  pop: number; // Probability of precipitation
  dt_txt: string;
}

export interface ForecastResponse {
  cod: string;
  message: number;
  cnt: number;
  list: ForecastItem[];
  city: {
    id: number;
    name: string;
    coord: Coordinates;
    country: string;
    population: number;
    timezone: number;
    sunrise: number;
    sunset: number;
  };
}

export interface DailyForecast {
  date: Date;
  tempMin: number;
  tempMax: number;
  icon: WeatherIconCode;
  description: string;
  pop: number; // Frontend-domain ratio from 0 to 1
}

export interface HourlyForecast {
  time: Date;
  temp: number;
  icon: WeatherIconCode;
  description?: string;
  pop: number; // Frontend-domain ratio from 0 to 1
  windSpeed?: number;
}

// Air Quality types
export interface AirQualityResponse {
  coord: Coordinates;
  list: Array<{
    main: { aqi: number };
    components: {
      co: number;
      no: number;
      no2: number;
      o3: number;
      so2: number;
      pm2_5: number;
      pm10: number;
      nh3: number;
    };
    dt: number;
  }>;
}

export interface AirQuality {
  aqi: number;
  aqiLabel: string;
  pm25: number;
  pm10: number;
  o3: number;
  meta?: WeatherDataMeta;
}

export interface ForecastMeta extends WeatherDataMeta {
  timezoneOffsetSeconds: number;
  intervalHours: number;
}

export interface ContextSignals {
  provider: string;
  fetchedAt: Date;
  attribution: string;
  uvIndexMax?: number;
  dustMax?: number;
  grassPollenMax?: number;
  olivePollenMax?: number;
  units: {
    dust?: string;
    grassPollen?: string;
    olivePollen?: string;
    waveHeight?: string;
    waveDirection?: string;
    wavePeriod?: string;
    seaSurfaceTemperature?: string;
  };
  marine?: {
    observedAt: string;
    waveHeight?: number;
    waveDirection?: number;
    wavePeriod?: number;
    seaSurfaceTemperature?: number;
  };
  cacheStatus?: 'HIT' | 'MISS' | 'COALESCED';
  freshForSeconds?: number;
}

export interface RouteWeatherSegment {
  fraction: number;
  lat: number;
  lon: number;
  eta: string;
  temperature: number;
  precipitationProbability: number;
  windSpeed: number;
  description: string;
  score: number;
  risk: 'low' | 'caution' | 'high';
}

export interface RouteWeatherResult {
  kind: 'corridor-estimate';
  estimatedDistanceKm: number;
  estimatedDurationMinutes: number;
  requestedDeparture: string;
  score: number;
  segments: RouteWeatherSegment[];
  betterDeparture?: { departure: string; score: number; improvement: number };
  disclaimer: string;
}

// Favorite city
export interface FavoriteCity {
  name: string;
  lat: number;
  lon: number;
  temp?: number;
  icon?: string;
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
