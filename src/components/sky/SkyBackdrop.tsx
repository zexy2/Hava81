import { lazy, memo, Suspense, useEffect, useMemo, useState } from 'react';
import type { HourlyForecast, NormalizedWeatherData } from '../../types';
import { resolveSkyScene } from './skyScene';

const LivingSky = lazy(() => import('./LivingSky'));

interface SkyBackdropProps {
  weather: NormalizedWeatherData;
  hourly: HourlyForecast[];
}

/**
 * Keeps the once-a-minute sky phase clock out of App's render tree. The backdrop needs a
 * fresh scene at dawn/dusk, but ticking that clock at the app root needlessly rerenders the
 * header, navigation, forecast and every decision panel (even on the empty home route).
 */
function SkyBackdropComponent({ weather, hourly }: SkyBackdropProps) {
  const [clock, setClock] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const scene = useMemo(() => resolveSkyScene(weather, hourly, clock), [clock, hourly, weather]);

  return (
    <Suspense fallback={null}>
      <LivingSky scene={scene} />
    </Suspense>
  );
}

export const SkyBackdrop = memo(SkyBackdropComponent);
