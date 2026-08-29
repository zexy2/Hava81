import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useFavorites } from '../../hooks/useFavorites';
import type { NormalizedWeatherData } from '../../types';

const weatherFor = (cityName: string) =>
  ({
    cityName,
    coordinates: { lat: 41.01, lon: 28.97 },
    temperature: 20,
    icon: '01d',
  }) as NormalizedWeatherData;

describe('useFavorites', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('keeps one favorite when provider language changes the city spelling', () => {
    localStorage.setItem(
      'favorites',
      JSON.stringify([{ name: 'İstanbul', lat: 41.01, lon: 28.97, temp: 20, icon: '01d' }])
    );

    const { result, rerender } = renderHook(({ weather }) => useFavorites(weather), {
      initialProps: { weather: weatherFor('İstanbul') },
    });

    expect(result.current.isFavorite).toBe(true);

    rerender({ weather: weatherFor('Istanbul') });
    expect(result.current.isFavorite).toBe(true);

    act(() => result.current.addFavorite());
    expect(result.current.favorites).toHaveLength(1);

    act(() => result.current.removeFavorite('Istanbul'));
    expect(result.current.favorites).toEqual([]);
  });

  it('writes favorites with canonical province identity and coordinates', () => {
    const { result } = renderHook(() => useFavorites(weatherFor('Istanbul')));

    act(() => result.current.addFavorite());

    expect(result.current.favorites).toEqual([
      { name: 'İstanbul', lat: 41.01, lon: 28.97, temp: 20, icon: '01d' },
    ]);
  });

  it('does not write an unsupported provider city as a favorite', () => {
    const { result } = renderHook(() => useFavorites(weatherFor('Atlantis')));

    act(() => result.current.addFavorite());

    expect(result.current.favorites).toEqual([]);
    expect(localStorage.getItem('favorites')).toBeNull();
  });

  it('sanitizes malformed, duplicate and unsupported persisted favorites', () => {
    localStorage.setItem(
      'favorites',
      JSON.stringify([
        { name: 'Istanbul', lat: 0, lon: 0, temp: 21.4, icon: '01d', injected: '<script>' },
        { name: 'İstanbul', lat: 99, lon: 28.97, temp: 99, icon: '01d' },
        { name: 'Ankara', lat: 0, lon: 0, temp: 'hot', icon: '99d' },
        { name: 'London', lat: 51.5, lon: -0.1, temp: 12, icon: '04d' },
        { name: 123, lat: 1, lon: 2 },
        null,
      ])
    );

    const { result } = renderHook(() => useFavorites(null));

    expect(result.current.favorites).toEqual([
      { name: 'İstanbul', lat: 41.01, lon: 28.97, temp: 21.4, icon: '01d' },
      { name: 'Ankara', lat: 39.93, lon: 32.86 },
    ]);
  });

  it('degrades a wrong-shape persisted favorites payload to an empty list', () => {
    localStorage.setItem('favorites', JSON.stringify({ name: 'İstanbul' }));

    const { result } = renderHook(() => useFavorites(null));

    expect(result.current.favorites).toEqual([]);
  });
});
