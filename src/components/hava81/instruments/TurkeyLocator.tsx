import { TURKEY_PATH, TURKEY_VIEWBOX, projectTurkey } from './turkeyOutline';

interface Props {
  lat: number;
  lon: number;
}

/** Türkiye silhouette with the city placed by its real coordinates. */
export function TurkeyLocator({ lat, lon }: Props) {
  const { x, y } = projectTurkey(lon, lat);
  const clampedX = Math.min(1, Math.max(0, x));
  const clampedY = Math.min(1, Math.max(0, y));
  const cx = clampedX * TURKEY_VIEWBOX.width;
  const cy = clampedY * TURKEY_VIEWBOX.height;
  return (
    <svg
      className="instrument-map"
      viewBox={`-4 -4 ${TURKEY_VIEWBOX.width + 8} ${TURKEY_VIEWBOX.height + 8}`}
      aria-hidden="true"
      focusable="false"
    >
      <path className="instrument-map__land" d={TURKEY_PATH} />
      <circle className="instrument-map__halo" cx={cx} cy={cy} r={11} />
      <circle
        className="instrument-map__dot"
        cx={cx}
        cy={cy}
        r={5}
        data-city-dot=""
        data-x={clampedX.toFixed(3)}
        data-y={clampedY.toFixed(3)}
      />
    </svg>
  );
}
