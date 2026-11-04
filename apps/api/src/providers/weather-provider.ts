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
  /** When the source model last ran (ISO-8601 UTC), distinct from the time it was fetched. */
  modelUpdatedAt?: string;
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
    /** Length of the source step `pop` belongs to, when it is not this hour alone (3 = OpenWeather). */
    popIntervalHours?: number;
    /** Start of the source step `pop` belongs to (ISO-8601 UTC), when it is not this hour. */
    popValidFrom?: string;
    /** Resolution of the source data behind this row: 1 = MET hourly step, 6 = six-hour step. */
    sourceIntervalHours?: number;
    /** True when the row sits between source steps and its instant values are interpolated. */
    interpolated?: boolean;
    /** Total of the multi-hour source period that covers this hour, mm (not this hour's amount). */
    periodPrecipitationMm?: number;
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
    /** True when the AQI is from fewer than all five pollutants: a lower bound, not complete. */
    aqiPartial?: boolean;
    /** Pollutants a partial AQI was computed from. */
    aqiPollutants?: string[];
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
