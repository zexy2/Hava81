import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import i18n from '../../i18n';
import { SettingsProvider, useSettings } from '../../context/SettingsContext';

const wrapper = ({ children }: { children: ReactNode }) => (
  <SettingsProvider>{children}</SettingsProvider>
);

describe('SettingsProvider legacy language migration', () => {
  beforeEach(() => localStorage.clear());
  afterEach(async () => {
    localStorage.clear();
    await i18n.changeLanguage('tr');
  });

  it('uses the initialized i18n language when canonical settings are absent', async () => {
    await i18n.changeLanguage('en');

    const { result } = renderHook(() => useSettings(), { wrapper });

    expect(result.current.settings.language).toBe('en');
  });

  it('uses the initialized i18n language when persisted language is invalid', async () => {
    await i18n.changeLanguage('en');
    localStorage.setItem('user-settings', JSON.stringify({ language: 'de', themeMode: 'dark' }));

    const { result } = renderHook(() => useSettings(), { wrapper });

    expect(result.current.settings.language).toBe('en');
    expect(result.current.settings.themeMode).toBe('dark');
  });
});
