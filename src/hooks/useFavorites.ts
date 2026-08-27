import { useCallback, useEffect, useMemo } from 'react';
import type { FavoriteCity, NormalizedWeatherData } from '../types';
import { useLocalStorage } from './useLocalStorage';

export const useFavorites = (weather: NormalizedWeatherData | null) => {
  const [favorites, setFavorites] = useLocalStorage<FavoriteCity[]>('favorites', []);

  const isFavorite = useMemo(
    () => Boolean(weather && favorites.some(favorite => favorite.name === weather.cityName)),
    [favorites, weather]
  );

  const addFavorite = useCallback(() => {
    if (!weather) return;
    const favorite: FavoriteCity = {
      name: weather.cityName,
      lat: weather.coordinates.lat,
      lon: weather.coordinates.lon,
      temp: weather.temperature,
      icon: weather.icon,
    };
    setFavorites(current =>
      current.some(item => item.name === weather.cityName) ? current : [...current, favorite]
    );
  }, [setFavorites, weather]);

  const removeFavorite = useCallback(
    (name: string) => setFavorites(current => current.filter(favorite => favorite.name !== name)),
    [setFavorites]
  );

  const toggleFavorite = useCallback(() => {
    if (!weather) return;
    if (isFavorite) removeFavorite(weather.cityName);
    else addFavorite();
  }, [addFavorite, isFavorite, removeFavorite, weather]);

  useEffect(() => {
    if (!weather) return;
    setFavorites(current => {
      const index = current.findIndex(favorite => favorite.name === weather.cityName);
      if (index < 0) return current;
      const existing = current[index];
      if (existing.temp === weather.temperature && existing.icon === weather.icon) return current;
      return current.map((favorite, favoriteIndex) =>
        favoriteIndex === index
          ? { ...favorite, temp: weather.temperature, icon: weather.icon }
          : favorite
      );
    });
  }, [setFavorites, weather]);

  return { favorites, isFavorite, addFavorite, removeFavorite, toggleFavorite };
};
