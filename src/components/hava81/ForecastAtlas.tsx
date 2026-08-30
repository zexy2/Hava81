import { useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../context';
import type { DailyForecast, HourlyForecast, ForecastMeta } from '../../types';
import {
  formatPrecipitationAmount,
  formatPrecipitationSummary,
  normalizePrecipitationProbability,
} from '../../utils/precipitation';
import { WeatherSymbol } from './WeatherSymbol';
import './ForecastAtlas.css';

export interface ForecastAtlasProps {
  daily: DailyForecast[];
  hourly: HourlyForecast[];
  meta?: ForecastMeta | null;
  className?: string;
}

const LEGACY_HOUR_LIMIT = 12;
const REAL_HOURLY_HORIZON = 24;
const DISPLAY_INTERVAL_OPTIONS = [1, 3, 6] as const;
const MIN_CHART_WIDTH = 320;
const MIN_DISPLAY_COLUMN_WIDTH = 72;
const CHART_COLUMN_UNITS = 100;
const CHART_HEIGHT = 132;
const CHART_TOP = 24;
const CHART_BOTTOM = 24;
const PRECIPITATION_THRESHOLD = 0.35;
const OPEN_METEO_LICENSE_URL = 'https://creativecommons.org/licenses/by/4.0/';

interface ChartCoordinate {
  x: number;
  y: number;
}

const buildSmoothPath = (points: readonly ChartCoordinate[]): string => {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index - 1] ?? points[index];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[index + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const segmentMinY = Math.min(p1.y, p2.y);
    const segmentMaxY = Math.max(p1.y, p2.y);
    const cp1y = Math.min(segmentMaxY, Math.max(segmentMinY, p1.y + (p2.y - p0.y) / 6));
    const cp2y = Math.min(segmentMaxY, Math.max(segmentMinY, p2.y - (p3.y - p1.y) / 6));
    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return path;
};

export function ForecastAtlas({ daily, hourly, meta, className = '' }: ForecastAtlasProps) {
  const { t } = useTranslation();
  const { settings, convertTemperature, getTemperatureSymbol } = useSettings();
  const [displayIntervalHours, setDisplayIntervalHours] = useState(1);
  const hourlyViewportRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const locale = settings.language === 'en' ? 'en-US' : 'tr-TR';
  const temperatureSymbol = getTemperatureSymbol();
  const headingId = `${id}-title`;
  const chartTitleId = `${id}-chart-title`;
  const chartDescriptionId = `${id}-chart-description`;
  const gradientId = `${id.replace(/:/g, '')}-temperature-area`;

  const timeFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }),
    [locale]
  );
  const dayFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
      }),
    [locale]
  );
  const timezoneOffsetMs = (meta?.timezoneOffsetSeconds ?? 0) * 1000;
  const atLocationTime = (date: Date): Date => new Date(date.getTime() + timezoneOffsetMs);
  const intervalHours = meta?.intervalHours ?? 3;
  const realHourlyHorizon = Math.min(REAL_HOURLY_HORIZON, hourly.length);
  const hourlyHeading =
    intervalHours === 1
      ? t('hava81.forecastAtlas.hourlyForecastNext', {
          hours: realHourlyHorizon,
          unit:
            settings.language === 'en'
              ? t(
                  realHourlyHorizon === 1
                    ? 'hava81.forecastAtlas.hourUnitSingular'
                    : 'hava81.forecastAtlas.hourUnitPlural'
                )
              : '',
        })
      : t('hava81.forecastAtlas.intervalForecast', { hours: intervalHours });

  const hourlyHorizonData = useMemo(() => {
    const source =
      intervalHours === 1
        ? hourly.slice(0, REAL_HOURLY_HORIZON)
        : hourly.slice(0, LEGACY_HOUR_LIMIT);

    return source.map(hour => ({
      ...hour,
      timestamp: hour.time.getTime(),
      convertedTemp: Math.round(convertTemperature(hour.temp)),
      precipitation: normalizePrecipitationProbability(hour.pop),
    }));
  }, [convertTemperature, hourly, intervalHours]);

  const hourlyData = useMemo(
    () =>
      intervalHours === 1
        ? hourlyHorizonData.filter((_, index) => index % displayIntervalHours === 0)
        : hourlyHorizonData,
    [displayIntervalHours, hourlyHorizonData, intervalHours]
  );

  const dailyData = useMemo(
    () =>
      daily.map(day => ({
        ...day,
        timestamp: day.date.getTime(),
        convertedMin: Math.round(convertTemperature(day.tempMin)),
        convertedMax: Math.round(convertTemperature(day.tempMax)),
        precipitation: normalizePrecipitationProbability(day.pop),
      })),
    [convertTemperature, daily]
  );

  const chart = useMemo(() => {
    if (hourlyData.length < 2) return null;

    const temperatures = hourlyData.map(hour => hour.convertedTemp);
    const min = Math.min(...temperatures);
    const max = Math.max(...temperatures);
    const range = max - min;
    const columnWidth = CHART_COLUMN_UNITS;
    const width = columnWidth * hourlyData.length;
    const drawableHeight = CHART_HEIGHT - CHART_TOP - CHART_BOTTOM;

    const points = hourlyData.map((hour, index) => ({
      ...hour,
      x: columnWidth * index + columnWidth / 2,
      y:
        range === 0
          ? CHART_TOP + drawableHeight / 2
          : CHART_TOP + ((max - hour.convertedTemp) / range) * drawableHeight,
    }));
    const path = buildSmoothPath(points);
    const baseline = CHART_HEIGHT - 8;
    const areaPath = `${path} L ${points[points.length - 1].x} ${baseline} L ${points[0].x} ${baseline} Z`;
    const firstPrecipitation = points.find(
      point =>
        point.precipitation >= PRECIPITATION_THRESHOLD ||
        (Number.isFinite(point.precipitationMm) && (point.precipitationMm ?? 0) >= 0.2)
    );

    return { areaPath, columnWidth, firstPrecipitation, max, min, path, points, width };
  }, [hourlyData]);

  const formatDay = (date: Date): string => {
    const nowAtLocation = atLocationTime(new Date());
    const dateKey = date.toISOString().slice(0, 10);
    const todayKey = nowAtLocation.toISOString().slice(0, 10);
    const tomorrow = new Date(Date.parse(`${todayKey}T12:00:00.000Z`) + 86_400_000)
      .toISOString()
      .slice(0, 10);

    if (dateKey === todayKey) return t('days.today');
    if (dateKey === tomorrow) return t('days.tomorrow');
    return dayFormatter.format(date);
  };

  const hourlySummary = useMemo(() => {
    if (hourlyHorizonData.length === 0) return null;
    const peakPrecipitation = hourlyHorizonData.reduce((peak, hour) => {
      if (hour.precipitation > peak.precipitation) return hour;
      if (hour.precipitation < peak.precipitation) return peak;
      return (hour.precipitationMm ?? 0) > (peak.precipitationMm ?? 0) ? hour : peak;
    });
    return {
      min: Math.min(...hourlyHorizonData.map(hour => hour.convertedTemp)),
      max: Math.max(...hourlyHorizonData.map(hour => hour.convertedTemp)),
      peakPrecipitation,
    };
  }, [hourlyHorizonData]);
  const hasHourlyPrecipitationSignal = Boolean(
    hourlySummary &&
    (hourlySummary.peakPrecipitation.precipitation > 0 ||
      (hourlySummary.peakPrecipitation.precipitationMm ?? 0) > 0)
  );
  const currentLocationHourKey = atLocationTime(new Date()).toISOString().slice(0, 13);

  const intervalOptions = useMemo(
    () =>
      intervalHours === 1 && hourly.length > 1
        ? DISPLAY_INTERVAL_OPTIONS.filter(hours => hours === 1 || hourly.length > hours)
        : [],
    [hourly.length, intervalHours]
  );
  const trackWidth = `max(100%, ${Math.max(
    MIN_CHART_WIDTH,
    hourlyData.length * MIN_DISPLAY_COLUMN_WIDTH
  )}px)`;
  const selectDisplayInterval = (hours: number) => {
    setDisplayIntervalHours(hours);
    if (hourlyViewportRef.current) hourlyViewportRef.current.scrollLeft = 0;
  };

  const rootClasses = ['hava81-forecast-atlas', className].filter(Boolean).join(' ');
  const hasData = hourlyData.length > 0 || dailyData.length > 0;

  return (
    <section className={rootClasses} aria-labelledby={headingId}>
      <header className="hava81-forecast-atlas__header">
        <h2 id={headingId} className="hava81-forecast-atlas__title">
          {t('hava81.forecastAtlas.title')}
        </h2>
        <span className="hava81-forecast-atlas__unit">{temperatureSymbol}</span>
      </header>

      {!hasData ? <p className="hava81-forecast-atlas__empty">{t('weather.noData')}</p> : null}

      {hourlyData.length > 0 ? (
        <section className="hava81-forecast-atlas__section" aria-labelledby={`${id}-hourly-title`}>
          <div className="hava81-forecast-atlas__hourly-toolbar">
            <h3 id={`${id}-hourly-title`} className="hava81-forecast-atlas__section-title">
              {hourlyHeading}
            </h3>
            {intervalOptions.length > 1 ? (
              <div className="hava81-forecast-atlas__interval-control">
                <span className="hava81-forecast-atlas__range-label">
                  {t('hava81.forecastAtlas.intervalControlLabel')}
                </span>
                <div
                  className="hava81-forecast-atlas__range"
                  role="group"
                  aria-label={t('hava81.forecastAtlas.intervalControlLabel')}
                >
                  {intervalOptions.map(hours => (
                    <button
                      key={hours}
                      type="button"
                      className="hava81-forecast-atlas__range-button"
                      aria-pressed={displayIntervalHours === hours}
                      onClick={() => selectDisplayInterval(hours)}
                    >
                      {t('hava81.forecastAtlas.intervalOption', { hours })}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          {hourlySummary ? (
            <div
              className="hava81-forecast-atlas__summary"
              role="list"
              aria-label={t('hava81.forecastAtlas.summaryLabel')}
            >
              {hourlySummary.min === hourlySummary.max ? (
                <div
                  className="hava81-forecast-atlas__summary-item is-temperature-flat"
                  role="listitem"
                >
                  <span>{t('hava81.forecastAtlas.summaryTemperature')}</span>
                  <strong>
                    {hourlySummary.min}
                    {temperatureSymbol}
                  </strong>
                </div>
              ) : (
                <>
                  <div className="hava81-forecast-atlas__summary-item" role="listitem">
                    <span>{t('hava81.forecastAtlas.summaryLow')}</span>
                    <strong>
                      {hourlySummary.min}
                      {temperatureSymbol}
                    </strong>
                  </div>
                  <div className="hava81-forecast-atlas__summary-item" role="listitem">
                    <span>{t('hava81.forecastAtlas.summaryHigh')}</span>
                    <strong>
                      {hourlySummary.max}
                      {temperatureSymbol}
                    </strong>
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
              </div>
            </div>
          ) : null}

          <div
            ref={hourlyViewportRef}
            className="hava81-forecast-atlas__hourly-viewport"
            role="region"
            aria-label={t('hava81.forecastAtlas.hourlyRegion')}
            tabIndex={0}
          >
            <div className="hava81-forecast-atlas__hourly-track" style={{ width: trackWidth }}>
              {chart ? (
                <svg
                  className="hava81-forecast-atlas__chart"
                  viewBox={`0 0 ${chart.width} ${CHART_HEIGHT}`}
                  width="100%"
                  height={CHART_HEIGHT}
                  role="img"
                  aria-labelledby={`${chartTitleId} ${chartDescriptionId}`}
                >
                  <title id={chartTitleId}>{hourlyHeading}</title>
                  <desc id={chartDescriptionId}>
                    {t('hava81.forecastAtlas.chartSummary', {
                      min: chart.min,
                      max: chart.max,
                      unit: temperatureSymbol,
                    })}
                  </desc>
                  <defs>
                    <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" className="hava81-forecast-atlas__area-stop is-start" />
                      <stop offset="100%" className="hava81-forecast-atlas__area-stop is-end" />
                    </linearGradient>
                  </defs>
                  {[0.25, 0.5, 0.75].map(ratio => (
                    <line
                      key={`guide-${ratio}`}
                      className="hava81-forecast-atlas__guide"
                      x1="0"
                      x2={chart.width}
                      y1={CHART_TOP + (CHART_HEIGHT - CHART_TOP - CHART_BOTTOM) * ratio}
                      y2={CHART_TOP + (CHART_HEIGHT - CHART_TOP - CHART_BOTTOM) * ratio}
                      aria-hidden="true"
                    />
                  ))}
                  <path
                    className="hava81-forecast-atlas__area"
                    d={chart.areaPath}
                    fill={`url(#${gradientId})`}
                  />
                  <path className="hava81-forecast-atlas__curve" d={chart.path} />
                  {chart.points.map((point, index) => {
                    const isCurrentPoint =
                      atLocationTime(point.time).toISOString().slice(0, 13) ===
                      currentLocationHourKey;
                    const isExtrema =
                      point.convertedTemp === chart.min || point.convertedTemp === chart.max;
                    const isEndpoint = index === 0 || index === chart.points.length - 1;
                    if (!isCurrentPoint && !isExtrema && !isEndpoint) return null;
                    return (
                      <circle
                        key={`point-${point.timestamp}`}
                        className={`hava81-forecast-atlas__point${isCurrentPoint ? ' is-current' : ''}`}
                        cx={point.x}
                        cy={point.y}
                        r={isCurrentPoint ? 4.75 : 3.5}
                      />
                    );
                  })}
                  {chart.firstPrecipitation ? (
                    <g className="hava81-forecast-atlas__precipitation-marker">
                      <line
                        x1={chart.firstPrecipitation.x}
                        x2={chart.firstPrecipitation.x}
                        y1="4"
                        y2={CHART_HEIGHT - 4}
                      />
                      <circle
                        cx={chart.firstPrecipitation.x}
                        cy={chart.firstPrecipitation.y}
                        r="5"
                      />
                      <text
                        x={chart.firstPrecipitation.x}
                        y="12"
                        textAnchor={
                          chart.firstPrecipitation.x < 48
                            ? 'start'
                            : chart.firstPrecipitation.x > chart.width - 48
                              ? 'end'
                              : 'middle'
                        }
                      >
                        {Math.round(chart.firstPrecipitation.precipitation * 100) > 0
                          ? `${Math.round(chart.firstPrecipitation.precipitation * 100)}%`
                          : formatPrecipitationAmount(
                              chart.firstPrecipitation.precipitationMm,
                              locale
                            )}
                      </text>
                    </g>
                  ) : null}
                </svg>
              ) : null}

              {chart?.firstPrecipitation ? (
                <span className="hava81-forecast-atlas__sr-only">
                  {formatPrecipitationAmount(chart.firstPrecipitation.precipitationMm, locale)
                    ? t('hava81.forecastAtlas.precipitationAtWithAmount', {
                        time: timeFormatter.format(atLocationTime(chart.firstPrecipitation.time)),
                        percent: Math.round(chart.firstPrecipitation.precipitation * 100),
                        amount: formatPrecipitationAmount(
                          chart.firstPrecipitation.precipitationMm,
                          locale
                        ),
                      })
                    : t('hava81.forecastAtlas.precipitationAt', {
                        time: timeFormatter.format(atLocationTime(chart.firstPrecipitation.time)),
                        percent: Math.round(chart.firstPrecipitation.precipitation * 100),
                      })}
                </span>
              ) : null}

              <ol
                className="hava81-forecast-atlas__hours"
                style={{
                  gridTemplateColumns: `repeat(${hourlyData.length}, minmax(0, 1fr))`,
                }}
              >
                {hourlyData.map((hour, index) => {
                  const precipitation = Math.round(hour.precipitation * 100);
                  const precipitationAmount = formatPrecipitationAmount(
                    hour.precipitationMm,
                    locale
                  );
                  const localTime = atLocationTime(hour.time);
                  const previousLocalTime =
                    index > 0 ? atLocationTime(hourlyData[index - 1].time) : null;
                  const dayChanged =
                    previousLocalTime !== null &&
                    previousLocalTime.toISOString().slice(0, 10) !==
                      localTime.toISOString().slice(0, 10);
                  const dayContext = dayChanged ? formatDay(localTime) : null;
                  const isCurrentHour =
                    localTime.toISOString().slice(0, 13) === currentLocationHourKey;
                  const hourClasses = [
                    'hava81-forecast-atlas__hour',
                    dayChanged ? 'is-day-boundary' : '',
                    isCurrentHour ? 'is-current' : '',
                  ]
                    .filter(Boolean)
                    .join(' ');
                  return (
                    <li className={hourClasses} key={`hour-${hour.timestamp}`}>
                      <time
                        dateTime={hour.time.toISOString()}
                        aria-current={isCurrentHour ? 'time' : undefined}
                      >
                        {dayContext ? (
                          <span className="hava81-forecast-atlas__hour-day">{dayContext}</span>
                        ) : null}
                        {isCurrentHour ? (
                          <span className="hava81-forecast-atlas__hour-now">
                            {t('hava81.forecastAtlas.nowLabel')}
                          </span>
                        ) : null}
                        <span>{timeFormatter.format(localTime)}</span>
                      </time>
                      <WeatherSymbol
                        code={hour.icon}
                        size={28}
                        label={hour.description}
                        className="hava81-forecast-atlas__hour-symbol"
                      />
                      <strong>{hour.convertedTemp}°</strong>
                      {precipitation > 0 || precipitationAmount ? (
                        <span
                          className={
                            precipitation >= PRECIPITATION_THRESHOLD * 100 ||
                            (Number.isFinite(hour.precipitationMm) &&
                              (hour.precipitationMm ?? 0) >= 0.2)
                              ? 'hava81-forecast-atlas__hour-pop is-signal'
                              : 'hava81-forecast-atlas__hour-pop'
                          }
                          role="group"
                          aria-label={
                            precipitationAmount
                              ? t('hava81.forecastAtlas.hourlyPrecipitationWithAmount', {
                                  percent: precipitation,
                                  amount: precipitationAmount,
                                })
                              : `${t('weather.precipitation')}: ${precipitation}%`
                          }
                        >
                          {precipitation > 0 ? <span>{precipitation}%</span> : null}
                          {precipitation > 0 && precipitationAmount ? (
                            <span aria-hidden="true"> · </span>
                          ) : null}
                          {precipitationAmount ? <span>{precipitationAmount}</span> : null}
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
          {intervalHours === 1 && meta?.provider ? (
            <p className="hava81-forecast-atlas__source">
              <span className="hava81-forecast-atlas__source-label">
                {t('hava81.forecastAtlas.hourlySource')}
              </span>{' '}
              {meta.sourceUrl ? (
                <a href={meta.sourceUrl}>{meta.provider}</a>
              ) : (
                <span>{meta.provider}</span>
              )}
              {meta.provider === 'Open-Meteo' ? (
                <>
                  {' · '}
                  <a href={OPEN_METEO_LICENSE_URL}>CC BY 4.0</a>
                  {' · '}
                  {t('hava81.forecastAtlas.formattedByHava81')}
                </>
              ) : meta.attribution && meta.attribution !== meta.provider ? (
                <> · {meta.attribution}</>
              ) : null}
            </p>
          ) : null}
        </section>
      ) : null}

      {dailyData.length > 0 ? (
        <section className="hava81-forecast-atlas__section" aria-labelledby={`${id}-daily-title`}>
          <h3 id={`${id}-daily-title`} className="hava81-forecast-atlas__section-title">
            {t('weather.forecast')}
          </h3>
          <ol className="hava81-forecast-atlas__days">
            {dailyData.map(day => {
              const precipitation = Math.round(day.precipitation * 100);
              const precipitationAmount = formatPrecipitationAmount(day.precipitationMm, locale);
              const hasPrecipitation = precipitation > 0 || Boolean(precipitationAmount);
              return (
                <li className="hava81-forecast-atlas__day" key={`day-${day.timestamp}`}>
                  <time
                    className="hava81-forecast-atlas__day-name"
                    dateTime={day.date.toISOString()}
                  >
                    {formatDay(day.date)}
                  </time>
                  <WeatherSymbol
                    code={day.icon}
                    size={28}
                    className="hava81-forecast-atlas__day-symbol"
                  />
                  <span className="hava81-forecast-atlas__description">{day.description}</span>
                  {hasPrecipitation ? (
                    <span
                      className={
                        precipitation >= PRECIPITATION_THRESHOLD * 100 ||
                        (day.precipitationMm ?? 0) >= 1
                          ? 'hava81-forecast-atlas__day-pop is-signal'
                          : 'hava81-forecast-atlas__day-pop'
                      }
                      role="group"
                      aria-label={
                        precipitationAmount
                          ? precipitation > 0
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
                      {precipitation > 0 ? <span>{precipitation}%</span> : null}
                      {precipitation > 0 && precipitationAmount ? (
                        <span aria-hidden="true"> · </span>
                      ) : null}
                      {precipitationAmount ? <span>{precipitationAmount}</span> : null}
                    </span>
                  ) : (
                    <span className="hava81-forecast-atlas__sr-only">
                      {t('hava81.forecastAtlas.noDailyPrecipitation', { day: formatDay(day.date) })}
                    </span>
                  )}
                  <span
                    className="hava81-forecast-atlas__day-temperatures"
                    role="group"
                    aria-label={
                      day.convertedMax === day.convertedMin
                        ? t('hava81.forecastAtlas.dailySingleTemperature', {
                            value: day.convertedMax,
                            unit: temperatureSymbol,
                          })
                        : t('hava81.forecastAtlas.dailyRange', {
                            high: day.convertedMax,
                            low: day.convertedMin,
                            unit: temperatureSymbol,
                          })
                    }
                  >
                    <strong>{day.convertedMax}°</strong>
                    {day.convertedMax !== day.convertedMin ? (
                      <>
                        <span aria-hidden="true">/</span>
                        <span>{day.convertedMin}°</span>
                      </>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}
    </section>
  );
}

export default ForecastAtlas;
