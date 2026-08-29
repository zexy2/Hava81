import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { trackProductEvent } from '../../analytics/productEvents';
import { buildAlertCandidate } from '../../domain/alerts/buildAlertCandidate';
import { buildDailyPlan } from '../../domain/decision/buildDailyPlan';
import type { AirQuality, HourlyForecast, NormalizedWeatherData } from '../../types';
import './DecisionAlertsPanel.css';

interface Props {
  weather: NormalizedWeatherData;
  hourly: HourlyForecast[];
  airQuality?: AirQuality;
}
const SETTINGS_KEY = 'hava81-alerts-v1';
const readStorage = (key: string): string | null | undefined => {
  try {
    return localStorage.getItem(key);
  } catch {
    return undefined;
  }
};
const writeStorage = (key: string, value: string): boolean => {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};
const removeStorage = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch {
    // Alerts are optional; current-session state can still be disabled.
  }
};
const readEnabled = () => readStorage(SETTINGS_KEY) === 'enabled';
const inQuietHours = (timezoneOffsetSeconds = 0) => {
  const locationNow = new Date(Date.now() + timezoneOffsetSeconds * 1000);
  const hour = locationNow.getUTCHours();
  return hour >= 22 || hour < 7;
};

export function DecisionAlertsPanel({ weather, hourly, airQuality }: Props) {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(readEnabled);
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    typeof Notification === 'undefined' ? 'denied' : Notification.permission
  );
  const plan = useMemo(
    () => buildDailyPlan({ weather, hourly, airQuality }),
    [weather, hourly, airQuality]
  );
  const candidate = useMemo(
    () => buildAlertCandidate(weather.cityName, plan),
    [plan, weather.cityName]
  );

  useEffect(() => {
    if (
      !enabled ||
      permission !== 'granted' ||
      !candidate ||
      inQuietHours(weather.meta.timezoneOffsetSeconds)
    )
      return;
    const day = new Date().toISOString().slice(0, 10);
    const key = `hava81-alert-sent:${day}:${candidate.signature}`;
    const sentMarker = readStorage(key);
    if (sentMarker === undefined || sentMarker) return;
    const title = t(candidate.titleKey, candidate.data);
    const body = t(candidate.bodyKey, candidate.data);
    void (async () => {
      try {
        if ('serviceWorker' in navigator) {
          const registration = await navigator.serviceWorker.ready;
          await registration.showNotification(title, {
            body,
            tag: candidate.signature,
            data: { url: window.location.href },
          });
        } else {
          new Notification(title, { body, tag: candidate.signature });
        }
        writeStorage(key, '1');
      } catch {
        // Notifications are optional; failure must never block weather data or suppress a later retry.
      }
    })();
  }, [candidate, enabled, permission, t, weather.meta.timezoneOffsetSeconds]);

  const toggle = async () => {
    if (enabled) {
      removeStorage(SETTINGS_KEY);
      setEnabled(false);
      return;
    }
    if (typeof Notification === 'undefined') return;
    const next = await Notification.requestPermission();
    setPermission(next);
    if (next === 'granted') {
      if (writeStorage(SETTINGS_KEY, 'enabled')) {
        setEnabled(true);
        trackProductEvent('alert_opt_in', { granted: true });
      }
    }
  };

  return (
    <section className="decision-alerts" aria-labelledby="decision-alerts-title">
      <div>
        <span className="atlas-kicker">{t('hava81.alerts.eyebrow')}</span>
        <h2 id="decision-alerts-title">{t('hava81.alerts.title')}</h2>
        <p>{t('hava81.alerts.description')}</p>
        <small>{t('hava81.alerts.quietHours')}</small>
      </div>
      <button
        type="button"
        onClick={() => void toggle()}
        aria-pressed={enabled}
        disabled={!enabled && (typeof Notification === 'undefined' || permission === 'denied')}
      >
        {enabled
          ? t('hava81.alerts.disable')
          : permission === 'denied'
            ? t('hava81.alerts.blocked')
            : t('hava81.alerts.enable')}
      </button>
    </section>
  );
}

export default DecisionAlertsPanel;
