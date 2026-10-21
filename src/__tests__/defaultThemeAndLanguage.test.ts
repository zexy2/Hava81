import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { detectBrowserLanguage } from '../i18n/detectLanguage';

describe('device-aware defaults (Faz 0.7)', () => {
  it('defaults the theme to auto so dark-mode devices open dark', () => {
    const source = readFileSync('src/context/SettingsContext.tsx', 'utf8');
    expect(source).toMatch(/const defaultSettings[\s\S]*?themeMode:\s*'auto'/);
  });

  it('picks the first supported browser language', () => {
    expect(detectBrowserLanguage(['en-US', 'tr'])).toBe('en');
    expect(detectBrowserLanguage(['de-DE', 'tr-TR', 'en'])).toBe('tr');
    expect(detectBrowserLanguage(['de-DE', 'en-GB'])).toBe('en');
    expect(detectBrowserLanguage(['fr'])).toBe('tr');
    expect(detectBrowserLanguage([])).toBe('tr');
  });
});
