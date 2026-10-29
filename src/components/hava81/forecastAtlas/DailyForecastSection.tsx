import { useTranslation } from 'react-i18next';
import { capitalizeFirst } from '../../../utils/format';
import { formatPrecipitationAmount } from '../../../utils/precipitation';
import { WeatherSymbol } from '../WeatherSymbol';
import { PRECIPITATION_THRESHOLD } from './constants';
import {
  TEMPERATURE_SCALE_DARK,
  TEMPERATURE_SCALE_LIGHT,
  temperatureColor,
} from './temperatureColor';
import type { DailyDatum, ForecastAtlasClock } from './types';

/** A day's rain is worth a line from this chance or this amount (mm) up. */
const DAILY_RAIN_CHANCE = 0.2;
const DAILY_RAIN_MM = 1;

interface DailyForecastSectionProps {
  /** Forecast Atlas instance id (from `useId`). */
  id: string;
  dailyData: readonly DailyDatum[];
  preciseTemperatureFormatter: Intl.NumberFormat;
  clock: ForecastAtlasClock;
  /** Current temperature in the display unit, marked on today's range bar. */
  nowTemperature?: number;
}

/** Daily rows: day, symbol, description, rain and the high/low range. */
export function DailyForecastSection({
  id,
  dailyData,
  preciseTemperatureFormatter,
  clock,
  nowTemperature,
}: DailyForecastSectionProps) {
  const { t, i18n } = useTranslation();
  const { currentLocationDateKey, formatDay, locale, temperatureSymbol } = clock;
  // Every day's range bar sits on one shared scale, so the days compare at a glance.
  const weekMin = Math.min(...dailyData.map(day => day.convertedMinExact));
  const weekMax = Math.max(...dailyData.map(day => day.convertedMaxExact));
  const weekSpan = Math.max(weekMax - weekMin, 1);
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' });
  const shortDate = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
  const position = (value: number) =>
    `${Math.min(100, Math.max(0, ((value - weekMin) / weekSpan) * 100))}%`;

  return (
    <section
      className="hava81-forecast-atlas__section hava81-forecast-atlas__daily"
      data-surface="daily"
      aria-labelledby={`${id}-daily-title`}
    >
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
          // Single-digit chances and trace amounts are not news on a day row.
          const hasPrecipitation =
            (probability ?? 0) >= DAILY_RAIN_CHANCE || (day.precipitationMm ?? 0) >= DAILY_RAIN_MM;
          const precipitationUnknown = precipitation === undefined && !hasAmountEvidence;
          const isCurrentDate = day.date.toISOString().slice(0, 10) === currentLocationDateKey;
          // Today and tomorrow keep their words; other days lead with the weekday.
          const relative = formatDay(day.date);
          const dayLabel =
            relative === t('days.today') || relative === t('days.tomorrow') ? relative : null;
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
                  '--range-lo': position(day.convertedMinExact),
                  '--range-hi': position(day.convertedMaxExact),
                  // Absolute colours from the day's own °C low and high, so equal ranges
                  // look equal and a cold week reads cold.
                  '--range-lo-light': temperatureColor(day.tempMin, TEMPERATURE_SCALE_LIGHT),
                  '--range-hi-light': temperatureColor(day.tempMax, TEMPERATURE_SCALE_LIGHT),
                  '--range-lo-dark': temperatureColor(day.tempMin, TEMPERATURE_SCALE_DARK),
                  '--range-hi-dark': temperatureColor(day.tempMax, TEMPERATURE_SCALE_DARK),
                } as React.CSSProperties
              }
            >
              <time
                className="hava81-forecast-atlas__day-name"
                dateTime={day.date.toISOString().slice(0, 10)}
                aria-current={isCurrentDate ? 'date' : undefined}
              >
                {dayLabel === null ? (
                  <>
                    {capitalizeFirst(weekday.format(day.date), i18n.language)}
                    <small className="hava81-forecast-atlas__day-date">
                      {shortDate.format(day.date)}
                    </small>
                  </>
                ) : (
                  dayLabel
                )}
              </time>
              <WeatherSymbol
                code={day.icon}
                size={36}
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
                ) : (precipitation ?? 0) > 0 || precipitationAmount ? (
                  // A trace day: no visible line, but assistive tech still hears the truth.
                  <span
                    className="hava81-forecast-atlas__sr-only"
                    role="group"
                    aria-label={
                      precipitationAmount
                        ? t('hava81.forecastAtlas.dailyPrecipitationAmount', {
                            day: formatDay(day.date),
                            amount: precipitationAmount,
                          })
                        : `${t('weather.precipitation')}: ${precipitation}%`
                    }
                  />
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
              <span className="hava81-forecast-atlas__day-range" aria-hidden="true">
                <span className="hava81-forecast-atlas__day-range-fill" />
                {isCurrentDate && typeof nowTemperature === 'number' ? (
                  <span
                    className="hava81-forecast-atlas__day-now"
                    data-now-marker=""
                    style={{ left: position(nowTemperature) }}
                  />
                ) : null}
              </span>
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
