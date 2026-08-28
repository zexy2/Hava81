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
const readEnabled = () => {
  try {
    return localStorage.getItem(SETTINGS_KEY) === 'enabled';
  } catch {
    return false;
  }
};
const inQuietHours = () => {
  const hour = new Date().getHours();
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
    if (!enabled || permission !== 'granted' || !candidate || inQuietHours()) return;
    const day = new Date().toISOString().slice(0, 10);
    const key = `hava81-alert-sent:${day}:${candidate.signature}`;
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');
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
      } catch {
        // Notifications are optional; failure must never block weather data.
      }
    })();
  }, [candidate, enabled, permission, t]);

  const toggle = async () => {
    if (enabled) {
      localStorage.removeItem(SETTINGS_KEY);
      setEnabled(false);
      return;
    }
    if (typeof Notification === 'undefined') return;
    const next = await Notification.requestPermission();
    setPermission(next);
    if (next === 'granted') {
      localStorage.setItem(SETTINGS_KEY, 'enabled');
      setEnabled(true);
      trackProductEvent('alert_opt_in', { granted: true });
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
        disabled={typeof Notification === 'undefined'}
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
