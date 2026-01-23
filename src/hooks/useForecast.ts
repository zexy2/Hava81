import { useState, useCallback } from 'react';
import { weatherService } from '../api/weatherService';
import type { DailyForecast, HourlyForecast, AirQuality, Coordinates } from '../types';

interface UseForecastReturn {
  daily: DailyForecast[];
  hourly: HourlyForecast[];
  airQuality: AirQuality | null;
  isLoading: boolean;
  error: Error | null;
  fetch: (coords: Coordinates) => Promise<void>;
}

export function useForecast(): UseForecastReturn {
  const [daily, setDaily] = useState<DailyForecast[]>([]);
  const [hourly, setHourly] = useState<HourlyForecast[]>([]);
  const [airQuality, setAirQuality] = useState<AirQuality | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetch = useCallback(async (coords: Coordinates) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const [forecastData, aqData] = await Promise.all([
        weatherService.getForecast(coords.lat, coords.lon),
        weatherService.getAirQuality(coords.lat, coords.lon).catch(() => null),
      ]);
      
      setDaily(forecastData.daily);
      setHourly(forecastData.hourly);
      setAirQuality(aqData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Tahmin alınamadı'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { daily, hourly, airQuality, isLoading, error, fetch };
}

export default useForecast;
