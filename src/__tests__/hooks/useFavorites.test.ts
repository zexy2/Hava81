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
});
