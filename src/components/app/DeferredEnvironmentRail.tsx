import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AirQuality, NormalizedWeatherData } from '../../types';

const EnvironmentRail = lazy(async () => {
  const module = await import('../hava81/EnvironmentRail');
  return { default: module.EnvironmentRail };
});

interface Props {
  weather: NormalizedWeatherData;
  airQuality?: AirQuality;
  onOpenMap: () => void;
  mapExpanded: boolean;
}

/**
 * Keep secondary daylight/wind/air-quality/map cards off the initial render.
 * Reserve their responsive footprint, then load the real data view as it enters
 * the viewport or when a keyboard/pointer user reaches the accessible slot.
 */
export function DeferredEnvironmentRail(props: Props) {
  const { t } = useTranslation();
  const [isNearViewport, setIsNearViewport] = useState(false);
  const slotRef = useRef<HTMLDivElement>(null);
  const activate = useCallback(() => setIsNearViewport(true), []);
  const sectionLabel = [
    t('daylight.title'),
    t('weather.wind'),
    t('weather.airQuality'),
    t('common.map'),
  ].join(', ');

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
      { rootMargin: '0px' }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [isNearViewport]);

  return (
    <div
      ref={slotRef}
      className={
        isNearViewport
          ? 'atlas-deferred-environment-slot atlas-deferred-environment-slot--ready'
          : 'atlas-deferred-environment-slot'
      }
      role={isNearViewport ? undefined : 'region'}
      aria-label={isNearViewport ? undefined : sectionLabel}
      aria-busy={isNearViewport ? undefined : true}
      tabIndex={isNearViewport ? undefined : 0}
      onPointerDown={activate}
      onFocusCapture={activate}
    >
      {!isNearViewport ? (
        <div className="atlas-deferred-environment-placeholder" role="status" aria-live="polite">
          {t('common.loading')}
        </div>
      ) : (
        <Suspense
          fallback={
            <div className="atlas-deferred-environment-placeholder" role="status" aria-live="polite">
              {t('common.loading')}
            </div>
          }
        >
          <EnvironmentRail {...props} />
        </Suspense>
      )}
    </div>
  );
}

export default DeferredEnvironmentRail;
