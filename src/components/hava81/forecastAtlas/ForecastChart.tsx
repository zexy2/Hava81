import { useLayoutEffect, useRef } from 'react';
import type { CSSProperties, RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { formatPrecipitationAmount } from '../../../utils/precipitation';
import {
  AREA_BASELINE,
  CHART_HEIGHT,
  CHART_TOP,
  RAIN_BASELINE,
  RAIN_GAUGE_CELLS,
  RAIN_TOP,
} from './constants';
import { columnBox } from './chartGeometry';
import type { RhythmChart, RhythmPoint } from './chartGeometry';
import type { ForecastAtlasClock } from './types';

const isCurrentHourPoint = (point: RhythmPoint, clock: ForecastAtlasClock) =>
  clock.atLocationTime(point.time).toISOString().slice(0, 13) === clock.currentLocationHourKey;

/** Sticky temperature axis (and rain caption) on the left of the hour strip. */
export function ForecastChartAxis({ chart }: { chart: RhythmChart }) {
  const { t } = useTranslation();
  return (
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
  );
}

interface ForecastChartBandsProps {
  chart: RhythmChart;
  clock: ForecastAtlasClock;
  activeHourIndex: number | null;
}

/** Full-height night, twilight, current-hour and hovered-hour column boxes. */
export function ForecastChartBands({ chart, clock, activeHourIndex }: ForecastChartBandsProps) {
  const { t } = useTranslation();
  return (
    <div className="hava81-forecast-atlas__bands" aria-hidden="true">
      {chart.nightRuns.map(run => {
        const hasDusk = run.start > 0;
        const hasDawn = run.end < chart.count - 1;
        return (
          <span key={`night-${run.start}`}>
            {hasDusk ? (
              <span
                className="hava81-forecast-atlas__twilight is-dusk"
                style={columnBox(run.start - 1, 1, chart.count)}
              />
            ) : null}
            <span
              className={`hava81-forecast-atlas__night-band${
                hasDusk ? ' is-dusk' : ''
              }${hasDawn ? ' is-dawn' : ''}`}
              style={columnBox(run.start, run.end - run.start + 1, chart.count)}
            >
              <span className="hava81-forecast-atlas__night-label">
                <svg viewBox="0 0 16 16" width="13" height="13" focusable="false">
                  <path d="M10.6 1.8a6.4 6.4 0 1 0 3.6 10.9A5.6 5.6 0 0 1 10.6 1.8Z" />
                </svg>
                {t('hava81.forecastAtlas.nightLabel')}
              </span>
            </span>
            {hasDawn ? (
              <span
                className="hava81-forecast-atlas__twilight is-dawn"
                style={columnBox(run.end + 1, 1, chart.count)}
              />
            ) : null}
          </span>
        );
      })}
      {chart.points.map(point => {
        const isCurrentPoint = isCurrentHourPoint(point, clock);
        const isActive = activeHourIndex === point.index;
        if (!isCurrentPoint && !isActive) return null;
        return (
          <span
            key={`column-${point.timestamp}`}
            className={`hava81-forecast-atlas__column${
              isCurrentPoint ? ' is-current' : ''
            }${isActive ? ' is-active' : ''}`}
            style={columnBox(point.index, 1, chart.count)}
          />
        );
      })}
    </div>
  );
}

interface ForecastChartPlotProps {
  chart: RhythmChart;
  clock: ForecastAtlasClock;
  plotRef: RefObject<HTMLDivElement | null>;
  /** Forecast Atlas instance id (from `useId`). */
  id: string;
  hourlyHeading: string;
  displayIntervalHours: number;
  activeHourIndex: number | null;
  tooltipSide: 'left' | 'right';
}

/** The temperature curve, rain gauge, hour points, tooltip and first-rain flag. */
export function ForecastChartPlot({
  chart,
  clock,
  plotRef,
  id,
  hourlyHeading,
  displayIntervalHours,
  activeHourIndex,
  tooltipSide,
}: ForecastChartPlotProps) {
  const { t } = useTranslation();
  const { atLocationTime, currentLocationDateKey, formatDay, hourTileFormatter } = clock;
  const { locale, temperatureSymbol } = clock;
  const curveRef = useRef<SVGPathElement>(null);
  const chartTitleId = `${id}-chart-title`;
  const chartDescriptionId = `${id}-chart-description`;
  const gradientId = `rhythm-${id.replace(/[^a-zA-Z0-9_-]/g, '')}`;

  // The draw-in animation needs the curve's real length (stroke-dashoffset
  // runs from the full length to zero); it is re-measured whenever the path
  // changes so a new interval or width draws itself again. Keep this effect
  // keyed to chart geometry: pointer-driven highlighting rerenders the plot
  // frequently, but does not change the path length and should not force a
  // synchronous SVG geometry read on every pointer move.
  useLayoutEffect(() => {
    const curve = curveRef.current;
    if (!curve || typeof curve.getTotalLength !== 'function') return;
    const length = Math.ceil(curve.getTotalLength());
    if (length > 0) curve.style.setProperty('--rhythm-curve-length', `${length}`);
  }, [chart]);

  const renderTooltip = (point: RhythmPoint) => {
    const localTime = atLocationTime(point.time);
    const dayLabel =
      localTime.toISOString().slice(0, 10) === currentLocationDateKey ? null : formatDay(localTime);
    const probability =
      typeof point.precipitation === 'number' &&
      Number.isFinite(point.precipitation) &&
      point.precipitation >= 0 &&
      point.precipitation <= 1
        ? point.precipitation
        : undefined;
    const percent = probability !== undefined ? Math.round(probability * 100) : undefined;
    const amount = formatPrecipitationAmount(point.precipitationMm, locale);
    const rain =
      percent !== undefined && percent > 0 && amount
        ? `${percent}% · ${amount}`
        : percent !== undefined && percent > 0
          ? `${percent}%`
          : amount || (percent === undefined ? t('hava81.forecastAtlas.precipitationUnknown') : null);
    // Beside the point (never above it), so the reading is never clipped by
    // the plot's top edge and never covers the curve it describes.
    const placement = tooltipSide === 'left' ? 'is-left' : 'is-right';
    const top = Math.min(CHART_HEIGHT - 100, Math.max(4, point.y - 44));
    return (
      <span
        className={`hava81-forecast-atlas__tooltip ${placement}`}
        style={{ left: `${point.xPercent}%`, top: `${top}px` }}
      >
        <span className="hava81-forecast-atlas__tooltip-time">
          {dayLabel ? `${dayLabel} · ` : ''}
          {hourTileFormatter.format(localTime)}
        </span>
        <span className="hava81-forecast-atlas__tooltip-temp">
          {point.convertedTemp}
          {temperatureSymbol}
        </span>
        {point.description ? (
          <span className="hava81-forecast-atlas__tooltip-detail">{point.description}</span>
        ) : null}
        {rain ? (
          <span className="hava81-forecast-atlas__tooltip-rain">
            {t('hava81.forecastAtlas.rainBandLabel')} {rain}
          </span>
        ) : null}
      </span>
    );
  };

  return (
    <div
      ref={plotRef}
      className="hava81-forecast-atlas__plot"
      style={{ height: `${CHART_HEIGHT}px` }}
      data-has-rain={chart.rainBars.length > 0 ? 'true' : undefined}
    >
      <svg
        className="hava81-forecast-atlas__chart"
        viewBox={`0 0 ${chart.width} ${CHART_HEIGHT}`}
        preserveAspectRatio="none"
        width="100%"
        height={CHART_HEIGHT}
        role="img"
        aria-labelledby={`${chartTitleId} ${chartDescriptionId}`}
        style={
          {
            '--rhythm-curve-light': `url(#${gradientId}-curve-light)`,
            '--rhythm-curve-dark': `url(#${gradientId}-curve-dark)`,
            '--rhythm-area-light': `url(#${gradientId}-area-light)`,
            '--rhythm-area-dark': `url(#${gradientId}-area-dark)`,
          } as CSSProperties
        }
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
          {(['light', 'dark'] as const).map(theme => (
            <linearGradient
              key={`curve-${theme}`}
              id={`${gradientId}-curve-${theme}`}
              gradientUnits="userSpaceOnUse"
              x1="0"
              x2="0"
              y1={CHART_TOP}
              y2={AREA_BASELINE}
            >
              {chart.gradientStops.map(stop => (
                <stop key={stop.offset} offset={stop.offset} stopColor={stop[theme]} />
              ))}
            </linearGradient>
          ))}
          {(['light', 'dark'] as const).map(theme => (
            <linearGradient
              key={`area-${theme}`}
              id={`${gradientId}-area-${theme}`}
              gradientUnits="userSpaceOnUse"
              x1="0"
              x2="0"
              y1={CHART_TOP}
              y2={AREA_BASELINE}
            >
              {chart.gradientStops.map(stop => (
                <stop
                  key={stop.offset}
                  offset={stop.offset}
                  stopColor={stop[theme]}
                  stopOpacity={0.32 - stop.offset * 0.3}
                  className="hava81-forecast-atlas__area-stop"
                />
              ))}
            </linearGradient>
          ))}
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
          <path className="hava81-forecast-atlas__area" d={chart.areaPath} />
          <path ref={curveRef} className="hava81-forecast-atlas__curve" d={chart.path} />
        </g>
        {chart.rainBars.length > 0 ? (
          <line
            className="hava81-forecast-atlas__rain-baseline"
            x1="0"
            x2={chart.width}
            y1={RAIN_BASELINE}
            y2={RAIN_BASELINE}
            aria-hidden="true"
          />
        ) : null}
        {chart.points.map(point => {
          if (!isCurrentHourPoint(point, clock)) return null;
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
              y2={RAIN_TOP - 4}
            />
          </g>
        ) : null}
      </svg>
      {chart.rainBars.length > 0 ? (
        <div
          className="hava81-forecast-atlas__rain"
          key={`rain-${displayIntervalHours}`}
          aria-hidden="true"
          style={{ top: `${RAIN_TOP}px`, height: `${RAIN_BASELINE - RAIN_TOP}px` }}
        >
          {chart.points.map(point => {
            const bar = chart.rainBars.find(item => item.index === point.index);
            const level = bar?.level ?? 0;
            return (
              <span
                key={`gauge-${point.timestamp}`}
                className={`hava81-forecast-atlas__rain-gauge${
                  bar?.signal ? ' is-signal' : ''
                }${level === 0 ? ' is-dry' : ''}`}
                data-level={level}
                style={
                  {
                    left: `${point.xPercent}%`,
                    '--rhythm-i': point.index,
                  } as CSSProperties
                }
              >
                {Array.from({ length: RAIN_GAUGE_CELLS }, (_, cell) => (
                  <span
                    key={cell}
                    className={`hava81-forecast-atlas__rain-bar${
                      cell < level ? ' is-lit' : ''
                    }${cell < level && bar?.signal ? ' is-signal' : ''}`}
                  />
                ))}
              </span>
            );
          })}
        </div>
      ) : null}
      <div className="hava81-forecast-atlas__marks" aria-hidden="true">
        {chart.points.map((point, index) => {
          const isCurrentPoint = isCurrentHourPoint(point, clock);
          const isExtrema = point.convertedTemp === chart.min || point.convertedTemp === chart.max;
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
              style={
                {
                  left: `${point.xPercent}%`,
                  top: `${point.y}px`,
                  '--rhythm-point-light': chart.pointColors[index].light,
                  '--rhythm-point-dark': chart.pointColors[index].dark,
                  '--rhythm-i': point.index,
                } as CSSProperties
              }
            >
              {isCurrentPoint ? <span className="hava81-forecast-atlas__pulse" /> : null}
            </span>
          );
        })}
        {activeHourIndex !== null && chart.points[activeHourIndex]
          ? renderTooltip(chart.points[activeHourIndex])
          : null}
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
            {typeof chart.firstPrecipitation.precipitation === 'number' &&
            Number.isFinite(chart.firstPrecipitation.precipitation) &&
            Math.round(chart.firstPrecipitation.precipitation * 100) > 0
              ? `${Math.round(chart.firstPrecipitation.precipitation * 100)}%`
              : formatPrecipitationAmount(chart.firstPrecipitation.precipitationMm, locale)}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** Screen-reader sentence for the first hour with a rain signal. */
export function FirstPrecipitationAnnouncement({
  point,
  clock,
}: {
  point: RhythmPoint;
  clock: ForecastAtlasClock;
}) {
  const { t } = useTranslation();
  const { atLocationTime, locale, timeFormatter } = clock;
  const firstPrecipitationAmount = formatPrecipitationAmount(point.precipitationMm, locale);
  const firstPrecipitationPercent =
    typeof point.precipitation === 'number' && Number.isFinite(point.precipitation)
      ? Math.round(point.precipitation * 100)
      : undefined;
  return (
    <span className="hava81-forecast-atlas__sr-only">
      {firstPrecipitationAmount && (firstPrecipitationPercent ?? 0) > 0
        ? t('hava81.forecastAtlas.precipitationAtWithAmount', {
            time: timeFormatter.format(atLocationTime(point.time)),
            percent: firstPrecipitationPercent,
            amount: firstPrecipitationAmount,
          })
        : firstPrecipitationAmount
          ? `${timeFormatter.format(atLocationTime(point.time))} · ${t(
              'hava81.activities.conditions.rainAmount',
              { amount: firstPrecipitationAmount }
            )}`
          : t('hava81.forecastAtlas.precipitationAt', {
              time: timeFormatter.format(atLocationTime(point.time)),
              percent: firstPrecipitationPercent ?? 0,
            })}
    </span>
  );
}
