import type {
  AirQualityUpstream,
  CurrentWeatherUpstream,
  ForecastUpstream,
} from './openweather/schemas';

export type WeatherUnits = 'metric' | 'imperial' | 'standard';
export type WeatherLanguage = 'tr' | 'en';

export interface CoordinateQuery {
  lat: number;
  lon: number;
}

export type CurrentWeatherQuery =
  | { city: string; units: WeatherUnits; lang: WeatherLanguage }
  | (CoordinateQuery & { units: WeatherUnits; lang: WeatherLanguage });

export interface ForecastQuery extends CoordinateQuery {
  units: WeatherUnits;
  lang: WeatherLanguage;
}

export interface HourlyForecastQuery extends CoordinateQuery {
  lang: WeatherLanguage;
}

export interface HourlyForecastProviderResult {
  timezoneOffsetSeconds: number;
  daily?: Array<{
    date: string;
    tempMin: number;
    tempMax: number;
    icon: string;
    description: string;
    pop: number;
    precipitationMm?: number;
    /** ISO-8601 UTC instant of local sunrise (Open-Meteo); absent on polar days/nights. */
    sunrise?: string;
    /** ISO-8601 UTC instant of local sunset (Open-Meteo); absent on polar days/nights. */
    sunset?: string;
  }>;
  hourly: Array<{
    time: string;
    temp: number;
    icon: string;
    description: string;
    pop: number;
    windSpeed: number;
    apparentTemperature?: number;
    humidity?: number;
    precipitationMm?: number;
    windGust?: number;
    uvIndex?: number;
    visibility?: number;
    weatherCode?: number;
    /** True when the hour is in daylight (Open-Meteo `is_day`). */
    isDay?: boolean;
    /** Dew point at 2 m in °C (Open-Meteo `dew_point_2m`). */
    dewPoint?: number;
    /** Seconds of sunshine within the preceding hour, 0–3600 (Open-Meteo `sunshine_duration`). */
    sunshineDuration?: number;
  }>;
}

export interface HourlyForecastProvider {
  readonly name: string;
  readonly attribution?: string;
  readonly sourceUrl?: string;
  getHourly(query: HourlyForecastQuery): Promise<HourlyForecastProviderResult>;
}

export type AirQualityQuery = CoordinateQuery;

/** Plan v3 (P1.2): hourly European AQI (0–100+) and PM2.5 for the plan horizon. */
export interface AirQualityHourlyProviderResult {
  hourly: Array<{
    time: string;
    europeanAqi: number;
    pm25?: number;
  }>;
}

export interface AirQualityHourlyProvider {
  readonly name: string;
  readonly attribution?: string;
  readonly sourceUrl?: string;
  getAirQualityHourly(query: CoordinateQuery): Promise<AirQualityHourlyProviderResult>;
}

export interface WeatherProvider {
  readonly name?: string;
  getCurrent(query: CurrentWeatherQuery): Promise<CurrentWeatherUpstream>;
  getForecast(query: ForecastQuery): Promise<ForecastUpstream>;
  getAirQuality(query: AirQualityQuery): Promise<AirQualityUpstream>;
}
