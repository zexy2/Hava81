import { renderHook } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { SettingsProvider, useSettings } from '../context/SettingsContext';
import { detectBrowserLanguage } from '../i18n/detectLanguage';

describe('device-aware defaults (Faz 0.7)', () => {
  it('defaults the theme to auto so dark-mode devices open dark', () => {
    localStorage.clear();
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(SettingsProvider, null, children);
    const { result } = renderHook(() => useSettings(), { wrapper });
    expect(result.current.settings.themeMode).toBe('auto');
  });

  it('picks the first supported browser language', () => {
    expect(detectBrowserLanguage(['en-US', 'tr'])).toBe('en');
    expect(detectBrowserLanguage(['de-DE', 'tr-TR', 'en'])).toBe('tr');
    expect(detectBrowserLanguage(['de-DE', 'en-GB'])).toBe('en');
    expect(detectBrowserLanguage(['fr'])).toBe('tr');
    expect(detectBrowserLanguage([])).toBe('tr');
  });
});
