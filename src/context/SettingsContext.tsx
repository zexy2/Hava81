import React, { createContext, useContext, useCallback, useMemo } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';

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
  const [settings, setSettings] = useLocalStorage<UserSettings>('user-settings', defaultSettings);

  const updateSetting = useCallback(
    <K extends keyof UserSettings>(key: K, value: UserSettings[K]) => {
      setSettings(prev => ({ ...prev, [key]: value }));
    },
    [setSettings]
  );

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
