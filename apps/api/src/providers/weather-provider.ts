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
  hourly: Array<{
    time: string;
    temp: number;
    icon: string;
    description: string;
    pop: number;
    windSpeed: number;
  }>;
}

export interface HourlyForecastProvider {
  readonly name: string;
  readonly attribution?: string;
  readonly sourceUrl?: string;
  getHourly(query: HourlyForecastQuery): Promise<HourlyForecastProviderResult>;
}

export type AirQualityQuery = CoordinateQuery;

export interface WeatherProvider {
  readonly name?: string;
  getCurrent(query: CurrentWeatherQuery): Promise<CurrentWeatherUpstream>;
  getForecast(query: ForecastQuery): Promise<ForecastUpstream>;
  getAirQuality(query: AirQualityQuery): Promise<AirQualityUpstream>;
}
