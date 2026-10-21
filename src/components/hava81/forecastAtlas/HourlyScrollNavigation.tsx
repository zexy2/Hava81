import { useTranslation } from 'react-i18next';
import type { ForecastAtlasClock, HourlyDatum } from './types';
import type { HourlyScrollState, VisibleHourWindow } from './useHourlyViewport';

interface HourlyScrollNavigationProps {
  /** Forecast Atlas instance id (from `useId`). */
  id: string;
  hourlyData: readonly HourlyDatum[];
  hourlyScroll: HourlyScrollState;
  visibleWindow: VisibleHourWindow | null;
  clock: ForecastAtlasClock;
  onScroll: (direction: -1 | 1) => void;
}

/** "Showing 15:00-20:00" status, progress bar and previous/next buttons. */
export function HourlyScrollNavigation({
  id,
  hourlyData,
  hourlyScroll,
  visibleWindow,
  clock,
  onScroll,
}: HourlyScrollNavigationProps) {
  const { t } = useTranslation();
  const { atLocationTime, hourTileFormatter } = clock;

  return (
    <div
      className="hava81-forecast-atlas__scroll-navigation"
      role="group"
      aria-label={t('hava81.forecastAtlas.scrollNavigation')}
    >
      <div className="hava81-forecast-atlas__scroll-status">
        <span className="hava81-forecast-atlas__scroll-hint">
          {visibleWindow && hourlyData[visibleWindow.from] && hourlyData[visibleWindow.to]
            ? t('hava81.forecastAtlas.visibleWindow', {
                from: hourTileFormatter.format(atLocationTime(hourlyData[visibleWindow.from].time)),
                to: hourTileFormatter.format(atLocationTime(hourlyData[visibleWindow.to].time)),
                shown: visibleWindow.to - visibleWindow.from + 1,
                total: hourlyData.length,
              })
            : t('hava81.forecastAtlas.scrollHint')}
        </span>
        {visibleWindow ? (
          <span className="hava81-forecast-atlas__scroll-progress" aria-hidden="true">
            <span
              style={{
                left: `${visibleWindow.start}%`,
                width: `${Math.max(6, visibleWindow.size)}%`,
              }}
            />
          </span>
        ) : null}
      </div>
      <div className="hava81-forecast-atlas__scroll-actions">
        <button
          type="button"
          aria-controls={`${id}-hourly-viewport`}
          aria-label={t('hava81.forecastAtlas.scrollPrevious')}
          disabled={!hourlyScroll.canGoBack}
          onClick={() => onScroll(-1)}
        >
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
            <path d="M12.5 4.5 7 10l5.5 5.5" />
          </svg>
        </button>
        <button
          type="button"
          aria-controls={`${id}-hourly-viewport`}
          aria-label={t('hava81.forecastAtlas.scrollNext')}
          disabled={!hourlyScroll.canGoForward}
          onClick={() => onScroll(1)}
        >
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
            <path d="M7.5 4.5 13 10l-5.5 5.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
