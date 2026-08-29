import { useCallback, useEffect, useMemo } from 'react';
import type { FavoriteCity, NormalizedWeatherData } from '../types';
import { citySlug } from '../utils/cityRoute';
import { useLocalStorage } from './useLocalStorage';

const favoriteCityKey = (name: string): string =>
  citySlug(name) || name.trim().toLocaleLowerCase('tr-TR');

export const useFavorites = (weather: NormalizedWeatherData | null) => {
  const [favorites, setFavorites] = useLocalStorage<FavoriteCity[]>('favorites', []);

  const isFavorite = useMemo(
    () =>
      Boolean(
        weather &&
          favorites.some(
            favorite => favoriteCityKey(favorite.name) === favoriteCityKey(weather.cityName)
          )
      ),
    [favorites, weather]
  );

  const addFavorite = useCallback(() => {
    if (!weather) return;
    const weatherKey = favoriteCityKey(weather.cityName);
    const favorite: FavoriteCity = {
      name: weather.cityName,
      lat: weather.coordinates.lat,
      lon: weather.coordinates.lon,
      temp: weather.temperature,
      icon: weather.icon,
    };
    setFavorites(current =>
      current.some(item => favoriteCityKey(item.name) === weatherKey)
        ? current
        : [...current, favorite]
    );
  }, [setFavorites, weather]);

  const removeFavorite = useCallback(
    (name: string) => {
      const key = favoriteCityKey(name);
      setFavorites(current => current.filter(favorite => favoriteCityKey(favorite.name) !== key));
    },
    [setFavorites]
  );

  const toggleFavorite = useCallback(() => {
    if (!weather) return;
    if (isFavorite) removeFavorite(weather.cityName);
    else addFavorite();
  }, [addFavorite, isFavorite, removeFavorite, weather]);

  useEffect(() => {
    if (!weather) return;
    const weatherKey = favoriteCityKey(weather.cityName);
    setFavorites(current => {
      const index = current.findIndex(favorite => favoriteCityKey(favorite.name) === weatherKey);
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
