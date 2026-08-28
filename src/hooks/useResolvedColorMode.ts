import { useEffect, useState } from 'react';
import type { ThemeMode } from '../context/SettingsContext';

export type ResolvedColorMode = 'light' | 'dark';

const getSystemColorMode = (): ResolvedColorMode => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

export function useResolvedColorMode(themeMode: ThemeMode): ResolvedColorMode {
  const [systemColorMode, setSystemColorMode] = useState<ResolvedColorMode>(getSystemColorMode);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const update = (event?: MediaQueryListEvent) => {
      setSystemColorMode(event ? (event.matches ? 'dark' : 'light') : media.matches ? 'dark' : 'light');
    };

    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return themeMode === 'auto' ? systemColorMode : themeMode;
}
