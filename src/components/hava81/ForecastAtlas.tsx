import { useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../context';
import type { DailyForecast, HourlyForecast, ForecastMeta } from '../../types';
import { normalizePrecipitationProbability } from '../../utils/precipitation';
import { WeatherSymbol } from './WeatherSymbol';
import './ForecastAtlas.css';

export interface ForecastAtlasProps {
  daily: DailyForecast[];
  hourly: HourlyForecast[];
  meta?: ForecastMeta | null;
  className?: string;
}

const LEGACY_HOUR_LIMIT = 12;
const REAL_HOURLY_LIMIT = 24;
const MIN_CHART_WIDTH = 320;
const MIN_COLUMN_WIDTH = 72;
const CHART_HEIGHT = 104;
const CHART_TOP = 16;
const CHART_BOTTOM = 16;
const PRECIPITATION_THRESHOLD = 0.35;
const OPEN_METEO_LICENSE_URL = 'https://creativecommons.org/licenses/by/4.0/';

export function ForecastAtlas({ daily, hourly, meta, className = '' }: ForecastAtlasProps) {
  const { t } = useTranslation();
  const { settings, convertTemperature, getTemperatureSymbol } = useSettings();
  const id = useId();
  const locale = settings.language === 'en' ? 'en-US' : 'tr-TR';
  const temperatureSymbol = getTemperatureSymbol();
  const headingId = `${id}-title`;
  const chartTitleId = `${id}-chart-title`;
  const chartDescriptionId = `${id}-chart-description`;

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
  const hourLimit = intervalHours === 1 ? REAL_HOURLY_LIMIT : LEGACY_HOUR_LIMIT;
  const hourlyHeading =
    intervalHours === 1
      ? t('hava81.forecastAtlas.hourlyForecast')
      : t('hava81.forecastAtlas.intervalForecast', { hours: intervalHours });

  const hourlyData = useMemo(
    () =>
      hourly.slice(0, hourLimit).map(hour => ({
        ...hour,
        timestamp: hour.time.getTime(),
        convertedTemp: Math.round(convertTemperature(hour.temp)),
        precipitation: normalizePrecipitationProbability(hour.pop),
      })),
    [convertTemperature, hourLimit, hourly]
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
    const columnWidth = Math.max(MIN_COLUMN_WIDTH, MIN_CHART_WIDTH / hourlyData.length);
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
    const path = points
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
      .join(' ');
    const firstPrecipitation = points.find(point => point.precipitation >= PRECIPITATION_THRESHOLD);

    return { columnWidth, firstPrecipitation, max, min, path, points, width };
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
          <h3 id={`${id}-hourly-title`} className="hava81-forecast-atlas__section-title">
            {hourlyHeading}
          </h3>
          {intervalHours === 1 && meta?.provider ? (
            <p className="hava81-forecast-atlas__source">
              {t('hava81.forecastAtlas.hourlySource')}{' '}
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
                  {settings.language === 'en' ? 'Formatted by Hava81' : 'Hava81 tarafından biçimlendirildi'}
                </>
              ) : meta.attribution && meta.attribution !== meta.provider ? (
                <> · {meta.attribution}</>
              ) : null}
            </p>
          ) : null}

          <div
            className="hava81-forecast-atlas__hourly-viewport"
            role="region"
            aria-label={t('hava81.forecastAtlas.hourlyRegion')}
            tabIndex={0}
          >
            <div
              className="hava81-forecast-atlas__hourly-track"
              style={{ width: chart?.width ?? MIN_CHART_WIDTH }}
            >
              {chart ? (
                <svg
                  className="hava81-forecast-atlas__chart"
                  viewBox={`0 0 ${chart.width} ${CHART_HEIGHT}`}
                  width={chart.width}
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
                  <path className="hava81-forecast-atlas__curve" d={chart.path} />
                  {chart.points.map(point => (
                    <circle
                      key={`point-${point.timestamp}`}
                      className="hava81-forecast-atlas__point"
                      cx={point.x}
                      cy={point.y}
                      r="3"
                    />
                  ))}
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
                        {Math.round(chart.firstPrecipitation.precipitation * 100)}%
                      </text>
                    </g>
                  ) : null}
                </svg>
              ) : null}

              {chart?.firstPrecipitation ? (
                <span className="hava81-forecast-atlas__sr-only">
                  {t('hava81.forecastAtlas.precipitationAt', {
                    time: timeFormatter.format(atLocationTime(chart.firstPrecipitation.time)),
                    percent: Math.round(chart.firstPrecipitation.precipitation * 100),
                  })}
                </span>
              ) : null}

              <ol
                className="hava81-forecast-atlas__hours"
                style={{
                  gridTemplateColumns: `repeat(${hourlyData.length}, ${chart?.columnWidth ?? MIN_COLUMN_WIDTH}px)`,
                }}
              >
                {hourlyData.map(hour => {
                  const precipitation = Math.round(hour.precipitation * 100);
                  return (
                    <li className="hava81-forecast-atlas__hour" key={`hour-${hour.timestamp}`}>
                      <time dateTime={hour.time.toISOString()}>
                        {timeFormatter.format(atLocationTime(hour.time))}
                      </time>
                      <WeatherSymbol
                        code={hour.icon}
                        size={24}
                        label={hour.description}
                        className="hava81-forecast-atlas__hour-symbol"
                      />
                      <strong>{hour.convertedTemp}°</strong>
                      <span
                        className={
                          precipitation >= PRECIPITATION_THRESHOLD * 100
                            ? 'hava81-forecast-atlas__hour-pop is-signal'
                            : 'hava81-forecast-atlas__hour-pop'
                        }
                        role="group"
                        aria-label={`${t('weather.precipitation')}: ${precipitation}%`}
                      >
                        {precipitation}%
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
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
                  <span
                    className={
                      precipitation >= PRECIPITATION_THRESHOLD * 100
                        ? 'hava81-forecast-atlas__day-pop is-signal'
                        : 'hava81-forecast-atlas__day-pop'
                    }
                    role="group"
                    aria-label={`${t('weather.precipitation')}: ${precipitation}%`}
                  >
                    {precipitation}%
                  </span>
                  <span
                    className="hava81-forecast-atlas__day-temperatures"
                    role="group"
                    aria-label={t('hava81.forecastAtlas.dailyRange', {
                      high: day.convertedMax,
                      low: day.convertedMin,
                      unit: temperatureSymbol,
                    })}
                  >
                    <strong>{day.convertedMax}°</strong>
                    <span aria-hidden="true">/</span>
                    <span>{day.convertedMin}°</span>
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
