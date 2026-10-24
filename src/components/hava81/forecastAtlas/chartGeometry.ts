import type { CSSProperties } from 'react';
import {
  AREA_BASELINE,
  CHART_BOTTOM,
  CHART_COLUMN_UNITS,
  CHART_HEIGHT,
  CHART_TOP,
  PRECIPITATION_THRESHOLD,
  RAIN_GAUGE_CELLS,
  TRACK_GUTTER,
} from './constants';
import {
  TEMPERATURE_SCALE_DARK,
  TEMPERATURE_SCALE_LIGHT,
  temperatureColor,
} from './temperatureColor';
import type { HourlyDatum } from './types';

interface ChartCoordinate {
  x: number;
  y: number;
}

export const buildSmoothPath = (points: readonly ChartCoordinate[]): string => {
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

export type RhythmPoint = HourlyDatum & {
  index: number;
  x: number;
  xPercent: number;
  y: number;
  isNight: boolean;
  isRainSignal: boolean;
};

export type RhythmChart = NonNullable<ReturnType<typeof buildRhythmChart>>;

/**
 * Geometry for the hourly rhythm chart: curve and area paths, axis ticks, the
 * rain gauge, temperature-coloured gradient stops and night bands. Pure: the
 * same input always yields the same chart.
 */
export const buildRhythmChart = (
  hourlyData: readonly HourlyDatum[],
  hourlyHorizonData: readonly HourlyDatum[],
  isFahrenheit: boolean,
  plotWidth: number
) => {
  if (hourlyData.length < 2) return null;

  const horizonTemperatures = hourlyHorizonData.map(hour => hour.convertedTemp);
  const min = Math.min(...horizonTemperatures);
  const max = Math.max(...horizonTemperatures);
  const range = max - min;
  const count = hourlyData.length;
  // Real pixel columns once the plot is measured, so the SVG scales 1:1 and
  // the curve can draw itself with stroke-dashoffset (no stretched strokes).
  const columnWidth = plotWidth > 0 ? plotWidth / count : CHART_COLUMN_UNITS;
  const width = columnWidth * count;
  const drawableHeight = CHART_HEIGHT - CHART_TOP - CHART_BOTTOM;

  const points: RhythmPoint[] = hourlyData.map((hour, index) => ({
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
      (typeof hour.precipitation === 'number' &&
        Number.isFinite(hour.precipitation) &&
        hour.precipitation >= PRECIPITATION_THRESHOLD) ||
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

  // Rain chance reads as a five-cell gauge per hour: any chance lights at
  // least one cell, so 2-8% stays legible, and colour deepens with each
  // level. Measurable rain with a rounded 0% chance still lights one cell.
  const rainBars = points
    .filter(
      point =>
        (typeof point.precipitation === 'number' && point.precipitation > 0) ||
        (point.precipitationMm ?? 0) > 0
    )
    .map(point => {
      const probability =
        typeof point.precipitation === 'number' && Number.isFinite(point.precipitation)
          ? point.precipitation
          : 0;
      return {
        key: point.timestamp,
        index: point.index,
        level: Math.max(
          1,
          Math.min(RAIN_GAUGE_CELLS, Math.ceil(Math.min(1, probability) * RAIN_GAUGE_CELLS))
        ),
        signal: point.isRainSignal,
      };
    });

  // Gradient stops sample the temperature at evenly spaced heights, from the
  // top of the curve band (max) to the area baseline (below min = min).
  const toCelsius = (value: number) => (isFahrenheit ? ((value - 32) * 5) / 9 : value);
  const temperatureAtY = (y: number) => {
    if (range === 0) return toCelsius(max);
    const clamped = Math.min(CHART_TOP + drawableHeight, Math.max(CHART_TOP, y));
    return toCelsius(max - ((clamped - CHART_TOP) / drawableHeight) * range);
  };
  const gradientStops = Array.from({ length: 7 }, (_, index) => {
    const offset = index / 6;
    const y = CHART_TOP + offset * (AREA_BASELINE - CHART_TOP);
    const celsius = temperatureAtY(y);
    return {
      offset,
      light: temperatureColor(celsius, TEMPERATURE_SCALE_LIGHT),
      dark: temperatureColor(celsius, TEMPERATURE_SCALE_DARK),
    };
  });
  const pointColors = points.map(point => ({
    light: temperatureColor(toCelsius(point.convertedTemp), TEMPERATURE_SCALE_LIGHT),
    dark: temperatureColor(toCelsius(point.convertedTemp), TEMPERATURE_SCALE_DARK),
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
    gradientStops,
    pointColors,
    rainBars,
    width,
    yTicks,
  };
};

// Full-height column boxes (night, twilight, now, hover) live in the track,
// which reserves TRACK_GUTTER on the left for the sticky axis.
export const columnBox = (start: number, span: number, count: number): CSSProperties => ({
  left: `calc(${TRACK_GUTTER}px + (100% - ${TRACK_GUTTER}px) * ${start / count})`,
  width: `calc((100% - ${TRACK_GUTTER}px) * ${span / count})`,
});
