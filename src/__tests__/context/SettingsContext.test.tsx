import { renderHook } from '@testing-library/react';
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
