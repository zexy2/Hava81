import { useEffect, useMemo, useRef, useState } from 'react';
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
const SERVICE_WORKER_READY_TIMEOUT_MS = 5_000;
const NOTIFICATION_DELIVERY_TIMEOUT_MS = 5_000;

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Timed out waiting for notification delivery')), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
};
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
const getLocationDateKey = (timezoneOffsetSeconds = 0) =>
  new Date(Date.now() + timezoneOffsetSeconds * 1000).toISOString().slice(0, 10);

const inQuietHours = (timezoneOffsetSeconds = 0) => {
  const locationNow = new Date(Date.now() + timezoneOffsetSeconds * 1000);
  const hour = locationNow.getUTCHours();
  return hour >= 22 || hour < 7;
};

export function DecisionAlertsPanel({ weather, hourly, airQuality }: Props) {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(readEnabled);
  const [requestingPermission, setRequestingPermission] = useState(false);
  const notificationsSupported = typeof Notification !== 'undefined';
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    notificationsSupported ? Notification.permission : 'default'
  );
  const sessionSentKeys = useRef(new Set<string>());
  const sessionPendingKeys = useRef(new Set<string>());
  const permissionRequestInFlight = useRef(false);
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
    const day = getLocationDateKey(weather.meta.timezoneOffsetSeconds);
    const key = `hava81-alert-sent:${day}:${candidate.signature}`;
    if (sessionSentKeys.current.has(key) || sessionPendingKeys.current.has(key)) return;
    const sentMarker = readStorage(key);
    if (sentMarker === undefined || sentMarker) return;
    sessionPendingKeys.current.add(key);
    const alertData = {
      ...candidate.data,
      band: t(`hava81.dailyPlan.bands.${plan.band}`),
    };
    const title = t(candidate.titleKey, alertData);
    const body = t(candidate.bodyKey, alertData);
    void (async () => {
      try {
        if ('serviceWorker' in navigator) {
          const registration = await withTimeout(
            navigator.serviceWorker.ready,
            SERVICE_WORKER_READY_TIMEOUT_MS
          );
          await withTimeout(
            registration.showNotification(title, {
              body,
              tag: candidate.signature,
              data: { url: window.location.href },
            }),
            NOTIFICATION_DELIVERY_TIMEOUT_MS
          );
        } else {
          new Notification(title, { body, tag: candidate.signature });
        }
        sessionSentKeys.current.add(key);
        writeStorage(key, '1');
      } catch {
        // Notifications are optional; failure must never block weather data or suppress a later retry.
      } finally {
        sessionPendingKeys.current.delete(key);
      }
    })();
  }, [candidate, enabled, permission, plan.band, t, weather.meta.timezoneOffsetSeconds]);

  const toggle = async () => {
    if (permissionRequestInFlight.current) return;
    if (enabled) {
      removeStorage(SETTINGS_KEY);
      setEnabled(false);
      return;
    }
    if (typeof Notification === 'undefined') return;
    permissionRequestInFlight.current = true;
    setRequestingPermission(true);
    try {
      const next = await Notification.requestPermission();
      setPermission(next);
      if (next === 'granted' && writeStorage(SETTINGS_KEY, 'enabled')) {
        setEnabled(true);
        trackProductEvent('alert_opt_in', { granted: true });
      }
    } catch {
      // Permission prompts are optional; keep alerts disabled if the browser rejects the request.
    } finally {
      permissionRequestInFlight.current = false;
      setRequestingPermission(false);
    }
  };

  const permissionHelpId =
    !notificationsSupported || permission === 'denied'
      ? 'decision-alerts-permission-help'
      : undefined;

  return (
    <section className="decision-alerts" aria-labelledby="decision-alerts-title">
      <div>
        <span className="atlas-kicker">{t('hava81.alerts.eyebrow')}</span>
        <h2 id="decision-alerts-title">{t('hava81.alerts.title')}</h2>
        <p>{t('hava81.alerts.description')}</p>
        <small>{t('hava81.alerts.quietHours')}</small>
        <small className="decision-alerts__modeled-note">
          {t('hava81.alerts.modeledDisclosure')}
        </small>
        {!notificationsSupported ? (
          <small
            id="decision-alerts-permission-help"
            className="decision-alerts__permission-help"
            role="status"
          >
            {t('hava81.alerts.unsupportedHelp')}
          </small>
        ) : permission === 'denied' ? (
          <small
            id="decision-alerts-permission-help"
            className="decision-alerts__permission-help"
            role="status"
          >
            {t('hava81.alerts.blockedHelp')}
          </small>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => void toggle()}
        aria-pressed={enabled}
        aria-describedby={permissionHelpId}
        aria-busy={requestingPermission}
        disabled={requestingPermission || (!enabled && (!notificationsSupported || permission === 'denied'))}
      >
        {requestingPermission
          ? t('common.loading')
          : enabled
            ? t('hava81.alerts.disable')
          : !notificationsSupported
            ? t('hava81.alerts.unsupported')
            : permission === 'denied'
              ? t('hava81.alerts.blocked')
              : t('hava81.alerts.enable')}
      </button>
    </section>
  );
}

export default DecisionAlertsPanel;
