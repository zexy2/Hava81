import { lazy, Suspense, useCallback, useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  AirQuality,
  AirQualityHourly,
  ForecastMeta,
  HourlyForecast,
  NormalizedWeatherData,
} from '../../types';

const DecisionAlertsPanel = lazy(async () => {
  const module = await import('../hava81/DecisionAlertsPanel');
  return { default: module.DecisionAlertsPanel };
});

interface Props {
  weather: NormalizedWeatherData;
  hourly: HourlyForecast[];
  airQuality?: AirQuality;
  airQualityHourly?: AirQualityHourly;
  forecastMeta: ForecastMeta | null;
}

/**
 * Keep optional notification logic off the initial weather render. The panel
 * loads as it approaches the viewport, or when a keyboard/pointer user reaches
 * its accessible placeholder. The reserved slot prevents an avoidable jump.
 */
export function DeferredDecisionAlertsPanel(props: Props) {
  const { t } = useTranslation();
  const titleId = useId();
  const [isNearViewport, setIsNearViewport] = useState(false);
  const slotRef = useRef<HTMLDivElement>(null);
  const activate = useCallback(() => setIsNearViewport(true), []);

  useEffect(() => {
    if (isNearViewport) return undefined;

    const target = slotRef.current;
    if (!target) return undefined;

    if (typeof window.IntersectionObserver !== 'function') {
      setIsNearViewport(true);
      return undefined;
    }

    const observer = new window.IntersectionObserver(
      entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        setIsNearViewport(true);
        observer.disconnect();
      },
      { rootMargin: '320px 0px' }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [isNearViewport]);

  return (
    <div
      ref={slotRef}
      className="atlas-deferred-alerts-slot"
      role={isNearViewport ? undefined : 'region'}
      aria-label={isNearViewport ? undefined : t('hava81.alerts.title')}
      aria-busy={isNearViewport ? undefined : true}
      tabIndex={isNearViewport ? undefined : 0}
      onPointerDown={activate}
      onFocusCapture={activate}
    >
      {!isNearViewport ? (
        <section
          className="atlas-deferred-alerts-placeholder"
          role="status"
          aria-live="polite"
          aria-labelledby={titleId}
        >
          <span className="atlas-kicker">{t('hava81.alerts.eyebrow')}</span>
          <h2 id={titleId}>{t('hava81.alerts.title')}</h2>
          <p>{t('common.loading')}</p>
        </section>
      ) : (
        <Suspense
          fallback={
            <section className="atlas-deferred-alerts-placeholder" role="status" aria-live="polite">
              <p>{t('common.loading')}</p>
            </section>
          }
        >
          <DecisionAlertsPanel {...props} />
        </Suspense>
      )}
    </div>
  );
}

export default DeferredDecisionAlertsPanel;
