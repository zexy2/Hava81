import { useCallback, useMemo } from 'react';
import { TURKISH_CITIES } from '../constants/cities';
import type { FavoriteCity, NormalizedWeatherData } from '../types';
import { citySlug } from '../utils/cityRoute';
import { useLocalStorage } from './useLocalStorage';

const favoriteCityKey = (name: string): string =>
  citySlug(name) || name.trim().toLocaleLowerCase('tr-TR');

const cityByFavoriteKey = new Map(TURKISH_CITIES.map(city => [favoriteCityKey(city.name), city]));
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


  return { favorites, isFavorite, addFavorite, removeFavorite, toggleFavorite };
};
