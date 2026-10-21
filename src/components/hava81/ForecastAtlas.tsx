import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../context';
import type { DailyForecast, HourlyForecast, ForecastMeta } from '../../types';
import {
  formatPrecipitationAmount,
  formatPrecipitationSummary,
  normalizePrecipitationProbability,
} from '../../utils/precipitation';
import { getForecastFreshness } from '../../utils/forecastFreshness';
import { WeatherSymbol } from './WeatherSymbol';
import './ForecastAtlas.css';
import '../../styles/ForecastCalendarVisualPolish.css';

export interface ForecastAtlasProps {
  daily: DailyForecast[];
  hourly: HourlyForecast[];
  meta: ForecastMeta;
  className?: string;
}

const LEGACY_HOUR_LIMIT = 12;
const REAL_HOURLY_HORIZON = 24;
const DISPLAY_INTERVAL_OPTIONS = [1, 2, 3, 4, 6, 8, 12] as const;
const MIN_CHART_WIDTH = 320;
const MIN_DISPLAY_COLUMN_WIDTH = 72;
const CHART_COLUMN_UNITS = 100;
// One plot, three stacked bands sharing the hour columns below it:
// annotations (0-30), the temperature curve (34-108) and rain chance (140-180).
const CHART_HEIGHT = 184;
const CHART_TOP = 36;
const CHART_BOTTOM = 76;
const AREA_BASELINE = 118;
const RAIN_TOP = 140;
const RAIN_BASELINE = 180;
const RAIN_BAR_UNITS = 30;
// A fixed gutter keeps the sticky temperature axis clear of the first column.
const TRACK_GUTTER = 44;
const PRECIPITATION_THRESHOLD = 0.35;
const HOUR_MS = 60 * 60_000;
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
  const hoursRef = useRef<HTMLOListElement>(null);
  const [hourlyScroll, setHourlyScroll] = useState({
    scrollable: false,
    canGoBack: false,
    canGoForward: false,
  });
  const rangeRef = useRef<HTMLDivElement>(null);
  const [rangeIndicator, setRangeIndicator] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
    animate: boolean;
  } | null>(null);
  const [visibleWindow, setVisibleWindow] = useState<{
    from: number;
    to: number;
    start: number;
    size: number;
  } | null>(null);
  const [activeHourIndex, setActiveHourIndex] = useState<number | null>(null);
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
  // Hourly tiles are narrow on phones. English 9 PM is clearer than 09:00 PM;
  // the forecast samples are on whole hours, and full time remains in detail text.
  const hourTileFormatter = useMemo(
    () =>
      settings.language === 'en'
        ? new Intl.DateTimeFormat(locale, { hour: 'numeric', timeZone: 'UTC' })
        : timeFormatter,
    [locale, settings.language, timeFormatter]
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
  const preciseTemperatureFormatter = useMemo(
    () => new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    [locale]
  );
  const timezoneOffsetMs = meta.timezoneOffsetSeconds * 1000;
  const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now());
  const [, setFreshnessRevision] = useState(0);
  const forecastFreshness = getForecastFreshness(meta);
  const atLocationTime = (date: Date): Date => new Date(date.getTime() + timezoneOffsetMs);

  useEffect(() => {
    let timerId: number | undefined;
    const scheduleCurrentHourRefresh = () => {
      const now = Date.now();
      setCurrentTimeMs(now);
      const locationClockMs = now + timezoneOffsetMs;
      const elapsedInHour = ((locationClockMs % HOUR_MS) + HOUR_MS) % HOUR_MS;
      const delay = HOUR_MS - elapsedInHour + 100;
      timerId = window.setTimeout(scheduleCurrentHourRefresh, delay);
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (timerId !== undefined) window.clearTimeout(timerId);
      scheduleCurrentHourRefresh();
    };

    scheduleCurrentHourRefresh();
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      if (timerId !== undefined) window.clearTimeout(timerId);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [timezoneOffsetMs]);
  useEffect(() => {
    const resyncFreshness = () => setFreshnessRevision(revision => revision + 1);
    const timerId =
      forecastFreshness.expiresInMs === null
        ? undefined
        : window.setTimeout(resyncFreshness, forecastFreshness.expiresInMs);
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') resyncFreshness();
    };

    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      if (timerId !== undefined) window.clearTimeout(timerId);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [forecastFreshness.expiresInMs, meta]);

  const intervalHours = meta.intervalHours;
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
        convertedMinExact: convertTemperature(day.tempMin),
        convertedMaxExact: convertTemperature(day.tempMax),
        convertedMin: Math.round(convertTemperature(day.tempMin)),
        convertedMax: Math.round(convertTemperature(day.tempMax)),
        precipitation: normalizePrecipitationProbability(day.pop),
      })),
    [convertTemperature, daily]
  );

  const chart = useMemo(() => {
    if (hourlyData.length < 2) return null;

    const horizonTemperatures = hourlyHorizonData.map(hour => hour.convertedTemp);
    const min = Math.min(...horizonTemperatures);
    const max = Math.max(...horizonTemperatures);
    const range = max - min;
    const columnWidth = CHART_COLUMN_UNITS;
    const count = hourlyData.length;
    const width = columnWidth * count;
    const drawableHeight = CHART_HEIGHT - CHART_TOP - CHART_BOTTOM;

    const points = hourlyData.map((hour, index) => ({
      ...hour,
      index,
      x: columnWidth * index + columnWidth / 2,
      // HTML overlays (points, flags) share the SVG columns as percentages so
      // circles and labels never stretch with the responsive plot width.
      xPercent: ((index + 0.5) / count) * 100,
      y:
        range === 0
          ? CHART_TOP + drawableHeight / 2
          : CHART_TOP + ((max - hour.convertedTemp) / range) * drawableHeight,
      isNight: hour.icon.endsWith('n'),
      isRainSignal:
        hour.precipitation >= PRECIPITATION_THRESHOLD ||
        (Number.isFinite(hour.precipitationMm) && (hour.precipitationMm ?? 0) >= 0.2),
    }));
    const path = buildSmoothPath(points);
    const areaPath = `${path} L ${points[points.length - 1].x} ${AREA_BASELINE} L ${points[0].x} ${AREA_BASELINE} Z`;
    const firstPrecipitation = points.find(point => point.isRainSignal);
    const tickValues =
      range === 0 ? [min] : Array.from(new Set([max, Math.round((max + min) / 2), min]));
    const yTicks = tickValues.map(value => ({
      value,
      y: CHART_TOP + ((max - value) / Math.max(range, 1)) * drawableHeight,
    }));

    // Rain chance is drawn as one bar per displayed hour. Measurable rain with
    // a rounded 0% chance keeps a visible stub instead of disappearing.
    const rainDepth = RAIN_BASELINE - RAIN_TOP;
    const rainBars = points
      .filter(point => point.precipitation > 0 || (point.precipitationMm ?? 0) > 0)
      .map(point => ({
        key: point.timestamp,
        x: point.x - RAIN_BAR_UNITS / 2,
        height: Math.max(3, Math.min(1, point.precipitation) * rainDepth),
        signal: point.isRainSignal,
      }));

    // Night is provider evidence (Open-Meteo is_day -> "n" icon suffix), so
    // the shaded bands follow the real local day/night split of each hour.
    const nightRuns: Array<{ start: number; end: number }> = [];
    points.forEach((point, index) => {
      if (!point.isNight) return;
      const last = nightRuns[nightRuns.length - 1];
      if (last && last.end === index - 1) last.end = index;
      else nightRuns.push({ start: index, end: index });
    });

    return {
      areaPath,
      columnWidth,
      count,
      firstPrecipitation,
      max,
      min,
      nightRuns,
      path,
      points,
      rainBars,
      width,
      yTicks,
    };
  }, [hourlyData, hourlyHorizonData]);

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
    const min = Math.min(...hourlyHorizonData.map(hour => hour.convertedTemp));
    const max = Math.max(...hourlyHorizonData.map(hour => hour.convertedTemp));
    return {
      min,
      max,
      // The first hour reaching each extreme anchors the stat to a time.
      minHour: hourlyHorizonData.find(hour => hour.convertedTemp === min) ?? null,
      maxHour: hourlyHorizonData.find(hour => hour.convertedTemp === max) ?? null,
      peakPrecipitation,
    };
  }, [hourlyHorizonData]);
  const hasHourlyPrecipitationSignal = Boolean(
    hourlySummary &&
    (hourlySummary.peakPrecipitation.precipitation > 0 ||
      (hourlySummary.peakPrecipitation.precipitationMm ?? 0) > 0)
  );
  const currentLocationTime = atLocationTime(new Date(currentTimeMs));
  const currentLocationDateKey = currentLocationTime.toISOString().slice(0, 10);
  const currentLocationHourKey = currentLocationTime.toISOString().slice(0, 13);
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

  const intervalOptions = useMemo(
    () =>
      intervalHours === 1 && hourly.length > 1
        ? DISPLAY_INTERVAL_OPTIONS.filter(hours => hours === 1 || hourly.length > hours)
        : [],
    [hourly.length, intervalHours]
  );
  const trackWidth = `max(100%, ${Math.max(
    MIN_CHART_WIDTH,
    hourlyData.length * MIN_DISPLAY_COLUMN_WIDTH + TRACK_GUTTER
  )}px)`;
  useEffect(() => {
    const viewport = hourlyViewportRef.current;
    if (!viewport) return;
    const update = () => {
      const maxScroll = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
      const next = {
        scrollable: maxScroll > 16,
        // Scroll snapping may place the first forecast tile a few pixels off zero.
        canGoBack: viewport.scrollLeft > 16,
        canGoForward: viewport.scrollLeft < maxScroll - 16,
      };
      setHourlyScroll(previous =>
        previous.scrollable === next.scrollable &&
        previous.canGoBack === next.canGoBack &&
        previous.canGoForward === next.canGoForward
          ? previous
          : next
      );
      const count = hourlyData.length;
      const hours = hoursRef.current;
      if (count === 0 || !hours || hours.offsetWidth <= 0 || viewport.scrollWidth <= 0) return;
      const columnWidth = hours.offsetWidth / count;
      const gutter = hours.offsetLeft;
      // A column counts as visible once its centre (and chart point) clears
      // the sticky axis gutter on the left and the viewport edge on the right.
      const from = Math.min(
        count - 1,
        Math.max(0, Math.ceil(viewport.scrollLeft / columnWidth - 0.5))
      );
      const to = Math.min(
        count - 1,
        Math.max(
          from,
          Math.floor((viewport.scrollLeft + viewport.clientWidth - gutter) / columnWidth - 0.5)
        )
      );
      const start = Math.round((viewport.scrollLeft / viewport.scrollWidth) * 1000) / 10;
      const size = Math.round((viewport.clientWidth / viewport.scrollWidth) * 1000) / 10;
      setVisibleWindow(previous =>
        previous &&
        previous.from === from &&
        previous.to === to &&
        previous.start === start &&
        previous.size === size
          ? previous
          : { from, to, start, size }
      );
    };
    update();
    viewport.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    observer?.observe(viewport);
    return () => {
      viewport.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      observer?.disconnect();
    };
  }, [hourlyData.length, displayIntervalHours, forecastFreshness.fresh]);

  // The interval control's selection slides between options. Measuring the
  // pressed button keeps it correct when the control wraps on tiny phones or
  // when text is enlarged; without layout (tests, no CSS) nothing is drawn.
  useLayoutEffect(() => {
    const range = rangeRef.current;
    if (!range) return;
    let measured = false;
    const measure = () => {
      const pressed = range.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
      if (!pressed || pressed.offsetWidth === 0) {
        setRangeIndicator(null);
        return;
      }
      const next = {
        x: pressed.offsetLeft,
        y: pressed.offsetTop,
        width: pressed.offsetWidth,
        height: pressed.offsetHeight,
      };
      const animate = measured;
      measured = true;
      setRangeIndicator(previous =>
        previous &&
        previous.x === next.x &&
        previous.y === next.y &&
        previous.width === next.width &&
        previous.height === next.height
          ? previous
          : { ...next, animate }
      );
    };
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(range);
    return () => observer?.disconnect();
  }, [intervalOptions.length, forecastFreshness.fresh]);

  useLayoutEffect(() => {
    const range = rangeRef.current;
    if (!range) return;
    const pressed = range.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
    if (!pressed || pressed.offsetWidth === 0) return;
    setRangeIndicator({
      x: pressed.offsetLeft,
      y: pressed.offsetTop,
      width: pressed.offsetWidth,
      height: pressed.offsetHeight,
      animate: true,
    });
  }, [displayIntervalHours]);

  // Pointing anywhere in an hour column (chart or values) links the two: the
  // column, its chart point and its value cell highlight together.
  const trackPointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const count = hourlyData.length;
    if (count < 2) return;
    const rect = hoursRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;
    if (event.clientX < rect.left) {
      setActiveHourIndex(null);
      return;
    }
    const index = Math.min(
      count - 1,
      Math.max(0, Math.floor(((event.clientX - rect.left) / rect.width) * count))
    );
    setActiveHourIndex(previous => (previous === index ? previous : index));
  };

  const scrollHourly = (direction: -1 | 1) => {
    const viewport = hourlyViewportRef.current;
    if (!viewport) return;
    viewport.scrollBy({
      left: direction * Math.round(viewport.clientWidth * 0.75),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    });
  };

  const selectDisplayInterval = (hours: number) => {
    setDisplayIntervalHours(hours);
    setActiveHourIndex(null);
    if (hourlyViewportRef.current) hourlyViewportRef.current.scrollLeft = 0;
  };

  const rootClasses = ['hava81-forecast-atlas', className].filter(Boolean).join(' ');
  const hasData = hourlyData.length > 0 || dailyData.length > 0;
  const firstPrecipitationAmount = chart?.firstPrecipitation
    ? formatPrecipitationAmount(chart.firstPrecipitation.precipitationMm, locale)
    : null;
  const firstPrecipitationPercent = chart?.firstPrecipitation
    ? Math.round(chart.firstPrecipitation.precipitation * 100)
    : 0;

  if (!forecastFreshness.fresh) {
    return (
      <section className={rootClasses} aria-labelledby={headingId}>
        <header className="hava81-forecast-atlas__header">
          <h2 id={headingId} className="hava81-forecast-atlas__title">
            {t('hava81.forecastAtlas.title')}
          </h2>
          <span className="hava81-forecast-atlas__unit">{temperatureSymbol}</span>
        </header>
        <p className="hava81-forecast-atlas__empty" role="status">
          {t('hava81.forecastAtlas.stale')}
        </p>
      </section>
    );
  }

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
        <section
          className="hava81-forecast-atlas__section hava81-forecast-atlas__rhythm"
          aria-labelledby={`${id}-hourly-title`}
        >
          <div className="hava81-forecast-atlas__hourly-toolbar">
            <h3 id={`${id}-hourly-title`} className="hava81-forecast-atlas__section-title">
              {hourlyHeading}
            </h3>
            {intervalOptions.length > 1 ? (
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
                  {intervalOptions.map(hours => (
                    <button
                      key={hours}
                      type="button"
                      className="hava81-forecast-atlas__range-button"
                      aria-label={`${t('hava81.forecastAtlas.intervalOptionCompact', { hours })} ${t(
                        'hava81.forecastAtlas.intervalOption',
                        { hours }
                      )}`}
                      aria-pressed={displayIntervalHours === hours}
                      onClick={() => selectDisplayInterval(hours)}
                    >
                      {t('hava81.forecastAtlas.intervalOptionCompact', { hours })}
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
                {hasHourlyPrecipitationSignal
                  ? renderSummaryWhen(hourlySummary.peakPrecipitation)
                  : null}
              </div>
            </div>
          ) : null}

          <div
            ref={hourlyViewportRef}
            id={`${id}-hourly-viewport`}
            className="hava81-forecast-atlas__hourly-viewport"
            role="region"
            aria-label={t('hava81.forecastAtlas.hourlyRegion')}
            tabIndex={0}
          >
            {chart ? (
              <div className="hava81-forecast-atlas__axis" aria-hidden="true">
                {chart.yTicks.map(tick => (
                  <span
                    key={`axis-${tick.value}`}
                    className="hava81-forecast-atlas__axis-label"
                    style={{ top: `${tick.y}px` }}
                  >
                    {tick.value}°
                  </span>
                ))}
                {chart.rainBars.length > 0 ? (
                  <span
                    className="hava81-forecast-atlas__axis-caption"
                    style={{ top: `${(RAIN_TOP + RAIN_BASELINE) / 2}px` }}
                  >
                    {t('hava81.forecastAtlas.rainBandLabel')}
                  </span>
                ) : null}
              </div>
            ) : null}
            <div
              className="hava81-forecast-atlas__hourly-track"
              style={{ width: trackWidth, paddingInlineStart: `${TRACK_GUTTER}px` }}
              onPointerMove={trackPointer}
              onPointerLeave={() => setActiveHourIndex(null)}
            >
              {chart ? (
                <div
                  className="hava81-forecast-atlas__plot"
                  style={{ height: `${CHART_HEIGHT}px` }}
                  data-has-rain={chart.rainBars.length > 0 ? 'true' : undefined}
                >
                  <div className="hava81-forecast-atlas__bands" aria-hidden="true">
                    {chart.nightRuns.map(run => (
                      <span
                        key={`night-${run.start}`}
                        className="hava81-forecast-atlas__night-band"
                        style={{
                          left: `${(run.start / chart.count) * 100}%`,
                          width: `${((run.end - run.start + 1) / chart.count) * 100}%`,
                        }}
                      >
                        <span className="hava81-forecast-atlas__night-label">
                          <svg viewBox="0 0 16 16" width="13" height="13" focusable="false">
                            <path d="M10.6 1.8a6.4 6.4 0 1 0 3.6 10.9A5.6 5.6 0 0 1 10.6 1.8Z" />
                          </svg>
                          {t('hava81.forecastAtlas.nightLabel')}
                        </span>
                      </span>
                    ))}
                    {chart.points.map(point => {
                      const isCurrentPoint =
                        atLocationTime(point.time).toISOString().slice(0, 13) ===
                        currentLocationHourKey;
                      const isActive = activeHourIndex === point.index;
                      if (!isCurrentPoint && !isActive) return null;
                      return (
                        <span
                          key={`column-${point.timestamp}`}
                          className={`hava81-forecast-atlas__column${
                            isCurrentPoint ? ' is-current' : ''
                          }${isActive ? ' is-active' : ''}`}
                          style={{
                            left: `${(point.index / chart.count) * 100}%`,
                            width: `${100 / chart.count}%`,
                          }}
                        />
                      );
                    })}
                  </div>
                  <svg
                    className="hava81-forecast-atlas__chart"
                    viewBox={`0 0 ${chart.width} ${CHART_HEIGHT}`}
                    preserveAspectRatio="none"
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
                    {chart.yTicks.map(tick => (
                      <line
                        key={`guide-${tick.value}`}
                        className="hava81-forecast-atlas__guide"
                        x1="0"
                        x2={chart.width}
                        y1={tick.y}
                        y2={tick.y}
                        aria-hidden="true"
                      />
                    ))}
                    {chart.points.map((point, index) => {
                      if (index === 0) return null;
                      const previous = atLocationTime(chart.points[index - 1].time)
                        .toISOString()
                        .slice(0, 10);
                      const current = atLocationTime(point.time).toISOString().slice(0, 10);
                      if (previous === current) return null;
                      const x = point.x - chart.columnWidth / 2;
                      return (
                        <line
                          key={`day-${point.timestamp}`}
                          className="hava81-forecast-atlas__day-boundary"
                          x1={x}
                          x2={x}
                          y1="0"
                          y2={CHART_HEIGHT}
                          aria-hidden="true"
                        />
                      );
                    })}
                    <g
                      className="hava81-forecast-atlas__trace"
                      key={`trace-${displayIntervalHours}`}
                      aria-hidden="true"
                    >
                      <path
                        className="hava81-forecast-atlas__area"
                        d={chart.areaPath}
                        fill={`url(#${gradientId})`}
                      />
                      <path className="hava81-forecast-atlas__curve" d={chart.path} />
                    </g>
                    {chart.rainBars.length > 0 ? (
                      <g className="hava81-forecast-atlas__rain" aria-hidden="true">
                        <line
                          className="hava81-forecast-atlas__rain-ceiling"
                          x1="0"
                          x2={chart.width}
                          y1={RAIN_TOP}
                          y2={RAIN_TOP}
                        />
                        <line
                          className="hava81-forecast-atlas__rain-baseline"
                          x1="0"
                          x2={chart.width}
                          y1={RAIN_BASELINE}
                          y2={RAIN_BASELINE}
                        />
                        {chart.rainBars.map(bar => (
                          <rect
                            key={`rain-${bar.key}`}
                            className={`hava81-forecast-atlas__rain-bar${
                              bar.signal ? ' is-signal' : ''
                            }`}
                            x={bar.x}
                            y={RAIN_BASELINE - bar.height}
                            width={RAIN_BAR_UNITS}
                            height={bar.height}
                          />
                        ))}
                      </g>
                    ) : null}
                    {chart.points.map(point => {
                      const isCurrentPoint =
                        atLocationTime(point.time).toISOString().slice(0, 13) ===
                        currentLocationHourKey;
                      if (!isCurrentPoint) return null;
                      return (
                        <line
                          key={`now-${point.timestamp}`}
                          className="hava81-forecast-atlas__current-guide"
                          x1={point.x}
                          x2={point.x}
                          y1={CHART_TOP - 14}
                          y2={RAIN_BASELINE}
                          aria-hidden="true"
                        />
                      );
                    })}
                    {chart.firstPrecipitation ? (
                      <g className="hava81-forecast-atlas__precipitation-marker" aria-hidden="true">
                        <line
                          x1={chart.firstPrecipitation.x}
                          x2={chart.firstPrecipitation.x}
                          y1="22"
                          y2={RAIN_BASELINE}
                        />
                      </g>
                    ) : null}
                  </svg>
                  <div className="hava81-forecast-atlas__marks" aria-hidden="true">
                    {chart.points.map(point => {
                      const isCurrentPoint =
                        atLocationTime(point.time).toISOString().slice(0, 13) ===
                        currentLocationHourKey;
                      const isExtrema =
                        point.convertedTemp === chart.min || point.convertedTemp === chart.max;
                      const isActive = activeHourIndex === point.index;
                      const classes = [
                        'hava81-forecast-atlas__point',
                        isCurrentPoint ? 'is-current' : '',
                        isExtrema ? 'is-extreme' : '',
                        isActive ? 'is-active' : '',
                      ]
                        .filter(Boolean)
                        .join(' ');
                      return (
                        <span
                          key={`point-${point.timestamp}`}
                          className={classes}
                          style={{ left: `${point.xPercent}%`, top: `${point.y}px` }}
                        />
                      );
                    })}
                    {activeHourIndex !== null && chart.points[activeHourIndex] ? (
                      <span
                        className="hava81-forecast-atlas__readout"
                        style={{
                          left: `${chart.points[activeHourIndex].xPercent}%`,
                          top: `${chart.points[activeHourIndex].y}px`,
                        }}
                      >
                        {chart.points[activeHourIndex].convertedTemp}°
                      </span>
                    ) : null}
                    {chart.firstPrecipitation ? (
                      <span
                        className={`hava81-forecast-atlas__precipitation-flag${
                          chart.firstPrecipitation.xPercent < 10
                            ? ' is-start'
                            : chart.firstPrecipitation.xPercent > 90
                              ? ' is-end'
                              : ''
                        }`}
                        style={{ left: `${chart.firstPrecipitation.xPercent}%` }}
                      >
                        <svg viewBox="0 0 12 12" width="11" height="11" focusable="false">
                          <path d="M6 1.2C4.4 3.6 2.6 5.5 2.6 7.5a3.4 3.4 0 0 0 6.8 0C9.4 5.5 7.6 3.6 6 1.2Z" />
                        </svg>
                        {Math.round(chart.firstPrecipitation.precipitation * 100) > 0
                          ? `${Math.round(chart.firstPrecipitation.precipitation * 100)}%`
                          : formatPrecipitationAmount(
                              chart.firstPrecipitation.precipitationMm,
                              locale
                            )}
                      </span>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {chart?.firstPrecipitation ? (
                <span className="hava81-forecast-atlas__sr-only">
                  {firstPrecipitationAmount && firstPrecipitationPercent > 0
                    ? t('hava81.forecastAtlas.precipitationAtWithAmount', {
                        time: timeFormatter.format(atLocationTime(chart.firstPrecipitation.time)),
                        percent: firstPrecipitationPercent,
                        amount: firstPrecipitationAmount,
                      })
                    : firstPrecipitationAmount
                      ? `${timeFormatter.format(atLocationTime(chart.firstPrecipitation.time))} · ${t(
                          'hava81.activities.conditions.rainAmount',
                          { amount: firstPrecipitationAmount }
                        )}`
                      : t('hava81.forecastAtlas.precipitationAt', {
                          time: timeFormatter.format(atLocationTime(chart.firstPrecipitation.time)),
                          percent: firstPrecipitationPercent,
                        })}
                </span>
              ) : null}

              <ol
                ref={hoursRef}
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
                    hour.icon.endsWith('n') ? 'is-night' : '',
                    activeHourIndex === index ? 'is-active' : '',
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
                        <span>{hourTileFormatter.format(localTime)}</span>
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
                            precipitationAmount && precipitation > 0
                              ? t('hava81.forecastAtlas.hourlyPrecipitationWithAmount', {
                                  percent: precipitation,
                                  amount: precipitationAmount,
                                })
                              : precipitationAmount
                                ? t('hava81.activities.conditions.rainAmount', {
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
          {hourlyScroll.scrollable ? (
            <div
              className="hava81-forecast-atlas__scroll-navigation"
              role="group"
              aria-label={t('hava81.forecastAtlas.scrollNavigation')}
            >
              <div className="hava81-forecast-atlas__scroll-status">
                <span className="hava81-forecast-atlas__scroll-hint">
                  {visibleWindow && hourlyData[visibleWindow.from] && hourlyData[visibleWindow.to]
                    ? t('hava81.forecastAtlas.visibleWindow', {
                        from: hourTileFormatter.format(
                          atLocationTime(hourlyData[visibleWindow.from].time)
                        ),
                        to: hourTileFormatter.format(
                          atLocationTime(hourlyData[visibleWindow.to].time)
                        ),
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
                  onClick={() => scrollHourly(-1)}
                >
                  <svg
                    viewBox="0 0 20 20"
                    width="18"
                    height="18"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path d="M12.5 4.5 7 10l5.5 5.5" />
                  </svg>
                </button>
                <button
                  type="button"
                  aria-controls={`${id}-hourly-viewport`}
                  aria-label={t('hava81.forecastAtlas.scrollNext')}
                  disabled={!hourlyScroll.canGoForward}
                  onClick={() => scrollHourly(1)}
                >
                  <svg
                    viewBox="0 0 20 20"
                    width="18"
                    height="18"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path d="M7.5 4.5 13 10l-5.5 5.5" />
                  </svg>
                </button>
              </div>
            </div>
          ) : null}
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
          <ol
            className="hava81-forecast-atlas__days"
            tabIndex={0}
            aria-label={t('hava81.forecastAtlas.dailyRegion')}
          >
            {dailyData.map(day => {
              const precipitation = Math.round(day.precipitation * 100);
              const precipitationAmount = formatPrecipitationAmount(day.precipitationMm, locale);
              const hasPrecipitation = precipitation > 0 || Boolean(precipitationAmount);
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
                <li className="hava81-forecast-atlas__day" key={`day-${day.timestamp}`}>
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
      ) : null}
    </section>
  );
}

export default ForecastAtlas;
