import { useTranslation } from 'react-i18next';
import { capitalizeFirst } from '../../../utils/format';
import { formatPrecipitationAmount } from '../../../utils/precipitation';
import { WeatherSymbol } from '../WeatherSymbol';
import { PRECIPITATION_THRESHOLD } from './constants';
import type { DailyDatum, ForecastAtlasClock } from './types';

interface DailyForecastSectionProps {
  /** Forecast Atlas instance id (from `useId`). */
  id: string;
  dailyData: readonly DailyDatum[];
  preciseTemperatureFormatter: Intl.NumberFormat;
  clock: ForecastAtlasClock;
}

/** Daily rows: day, symbol, description, rain and the high/low range. */
export function DailyForecastSection({
  id,
  dailyData,
  preciseTemperatureFormatter,
  clock,
}: DailyForecastSectionProps) {
  const { t, i18n } = useTranslation();
  const { currentLocationDateKey, formatDay, locale, temperatureSymbol } = clock;
  // Every day's range bar sits on one shared scale, so the days compare at a glance.
  const weekMin = Math.min(...dailyData.map(day => day.convertedMinExact));
  const weekMax = Math.max(...dailyData.map(day => day.convertedMaxExact));
  const weekSpan = Math.max(weekMax - weekMin, 1);

  return (
    <section className="hava81-forecast-atlas__section" aria-labelledby={`${id}-daily-title`}>
      <h3 id={`${id}-daily-title`} className="hava81-forecast-atlas__section-title">
        {t('weather.forecast')}
      </h3>
      <ol
        className="hava81-forecast-atlas__days"
        tabIndex={0}
        aria-label={t('hava81.forecastAtlas.dailyRegion')}
      >
        {dailyData.map(day => {
          const probability =
            typeof day.precipitation === 'number' &&
            Number.isFinite(day.precipitation) &&
            day.precipitation >= 0 &&
            day.precipitation <= 1
              ? day.precipitation
              : undefined;
          const precipitation =
            probability !== undefined ? Math.round(probability * 100) : undefined;
          const precipitationAmount = formatPrecipitationAmount(day.precipitationMm, locale);
          const hasAmountEvidence =
            typeof day.precipitationMm === 'number' &&
            Number.isFinite(day.precipitationMm) &&
            day.precipitationMm >= 0;
          const hasPrecipitation = (precipitation ?? 0) > 0 || Boolean(precipitationAmount);
          const precipitationUnknown = precipitation === undefined && !hasAmountEvidence;
          const isCurrentDate = day.date.toISOString().slice(0, 10) === currentLocationDateKey;
          const roundedRangeCollapsed =
            day.convertedMax === day.convertedMin &&
            Math.abs(day.convertedMaxExact - day.convertedMinExact) >= 0.1;
          const displayMax = roundedRangeCollapsed
            ? preciseTemperatureFormatter.format(day.convertedMaxExact)
            : String(day.convertedMax);
          const displayMin = roundedRangeCollapsed
            ? preciseTemperatureFormatter.format(day.convertedMinExact)
            : String(day.convertedMin);
          return (
            <li
              className="hava81-forecast-atlas__day"
              key={`day-${day.timestamp}`}
              style={
                {
                  '--range-lo': `${((day.convertedMinExact - weekMin) / weekSpan) * 100}%`,
                  '--range-hi': `${((day.convertedMaxExact - weekMin) / weekSpan) * 100}%`,
                } as React.CSSProperties
              }
            >
              <time
                className="hava81-forecast-atlas__day-name"
                dateTime={day.date.toISOString().slice(0, 10)}
                aria-current={isCurrentDate ? 'date' : undefined}
              >
                {formatDay(day.date)}
              </time>
              <WeatherSymbol
                code={day.icon}
                size={28}
                className="hava81-forecast-atlas__day-symbol"
              />
              {/* Description and rain read as one detail line under the day name. */}
              <span className="hava81-forecast-atlas__day-detail">
                <span className="hava81-forecast-atlas__description">
                  {capitalizeFirst(day.description, i18n.language)}
                </span>
                {hasPrecipitation ? (
                  <span
                    className={
                      (precipitation ?? 0) >= PRECIPITATION_THRESHOLD * 100 ||
                      (day.precipitationMm ?? 0) >= 1
                        ? 'hava81-forecast-atlas__day-pop is-signal'
                        : 'hava81-forecast-atlas__day-pop'
                    }
                    role="group"
                    aria-label={
                      precipitationAmount
                        ? (precipitation ?? 0) > 0
                          ? t('hava81.forecastAtlas.dailyPrecipitationWithAmount', {
                              day: formatDay(day.date),
                              percent: precipitation,
                              amount: precipitationAmount,
                            })
                          : t('hava81.forecastAtlas.dailyPrecipitationAmount', {
                              day: formatDay(day.date),
                              amount: precipitationAmount,
                            })
                        : `${t('weather.precipitation')}: ${precipitation}%`
                    }
                  >
                    {(precipitation ?? 0) > 0 ? (
                      <span>
                        {t('hava81.forecastAtlas.dailyChance', { percent: precipitation })}
                      </span>
                    ) : null}
                    {(precipitation ?? 0) > 0 && precipitationAmount ? (
                      <span aria-hidden="true"> · </span>
                    ) : null}
                    {precipitationAmount ? <span>{precipitationAmount}</span> : null}
                  </span>
                ) : precipitationUnknown ? (
                  <span
                    className="hava81-forecast-atlas__day-pop"
                    role="group"
                    aria-label={t('hava81.forecastAtlas.precipitationUnknown')}
                  >
                    {t('hava81.forecastAtlas.precipitationUnknown')}
                  </span>
                ) : (
                  <span className="hava81-forecast-atlas__sr-only">
                    {t('hava81.forecastAtlas.noDailyPrecipitation', { day: formatDay(day.date) })}
                  </span>
                )}
              </span>
              <span className="hava81-forecast-atlas__day-range" aria-hidden="true" />
              <span
                className="hava81-forecast-atlas__day-temperatures"
                role="group"
                aria-label={
                  day.convertedMax === day.convertedMin && !roundedRangeCollapsed
                    ? t('hava81.forecastAtlas.dailySingleTemperature', {
                        value: displayMax,
                        unit: temperatureSymbol,
                      })
                    : t('hava81.forecastAtlas.dailyRange', {
                        high: displayMax,
                        low: displayMin,
                        unit: temperatureSymbol,
                      })
                }
              >
                <strong>{displayMax}°</strong>
                {day.convertedMax !== day.convertedMin || roundedRangeCollapsed ? (
                  <>
                    <span aria-hidden="true">/</span>
                    <span>{displayMin}°</span>
                  </>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
