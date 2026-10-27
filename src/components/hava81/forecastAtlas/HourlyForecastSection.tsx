import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../../context';
import type { ForecastMeta } from '../../../types';
import {
  MIN_CHART_WIDTH,
  MIN_DISPLAY_COLUMN_WIDTH,
  REAL_HOURLY_HORIZON,
  TRACK_GUTTER,
} from './constants';
import { buildRhythmChart } from './chartGeometry';
import {
  FirstPrecipitationAnnouncement,
  ForecastChartAxis,
  ForecastChartBands,
  ForecastChartPlot,
} from './ForecastChart';
import type { ForecastAtlasCurrent } from './ForecastAtlasCurrent';
import { HourlyScrollNavigation } from './HourlyScrollNavigation';
import { HourlySource } from './HourlySource';
import { HourlySummary } from './HourlySummary';
import { buildHourlySummary } from './hourlySummaryData';
import { HourlyTimeline } from './HourlyTimeline';
import type { ForecastAtlasClock, HourlyDatum } from './types';
import { useHourlyViewport } from './useHourlyViewport';

interface HourlyForecastSectionProps {
  /** Forecast Atlas instance id (from `useId`). */
  id: string;
  meta: ForecastMeta;
  /** Number of raw hourly samples the provider returned. */
  hourlyCount: number;
  hourlyHorizonData: readonly HourlyDatum[];
  hourlyData: readonly HourlyDatum[];
  isFahrenheit: boolean;
  clock: ForecastAtlasClock;
  current?: ForecastAtlasCurrent;
}

/**
 * Hourly forecast: heading, summary, the scrolling
 * chart + hour strip with its navigation, and the data source line.
 */
export function HourlyForecastSection({
  id,
  meta,
  hourlyCount,
  hourlyHorizonData,
  hourlyData,
  isFahrenheit,
  clock,
  current,
}: HourlyForecastSectionProps) {
  // Always hourly; kept as a value so the chart and strip keep their tested geometry.
  const displayIntervalHours = 1;
  const { t } = useTranslation();
  const { settings } = useSettings();
  const hourlyViewportRef = useRef<HTMLDivElement>(null);
  const hoursRef = useRef<HTMLOListElement>(null);
  const plotRef = useRef<HTMLDivElement>(null);
  const [plotWidth, setPlotWidth] = useState(0);
  const [activeHourIndex, setActiveHourIndex] = useState<number | null>(null);
  const [tooltipSide, setTooltipSide] = useState<'left' | 'right'>('right');

  const intervalHours = meta.intervalHours;
  const realHourlyHorizon = Math.min(REAL_HOURLY_HORIZON, hourlyCount);
  const hourlyHeading =
    intervalHours === 1
      ? t('hava81.forecastAtlas.hourlyForecastNext', {
          hours: realHourlyHorizon,
          unit: t(
            settings.language === 'en' && realHourlyHorizon === 1
              ? 'hava81.forecastAtlas.hourUnitSingular'
              : 'hava81.forecastAtlas.hourUnitPlural'
          ),
        })
      : t('hava81.forecastAtlas.intervalForecast', { hours: intervalHours });

  const chart = useMemo(
    () => buildRhythmChart(hourlyData, hourlyHorizonData, isFahrenheit, plotWidth),
    [hourlyData, hourlyHorizonData, isFahrenheit, plotWidth]
  );
  const hourlySummary = useMemo(() => buildHourlySummary(hourlyHorizonData), [hourlyHorizonData]);

  const trackWidth = `max(100%, ${Math.max(
    MIN_CHART_WIDTH,
    hourlyData.length * MIN_DISPLAY_COLUMN_WIDTH + TRACK_GUTTER
  )}px)`;
  const { hourlyScroll, visibleWindow } = useHourlyViewport(
    hourlyViewportRef,
    hoursRef,
    hourlyData.length,
    displayIntervalHours
  );

  const hasChart = hourlyData.length >= 2;
  useLayoutEffect(() => {
    const plot = plotRef.current;
    if (!plot) return;
    const measure = () => {
      const width = Math.round(plot.getBoundingClientRect().width);
      setPlotWidth(previous => (previous === width ? previous : width));
    };
    measure();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    observer?.observe(plot);
    return () => observer?.disconnect();
  }, [hasChart]);

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
    // Flip the tooltip by where the pointer sits in the visible viewport, so
    // it never opens past the scroll edge on phones.
    const viewportRect = hourlyViewportRef.current?.getBoundingClientRect();
    if (viewportRect && viewportRect.width > 0) {
      const side = event.clientX > viewportRect.left + viewportRect.width * 0.55 ? 'left' : 'right';
      setTooltipSide(previous => (previous === side ? previous : side));
    }
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

  return (
    <section
      className="hava81-forecast-atlas__section hava81-forecast-atlas__rhythm"
      aria-labelledby={`${id}-hourly-title`}
    >
      <div className="hava81-forecast-atlas__hourly-toolbar">
        <h3 id={`${id}-hourly-title`} className="hava81-forecast-atlas__section-title">
          {hourlyHeading}
        </h3>
      </div>

      {hourlySummary ? <HourlySummary summary={hourlySummary} clock={clock} /> : null}

      <div
        ref={hourlyViewportRef}
        id={`${id}-hourly-viewport`}
        className="hava81-forecast-atlas__hourly-viewport"
        role="region"
        aria-label={t('hava81.forecastAtlas.hourlyRegion')}
        tabIndex={0}
      >
        {chart ? <ForecastChartAxis chart={chart} /> : null}
        <div
          className="hava81-forecast-atlas__hourly-track"
          style={{ width: trackWidth, paddingInlineStart: `${TRACK_GUTTER}px` }}
          onPointerMove={trackPointer}
          onPointerDown={trackPointer}
          onPointerLeave={() => setActiveHourIndex(null)}
        >
          {chart ? (
            <ForecastChartBands chart={chart} clock={clock} activeHourIndex={activeHourIndex} />
          ) : null}
          {chart ? (
            <ForecastChartPlot
              chart={chart}
              clock={clock}
              plotRef={plotRef}
              id={id}
              hourlyHeading={hourlyHeading}
              displayIntervalHours={displayIntervalHours}
              activeHourIndex={activeHourIndex}
              tooltipSide={tooltipSide}
            />
          ) : null}

          {chart?.firstPrecipitation ? (
            <FirstPrecipitationAnnouncement point={chart.firstPrecipitation} clock={clock} />
          ) : null}

          <HourlyTimeline
            hourlyData={hourlyData}
            hoursRef={hoursRef}
            displayIntervalHours={displayIntervalHours}
            activeHourIndex={activeHourIndex}
            clock={clock}
            current={current}
          />
        </div>
      </div>
      {hourlyScroll.scrollable ? (
        <HourlyScrollNavigation
          id={id}
          hourlyData={hourlyData}
          hourlyScroll={hourlyScroll}
          visibleWindow={visibleWindow}
          clock={clock}
          onScroll={scrollHourly}
        />
      ) : null}
      {intervalHours === 1 && meta?.provider ? <HourlySource meta={meta} /> : null}
    </section>
  );
}
