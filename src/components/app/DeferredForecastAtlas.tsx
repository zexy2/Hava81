import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ForecastAtlasProps } from '../hava81/ForecastAtlas';
import { ForecastLoadingCard } from './AppSkeletons';

const ForecastAtlas = lazy(async () => {
  const module = await import('../hava81/ForecastAtlas');
  return { default: module.ForecastAtlas };
});

/**
 * Keep the detailed hourly chart off the initial mobile render when it sits below
 * the fold. Its accessible placeholder reserves the forecast slot; the real chart
 * and its CSS are loaded when the section approaches the viewport or is interacted
 * with. Desktop layouts that show the forecast beside the hero load it immediately.
 */
export function DeferredForecastAtlas(props: ForecastAtlasProps) {
  const { t } = useTranslation();
  const [isNearViewport, setIsNearViewport] = useState(false);
  const placeholderRef = useRef<HTMLElement>(null);
  const activate = useCallback(() => setIsNearViewport(true), []);

  useEffect(() => {
    if (isNearViewport) return undefined;

    const target = placeholderRef.current;
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
      { rootMargin: '120px 0px' }
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [isNearViewport]);

  if (!isNearViewport) {
    return (
      <ForecastLoadingCard
        title={t('hava81.forecastAtlas.title')}
        label={t('hava81.forecastAtlas.deferred')}
        anchorRef={placeholderRef}
        onActivate={activate}
        reserveLoadedHeight
      />
    );
  }

  return (
    <Suspense
      fallback={
        <ForecastLoadingCard
          title={t('hava81.forecastAtlas.title')}
          label={t('common.loading')}
          reserveLoadedHeight
        />
      }
    >
      <ForecastAtlas {...props} />
    </Suspense>
  );
}
