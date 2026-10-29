import type { ReactNode } from 'react';
import './weatherSymbol.css';

export interface WeatherSymbolProps {
  code: string;
  size?: number;
  title?: string;
  label?: string;
  className?: string;
  /** Gentle motion for the one symbol that represents "now"; off under reduced motion. */
  animated?: boolean;
}

/**
 * Atlas symbol set: hand-drawn on a 48-unit grid, two-tone (filled shape + outline),
 * colour-coded by element so the eye reads sun, rain or storm before any text. Every
 * drawing tags its parts (`data-part`) so colour, motion and tests share one vocabulary.
 * Detail follows size: small symbols keep one clean shape, larger ones add a back cloud.
 */

/** Detail threshold in px: from here a second cloud and soft light are drawn. */
const DETAILED_SIZE = 34;

const CLOUD = 'M14 36h21a7.5 7.5 0 0 0 1.2-14.9A11 11 0 0 0 15.4 23.6 6.2 6.2 0 0 0 14 36Z';
const BACK_CLOUD = 'M24.5 21.5a8.6 8.6 0 0 1 15.4 2.6 6 6 0 0 1 1.6 11.6';

const sun = (cx: number, cy: number, radius: number, rays = true): ReactNode => (
  <g className="weather-symbol__sun-group">
    {rays ? (
      <g
        className="weather-symbol__rays"
        data-part="ray"
        style={{ transformOrigin: `${cx}px ${cy}px` }}
      >
        {Array.from({ length: 8 }, (_, index) => {
          const angle = (index * Math.PI) / 4;
          const inner = radius + 3;
          const outer = radius + 6;
          return (
            <path
              key={index}
              d={`M${(cx + Math.cos(angle) * inner).toFixed(2)} ${(cy + Math.sin(angle) * inner).toFixed(2)}L${(cx + Math.cos(angle) * outer).toFixed(2)} ${(cy + Math.sin(angle) * outer).toFixed(2)}`}
            />
          );
        })}
      </g>
    ) : null}
    <circle data-part="sun" cx={cx} cy={cy} r={radius} />
  </g>
);

const moon = (cx: number, cy: number, radius: number): ReactNode => (
  <path
    data-part="moon"
    d={`M${cx + radius * 0.35} ${cy - radius}A${radius} ${radius} 0 1 0 ${cx + radius} ${cy + radius * 0.45}A${radius * 0.78} ${radius * 0.78} 0 0 1 ${cx + radius * 0.35} ${cy - radius}Z`}
  />
);

const star = (cx: number, cy: number): ReactNode => (
  <path
    data-part="star"
    className="weather-symbol__star"
    d={`M${cx} ${cy - 2.6}L${cx + 0.8} ${cy - 0.8}L${cx + 2.6} ${cy}L${cx + 0.8} ${cy + 0.8}L${cx} ${cy + 2.6}L${cx - 0.8} ${cy + 0.8}L${cx - 2.6} ${cy}L${cx - 0.8} ${cy - 0.8}Z`}
  />
);

const cloud = (tone: 'light' | 'heavy' | 'storm', offsetY = 0): ReactNode => (
  <path
    data-part="cloud"
    data-tone={tone}
    d={CLOUD}
    transform={offsetY ? `translate(0 ${offsetY})` : undefined}
  />
);

const backCloud = (offsetY = 0): ReactNode => (
  <path
    data-part="cloud"
    data-tone="back"
    d={`${BACK_CLOUD}`}
    transform={offsetY ? `translate(0 ${offsetY})` : undefined}
  />
);

/** A teardrop whose tip points along the fall direction. */
const drop = (x: number, y: number, index: number, slant = 0): ReactNode => (
  <path
    key={`drop-${index}`}
    data-part="drop"
    className="weather-symbol__drop"
    style={{ animationDelay: `${index * 0.35}s` }}
    d={`M${x + slant} ${y}c-1.6 2.4-2.6 3.9-2.6 5.2a2.6 2.6 0 0 0 5.2 0c0-1.3-1-2.8-2.6-5.2Z`}
    transform={slant ? `rotate(${slant * 4} ${x} ${y + 4})` : undefined}
  />
);

const flake = (x: number, y: number, index: number): ReactNode => (
  <g
    key={`flake-${index}`}
    data-part="flake"
    className="weather-symbol__flake"
    style={{ animationDelay: `${index * 0.5}s` }}
  >
    <path d={`M${x} ${y - 3}v6 M${x - 2.6} ${y - 1.5}l5.2 3 M${x + 2.6} ${y - 1.5}l-5.2 3`} />
  </g>
);

const renderUnknown = (): ReactNode => (
  <g data-part="unknown">
    <circle cx="24" cy="24" r="15" />
    <path d="M19.5 19a4.8 4.8 0 0 1 9.4 1.4c0 3.4-4.9 3.7-4.9 7.1v1.2 M24 34h.01" />
  </g>
);

const renderSymbol = (code: string, detailed: boolean): ReactNode => {
  const family = code.slice(0, 2);
  const isNight = code.endsWith('n');
  const peek = isNight ? moon(17, 17, 7) : sun(17, 17, 5.5, detailed);

  switch (family) {
    case '01':
      return isNight ? (
        <g>
          {moon(23, 24, 11)}
          {star(36, 13)}
        </g>
      ) : (
        sun(24, 24, 8.5)
      );
    case '02':
      return (
        <g>
          {peek}
          {cloud('light', 2)}
        </g>
      );
    case '03':
      return (
        <g>
          {detailed ? backCloud(-1) : null}
          {cloud('light')}
        </g>
      );
    case '04':
      return (
        <g>
          {detailed ? backCloud(-3) : null}
          {cloud('heavy')}
        </g>
      );
    case '09':
      return (
        <g>
          {detailed ? backCloud(-7) : null}
          {cloud('heavy', -6)}
          {drop(16, 34, 0, -1)}
          {drop(24, 35, 1, -1)}
          {drop(32, 34, 2, -1)}
        </g>
      );
    case '10':
      return (
        <g>
          <g transform="translate(0 -3)">{peek}</g>
          {cloud('light', -6)}
          {drop(19, 34, 0)}
          {drop(29, 34, 1)}
        </g>
      );
    case '11':
      return (
        <g>
          {detailed ? backCloud(-7) : null}
          {cloud('storm', -6)}
          <path
            data-part="bolt"
            className="weather-symbol__bolt"
            d="M25.5 29l-5.5 8.5h4.6l-2.6 7.5 8.2-10h-4.8l3.1-6Z"
          />
        </g>
      );
    case '13':
      return (
        <g>
          {cloud('light', -6)}
          {flake(17, 37, 0)}
          {flake(25, 40, 1)}
          {flake(33, 37, 2)}
        </g>
      );
    case '50':
      return (
        <g data-part="mist">
          <path d="M10 17h22 M16 24h24 M9 31h26 M15 38h20" />
          <path d="M35 17h3 M10 24h2 M38 31h1 M38 38h1" opacity="0.5" />
        </g>
      );
    default:
      return renderUnknown();
  }
};

export function WeatherSymbol({
  code,
  size = 28,
  title,
  label,
  className = '',
  animated = false,
}: WeatherSymbolProps) {
  const accessibleName = (title ?? label)?.trim();
  const classes = ['hava81-weather-symbol', animated ? 'is-animated' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <svg
      className={classes}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      focusable="false"
      role={accessibleName ? 'img' : undefined}
      aria-label={accessibleName || undefined}
      aria-hidden={accessibleName ? undefined : true}
      data-weather-code={code}
    >
      {accessibleName ? <title>{accessibleName}</title> : null}
      {renderSymbol(code, size >= DETAILED_SIZE)}
    </svg>
  );
}

export default WeatherSymbol;
