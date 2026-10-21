import { useTranslation } from 'react-i18next';
import { formatPrecipitationSummary } from '../../../utils/precipitation';
import type { HourlySummaryData } from './hourlySummaryData';
import type { ForecastAtlasClock } from './types';

interface HourlySummaryProps {
  summary: HourlySummaryData;
  clock: ForecastAtlasClock;
}

export function HourlySummary({ summary: hourlySummary, clock }: HourlySummaryProps) {
  const { t } = useTranslation();
  const { atLocationTime, currentLocationDateKey, formatDay, hourTileFormatter } = clock;
  const { locale, temperatureSymbol } = clock;
  const hasHourlyPrecipitationSignal = Boolean(
    hourlySummary &&
    (hourlySummary.peakPrecipitation.precipitation > 0 ||
      (hourlySummary.peakPrecipitation.precipitationMm ?? 0) > 0)
  );
  const renderSummaryWhen = (hour: { time: Date } | null) => {
    if (!hour) return null;
    const localTime = atLocationTime(hour.time);
    const dayLabel =
      localTime.toISOString().slice(0, 10) === currentLocationDateKey ? null : formatDay(localTime);
    return (
      <small className="hava81-forecast-atlas__summary-when">
        <time dateTime={hour.time.toISOString()}>
          {dayLabel ? `${dayLabel} ` : ''}
          {hourTileFormatter.format(localTime)}
        </time>
      </small>
    );
  };

  return (
    <div
      className="hava81-forecast-atlas__summary"
      role="list"
      aria-label={t('hava81.forecastAtlas.summaryLabel')}
    >
      {hourlySummary.min === hourlySummary.max ? (
        <div className="hava81-forecast-atlas__summary-item is-temperature-flat" role="listitem">
          <span>{t('hava81.forecastAtlas.summaryTemperature')}</span>
          <strong>
            {hourlySummary.min}
            {temperatureSymbol}
          </strong>
        </div>
      ) : (
        <>
          <div className="hava81-forecast-atlas__summary-item is-low" role="listitem">
            <span>{t('hava81.forecastAtlas.summaryLow')}</span>
            <strong>
              {hourlySummary.min}
              {temperatureSymbol}
            </strong>
            {renderSummaryWhen(hourlySummary.minHour)}
          </div>
          <div className="hava81-forecast-atlas__summary-item is-high" role="listitem">
            <span>{t('hava81.forecastAtlas.summaryHigh')}</span>
            <strong>
              {hourlySummary.max}
              {temperatureSymbol}
            </strong>
            {renderSummaryWhen(hourlySummary.maxHour)}
          </div>
        </>
      )}
      <div
        className={`hava81-forecast-atlas__summary-item is-precipitation${
          hasHourlyPrecipitationSignal ? ' has-signal' : ''
        }`}
        role="listitem"
      >
        <span>{t('hava81.forecastAtlas.summaryRain')}</span>
        <strong>
          {formatPrecipitationSummary(
            hourlySummary.peakPrecipitation.precipitation,
            hourlySummary.peakPrecipitation.precipitationMm,
            locale,
            t('hava81.forecastAtlas.precipitationNone')
          )}
        </strong>
        {hasHourlyPrecipitationSignal ? renderSummaryWhen(hourlySummary.peakPrecipitation) : null}
      </div>
    </div>
  );
}
