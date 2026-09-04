import type { ReactNode } from 'react';

export interface WeatherSymbolProps {
  code: string;
  size?: number;
  title?: string;
  label?: string;
  className?: string;
}

const renderSun = (cx = 24, cy = 22, radius = 7): ReactNode => (
  <g>
    <circle cx={cx} cy={cy} r={radius} />
    <path
      d={`M${cx} ${cy - radius - 5}v3 M${cx} ${cy + radius + 2}v3 M${cx - radius - 5} ${cy}h3 M${cx + radius + 2} ${cy}h3 M${cx - 9} ${cy - 9}l2.2 2.2 M${cx + 6.8} ${cy + 6.8}l2.2 2.2 M${cx + 9} ${cy - 9}l-2.2 2.2 M${cx - 6.8} ${cy + 6.8}l-2.2 2.2`}
    />
  </g>
);

const renderMoon = (x = 24, y = 23): ReactNode => (
  <path d={`M${x + 7} ${y - 12}A13 13 0 1 0 ${x + 10} ${y + 8}A14 14 0 0 1 ${x + 7} ${y - 12}Z`} />
);

const renderCloud = (offsetY = 0): ReactNode => (
  <path
    d={`M13 ${33 + offsetY}h22a7 7 0 0 0 .8-13.95A10.5 10.5 0 0 0 15.6 ${22 + offsetY} 5.5 5.5 0 0 0 13 ${33 + offsetY}Z`}
  />
);

const renderUnknown = (): ReactNode => (
  <g>
    <circle cx="24" cy="24" r="15" />
    <path d="M19.5 19a4.8 4.8 0 0 1 9.4 1.4c0 3.4-4.9 3.7-4.9 7.1v1.2 M24 34h.01" />
  </g>
);

const renderPrecipitation = (kind: 'rain' | 'shower' | 'snow'): ReactNode => {
  if (kind === 'snow') {
    return (
      <g>
        <path d="M16 37v7 M12.8 39l6.4 3.5 M19.2 39l-6.4 3.5" />
        <path d="M32 37v7 M28.8 39l6.4 3.5 M35.2 39l-6.4 3.5" />
        <path d="M24 36v8 M20.5 38l7 4 M27.5 38l-7 4" />
      </g>
    );
  }

  const d =
    kind === 'shower'
      ? 'M15 37l-2 5 M24 37l-2 5 M33 37l-2 5'
      : 'M18 37l-2 5 M26 37l-2 5 M34 37l-2 5';

  return <path d={d} />;
};

const renderSymbol = (code: string): ReactNode => {
  const family = code.slice(0, 2);
  const isNight = code.endsWith('n');

  switch (family) {
    case '01':
      return isNight ? renderMoon() : renderSun();
    case '02':
      return (
        <g>
          <g opacity="0.55">{isNight ? renderMoon(17, 18) : renderSun(17, 17, 5)}</g>
          {renderCloud()}
        </g>
      );
    case '03':
      return renderCloud();
    case '04':
      return (
        <g>
          <g opacity="0.45" transform="translate(5 -7) scale(.82)">
            {renderCloud()}
          </g>
          {renderCloud()}
        </g>
      );
    case '09':
      return (
        <g>
          {renderCloud(-3)}
          {renderPrecipitation('shower')}
        </g>
      );
    case '10':
      return (
        <g>
          <g opacity="0.45">{isNight ? renderMoon(17, 17) : renderSun(17, 16, 5)}</g>
          {renderCloud(-3)}
          {renderPrecipitation('rain')}
        </g>
      );
    case '11':
      return (
        <g>
          {renderCloud(-3)}
          <path d="M27 35h-6l4-7h7l-4 6h5l-10 11 4-10Z" />
        </g>
      );
    case '13':
      return (
        <g>
          {renderCloud(-3)}
          {renderPrecipitation('snow')}
        </g>
      );
    case '50':
      return (
        <g>
          <path d="M9 16h25 M14 23h25 M8 30h28 M15 37h23" />
          <path d="M36 16h3 M9 23h2 M38 30h2 M10 37h2" opacity="0.55" />
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
}: WeatherSymbolProps) {
  const accessibleName = (title ?? label)?.trim();
  const classes = ['hava81-weather-symbol', className].filter(Boolean).join(' ');

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
      {renderSymbol(code)}
    </svg>
  );
}

export default WeatherSymbol;
