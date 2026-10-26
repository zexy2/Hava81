import React, { createContext, useContext, useCallback, useLayoutEffect, useMemo } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import i18n from '../i18n';

export type TemperatureUnit = 'metric' | 'imperial';
export type WindSpeedUnit = 'ms' | 'kmh' | 'mph';
export type ThemeMode = 'auto' | 'light' | 'dark';
export type Language = 'tr' | 'en';

export interface UserSettings {
  temperatureUnit: TemperatureUnit;
  windSpeedUnit: WindSpeedUnit;
  themeMode: ThemeMode;
  language: Language;
}

const defaultSettings: UserSettings = {
  temperatureUnit: 'metric',
  windSpeedUnit: 'ms',
  themeMode: 'auto',
  language: 'tr',
};

const isTemperatureUnit = (value: unknown): value is TemperatureUnit =>
  value === 'metric' || value === 'imperial';
const isWindSpeedUnit = (value: unknown): value is WindSpeedUnit =>
  value === 'ms' || value === 'kmh' || value === 'mph';
const isThemeMode = (value: unknown): value is ThemeMode =>
  value === 'auto' || value === 'light' || value === 'dark';
const isLanguage = (value: unknown): value is Language => value === 'tr' || value === 'en';

const isValidSettingValue = (key: keyof UserSettings, value: unknown): boolean => {
  switch (key) {
    case 'temperatureUnit':
      return isTemperatureUnit(value);
    case 'windSpeedUnit':
      return isWindSpeedUnit(value);
    case 'themeMode':
      return isThemeMode(value);
    case 'language':
      return isLanguage(value);
  }
};

const deserializeSettings = (serialized: string, fallback: UserSettings): UserSettings => {
  const parsed = JSON.parse(serialized) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return fallback;

  const candidate = parsed as Partial<Record<keyof UserSettings, unknown>>;
  return {
    temperatureUnit: isTemperatureUnit(candidate.temperatureUnit)
      ? candidate.temperatureUnit
      : fallback.temperatureUnit,
    windSpeedUnit: isWindSpeedUnit(candidate.windSpeedUnit)
      ? candidate.windSpeedUnit
      : fallback.windSpeedUnit,
    themeMode: isThemeMode(candidate.themeMode) ? candidate.themeMode : fallback.themeMode,
    language: isLanguage(candidate.language) ? candidate.language : fallback.language,
  };
};

interface SettingsContextType {
  settings: UserSettings;
  updateSetting: <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => void;
  resetSettings: () => void;
  convertTemperature: (celsius: number) => number;
  convertWindSpeed: (metersPerSecond: number) => number;
  getTemperatureSymbol: () => string;
  getWindSpeedSymbol: () => string;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialSettings = useMemo<UserSettings>(
    () => ({
      ...defaultSettings,
      language: i18n.resolvedLanguage === 'en' ? 'en' : 'tr',
    }),
    []
  );
  const deserializePersistedSettings = useCallback(
    (serialized: string) => deserializeSettings(serialized, initialSettings),
    [initialSettings]
  );
  const transformInitialSettings = useCallback((value: UserSettings): UserSettings => {
    // The English URL is authoritative on first render. Applying this only while
    // hydrating persisted state avoids starting a Turkish weather request before
    // the mount-only layout effect can reconcile the stored preference.
    if (/^\/en(\/|$)/.test(window.location.pathname) && value.language !== 'en') {
      return { ...value, language: 'en' };
    }
    return value;
  }, []);
  const [settings, setSettings] = useLocalStorage<UserSettings>('user-settings', initialSettings, {
    deserializer: deserializePersistedSettings,
    transformInitialValue: transformInitialSettings,
  });

  const updateSetting = useCallback(
    <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
      if (!isValidSettingValue(key, value)) return;
      setSettings(prev => ({ ...prev, [key]: value }));
    },
    [setSettings]
  );

  // Faz 4: an /en/ URL is the English edition; adopt it as the language choice.
  useLayoutEffect(() => {
    if (!/^\/en(\/|$)/.test(window.location.pathname)) return;

    if (settings.language !== 'en') {
      updateSetting('language', 'en');
      return;
    }

    // The initial transform intentionally avoids a wrong-language first render.
    // Persist the same URL-authoritative choice as the previous mount-only effect,
    // but never apply that override to later live storage events/user changes.
    try {
      const serialized = window.localStorage.getItem('user-settings');
      if (
        serialized &&
        (JSON.parse(serialized) as { language?: unknown }).language === 'tr'
      ) {
        updateSetting('language', 'en');
      }
    } catch {
      // State is already correct for the route; storage may be unavailable.
    }
    // Only on mount: switching language later rewrites the URL instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(defaultSettings);
  }, [setSettings]);

  const convertTemperature = useCallback(
    (celsius: number): number => {
      if (settings.temperatureUnit === 'imperial') {
        return Math.round((celsius * 9) / 5 + 32);
      }
      return celsius;
    },
    [settings.temperatureUnit]
  );

  const convertWindSpeed = useCallback(
    (metersPerSecond: number): number => {
      switch (settings.windSpeedUnit) {
        case 'kmh':
          return Math.round(metersPerSecond * 3.6);
        case 'mph':
          return Math.round(metersPerSecond * 2.237);
        default:
          return Math.round(metersPerSecond * 10) / 10;
      }
    },
    [settings.windSpeedUnit]
  );

  const getTemperatureSymbol = useCallback((): string => {
    return settings.temperatureUnit === 'imperial' ? '°F' : '°C';
  }, [settings.temperatureUnit]);

  const getWindSpeedSymbol = useCallback((): string => {
    switch (settings.windSpeedUnit) {
      case 'kmh':
        return 'km/h';
      case 'mph':
        return 'mph';
      default:
        return 'm/s';
    }
  }, [settings.windSpeedUnit]);

  const value = useMemo(
    () => ({
      settings,
      updateSetting,
      resetSettings,
      convertTemperature,
      convertWindSpeed,
      getTemperatureSymbol,
      getWindSpeedSymbol,
    }),
    [
      settings,
      updateSetting,
      resetSettings,
      convertTemperature,
      convertWindSpeed,
      getTemperatureSymbol,
      getWindSpeedSymbol,
    ]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};

export default SettingsContext;
