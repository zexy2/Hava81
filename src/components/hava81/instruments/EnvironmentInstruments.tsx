interface SunArcProps {
  /** Share of today's daylight already elapsed, 0–1 (clamped). */
  progress: number;
  night: boolean;
}

const W = 120;
const H = 56;
const R = 48;
const CX = W / 2;
const BASE = 52;

/** Day arc from sunrise to sunset with the sun at its current position. */
export function SunArc({ progress, night }: SunArcProps) {
  const p = Math.min(1, Math.max(0, progress));
  const angle = Math.PI * (1 - p);
  const sx = CX + R * Math.cos(angle);
  const sy = BASE - R * Math.sin(angle);
  const arc = `M ${CX - R} ${BASE} A ${R} ${R} 0 0 1 ${CX + R} ${BASE}`;
  const length = Math.PI * R;
  return (
    <svg className="instrument-sun" viewBox={`0 0 ${W} ${H + 2}`} aria-hidden="true" focusable="false">
      <line className="instrument-sun__horizon" x1="2" y1={BASE} x2={W - 2} y2={BASE} />
      <path className="instrument-sun__track" d={arc} />
      <path
        className="instrument-sun__elapsed"
        d={arc}
        style={{ strokeDasharray: `${(length * p).toFixed(2)} ${length.toFixed(2)}` }}
      />
      <circle
        className="instrument-sun__sun"
        data-night={night}
        cx={sx.toFixed(2)}
        cy={sy.toFixed(2)}
        r={6}
        data-sun-position={p.toFixed(3)}
      />
    </svg>
  );
}

interface WindCompassProps {
  /** Meteorological direction the wind blows from, degrees. */
  direction: number;
  active: boolean;
}

/** Compass rose; the needle points the way the air moves (from → to). */
export function WindCompass({ direction, active }: WindCompassProps) {
  const rotation = Math.round(((direction % 360) + 360) % 360);
  const ticks = Array.from({ length: 24 }, (_, index) => index * 15);
  return (
    <svg className="instrument-wind" viewBox="-2 -9 68 75" aria-hidden="true" focusable="false">
      <circle className="instrument-wind__ring" cx="32" cy="32" r="27" />
      {ticks.map(angle => (
        <line
          key={angle}
          className="instrument-wind__tick"
          data-major={angle % 90 === 0}
          x1="32"
          y1={angle % 90 === 0 ? 3 : 5}
          x2="32"
          y2="8"
          transform={`rotate(${angle} 32 32)`}
        />
      ))}
      <text className="instrument-wind__cardinal" x="32" y="-2" textAnchor="middle">
        N
      </text>
      {active ? (
        <g
          className="instrument-wind__needle"
          data-wind-arrow=""
          data-rotation={rotation}
          transform={`rotate(${rotation} 32 32)`}
        >
          <line x1="32" y1="14" x2="32" y2="46" />
          <path d="M26.5 40.5 32 49l5.5-8.5" />
          <circle cx="32" cy="14" r="2.4" />
        </g>
      ) : null}
    </svg>
  );
}

interface AqiScaleProps {
  /** OpenWeather AQI, 1 (good) – 5 (very poor); null when unknown. */
  aqi: number | null;
}

/** Five-step air-quality scale with the current step lit. */
export function AqiScale({ aqi }: AqiScaleProps) {
  return (
    <span className="instrument-aqi" aria-hidden="true">
      {[1, 2, 3, 4, 5].map(step => (
        <span
          key={step}
          className="instrument-aqi__segment"
          data-aqi-segment={step}
          data-active={aqi === step}
          data-passed={aqi !== null && step < aqi}
        />
      ))}
    </span>
  );
}
