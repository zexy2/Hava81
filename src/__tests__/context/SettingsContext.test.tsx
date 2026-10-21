import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { SettingsProvider, useSettings } from '../../context/SettingsContext';

const wrapper = ({ children }: { children: ReactNode }) => (
  <SettingsProvider>{children}</SettingsProvider>
);

describe('SettingsProvider persisted settings', () => {
  beforeEach(() => localStorage.clear());

  it('fills missing and invalid persisted fields with safe defaults', () => {
    localStorage.setItem(
      'user-settings',
      JSON.stringify({
        temperatureUnit: 'imperial',
        windSpeedUnit: 'knots',
        themeMode: null,
        language: 'de',
        unexpected: 'ignored',
      })
    );

    const { result } = renderHook(() => useSettings(), { wrapper });

    expect(result.current.settings).toEqual({
      temperatureUnit: 'imperial',
      windSpeedUnit: 'ms',
      themeMode: 'auto',
      language: 'tr',
    });
  });

  it('rejects invalid live setting values before state or storage mutation', () => {
    const { result } = renderHook(() => useSettings(), { wrapper });
    const unsafeUpdate = result.current.updateSetting as (
      key: 'temperatureUnit' | 'windSpeedUnit' | 'themeMode' | 'language',
      value: unknown
    ) => void;

    act(() => {
      unsafeUpdate('temperatureUnit', 'kelvin');
      unsafeUpdate('windSpeedUnit', 'knots');
      unsafeUpdate('themeMode', 'sepia');
      unsafeUpdate('language', 'de');
    });

    expect(result.current.settings).toEqual({
      temperatureUnit: 'metric',
      windSpeedUnit: 'ms',
      themeMode: 'auto',
      language: 'tr',
    });
    expect(localStorage.getItem('user-settings')).toBeNull();

    act(() => {
      result.current.updateSetting('temperatureUnit', 'imperial');
    });

    expect(result.current.settings.temperatureUnit).toBe('imperial');
    expect(JSON.parse(localStorage.getItem('user-settings') ?? 'null')).toMatchObject({
      temperatureUnit: 'imperial',
    });
  });

  it('preserves a complete valid persisted settings object', () => {
    localStorage.setItem(
      'user-settings',
      JSON.stringify({
        temperatureUnit: 'imperial',
        windSpeedUnit: 'mph',
        themeMode: 'dark',
        language: 'en',
      })
    );

    const { result } = renderHook(() => useSettings(), { wrapper });

    expect(result.current.settings).toEqual({
      temperatureUnit: 'imperial',
      windSpeedUnit: 'mph',
      themeMode: 'dark',
      language: 'en',
    });
  });
});
