import { useCallback, useEffect, useMemo } from 'react';
import { TURKISH_CITIES } from '../constants/cities';
import type { FavoriteCity, NormalizedWeatherData } from '../types';
import { citySlug } from '../utils/cityRoute';
import { useLocalStorage } from './useLocalStorage';

const favoriteCityKey = (name: string): string =>
  citySlug(name) || name.trim().toLocaleLowerCase('tr-TR');

const cityByFavoriteKey = new Map(TURKISH_CITIES.map(city => [favoriteCityKey(city.name), city]));
const validWeatherIcon = /^(?:0[1-4]|09|10|11|13|50)[dn]$/;

const deserializeFavorites = (value: string): FavoriteCity[] => {
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) return [];

  const seen = new Set<string>();
  const favorites: FavoriteCity[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object') continue;
    const candidate = entry as Record<string, unknown>;
    if (typeof candidate.name !== 'string') continue;

    const key = favoriteCityKey(candidate.name);
    const canonicalCity = cityByFavoriteKey.get(key);
    if (!canonicalCity || seen.has(key)) continue;

    const favorite: FavoriteCity = {
      name: canonicalCity.name,
      lat: canonicalCity.coordinates.lat,
      lon: canonicalCity.coordinates.lon,
    };
    if (
      typeof candidate.temp === 'number' &&
      Number.isFinite(candidate.temp) &&
      candidate.temp >= -100 &&
      candidate.temp <= 70
    ) {
      favorite.temp = candidate.temp;
    }
    if (typeof candidate.icon === 'string' && validWeatherIcon.test(candidate.icon)) {
      favorite.icon = candidate.icon;
    }
    favorites.push(favorite);
    seen.add(key);
  }
  return favorites;
};

export const useFavorites = (weather: NormalizedWeatherData | null) => {
  const [favorites, setFavorites] = useLocalStorage<FavoriteCity[]>('favorites', [], {
    deserializer: deserializeFavorites,
  });

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
    const canonicalCity = cityByFavoriteKey.get(weatherKey);
    if (!canonicalCity) return;

    const favorite: FavoriteCity = {
      name: canonicalCity.name,
      lat: canonicalCity.coordinates.lat,
      lon: canonicalCity.coordinates.lon,
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
