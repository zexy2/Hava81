import { useEffect, useState } from 'react';
import type { ForecastMeta } from '../../../types';
import { getForecastFreshness } from '../../../utils/forecastFreshness';
import { HOUR_MS } from './constants';

/**
 * Keeps the Forecast Atlas in step with the clock: "now" moves on at each
 * location-local hour (and when the tab becomes visible again), and the
 * freshness verdict is re-read the moment the forecast expires.
 */
export function useForecastClock(meta: ForecastMeta) {
  const timezoneOffsetMs = meta.timezoneOffsetSeconds * 1000;
  const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now());
  const [, setFreshnessRevision] = useState(0);
  const forecastFreshness = getForecastFreshness(meta);

  useEffect(() => {
    let timerId: number | undefined;
    const scheduleCurrentHourRefresh = () => {
      const now = Date.now();
      setCurrentTimeMs(now);
      const locationClockMs = now + timezoneOffsetMs;
      const elapsedInHour = ((locationClockMs % HOUR_MS) + HOUR_MS) % HOUR_MS;
      const delay = HOUR_MS - elapsedInHour + 100;
      timerId = window.setTimeout(scheduleCurrentHourRefresh, delay);
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (timerId !== undefined) window.clearTimeout(timerId);
      scheduleCurrentHourRefresh();
    };

    scheduleCurrentHourRefresh();
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      if (timerId !== undefined) window.clearTimeout(timerId);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [timezoneOffsetMs]);
  useEffect(() => {
    const resyncFreshness = () => setFreshnessRevision(revision => revision + 1);
    const timerId =
      forecastFreshness.expiresInMs === null
        ? undefined
        : window.setTimeout(resyncFreshness, forecastFreshness.expiresInMs);
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') resyncFreshness();
    };

    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      if (timerId !== undefined) window.clearTimeout(timerId);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [forecastFreshness.expiresInMs, meta]);

  return { currentTimeMs, forecastFreshness, timezoneOffsetMs };
}
