import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useRangeIndicator } from './useRangeIndicator';

interface IntervalSelectorProps {
  /** Forecast Atlas instance id (from `useId`), shared with the section ids. */
  id: string;
  options: readonly number[];
  displayIntervalHours: number;
  onSelect: (hours: number) => void;
}

/** "Every 1h / 2h / 3h…" display-interval buttons with a sliding selection. */
export function IntervalSelector({
  id,
  options,
  displayIntervalHours,
  onSelect,
}: IntervalSelectorProps) {
  const { t } = useTranslation();
  const rangeRef = useRef<HTMLDivElement>(null);
  const rangeIndicator = useRangeIndicator(rangeRef, options.length, displayIntervalHours);

  return (
    <div className="hava81-forecast-atlas__interval-control">
      <span id={`${id}-interval-label`} className="hava81-forecast-atlas__range-label">
        {t('hava81.forecastAtlas.intervalControlLabel')}
      </span>
      <small id={`${id}-interval-help`} className="hava81-forecast-atlas__range-help">
        {t('hava81.forecastAtlas.intervalControlHelp')}
      </small>
      <div
        ref={rangeRef}
        className="hava81-forecast-atlas__range"
        role="group"
        aria-labelledby={`${id}-interval-label`}
        aria-describedby={`${id}-interval-help`}
        data-indicator={rangeIndicator ? 'ready' : undefined}
      >
        {rangeIndicator ? (
          <span
            className={`hava81-forecast-atlas__range-indicator${
              rangeIndicator.animate ? ' is-animated' : ''
            }`}
            aria-hidden="true"
            style={{
              width: `${rangeIndicator.width}px`,
              height: `${rangeIndicator.height}px`,
              transform: `translate(${rangeIndicator.x}px, ${rangeIndicator.y}px)`,
            }}
          />
        ) : null}
        {options.map(hours => (
          <button
            key={hours}
            type="button"
            className="hava81-forecast-atlas__range-button"
            aria-label={[
              t('hava81.forecastAtlas.intervalOptionCompact', { hours }),
              hours === 1
                ? t('hava81.forecastAtlas.intervalOptionSingle')
                : t('hava81.forecastAtlas.intervalOption', { hours }),
            ].join(' ')}
            aria-pressed={displayIntervalHours === hours}
            onClick={() => onSelect(hours)}
          >
            {t('hava81.forecastAtlas.intervalOptionCompact', { hours })}
          </button>
        ))}
      </div>
    </div>
  );
}
