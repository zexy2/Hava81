interface Props {
  code: string;
  label?: string;
  className?: string;
}

export function WeatherIllustration({ code, label, className = '' }: Props) {
  const family = code.slice(0, 2);
  const night = code.endsWith('n');
  const cloud = ['02', '03', '04', '09', '10', '11', '13'].includes(family);
  const sun = ['02', '10'].includes(family) && !night;
  const moon = ['02', '10'].includes(family) && night;
  const rain = ['09', '10', '11'].includes(family);
  const snow = family === '13';
  const haze = family === '50';
  return (
    <svg
      className={className}
      viewBox="0 0 160 130"
      width="160"
      height="130"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-weather-code={code}
      focusable="false"
    >
      <defs>
        <linearGradient id="hava81-rich-cloud" x1="0" x2=".3" y1="0" y2="1">
          <stop offset="0" stopColor="#fff" />
          <stop offset=".65" stopColor="#edf7ff" />
          <stop offset="1" stopColor="#b6d4ee" />
        </linearGradient>
        <radialGradient id="hava81-rich-sun" cx=".4" cy=".38" r=".7">
          <stop offset="0" stopColor="#fff3ad" />
          <stop offset=".58" stopColor="#ffc95d" />
          <stop offset="1" stopColor="#f6a533" />
        </radialGradient>
        <linearGradient id="hava81-rich-moon" x1="0" x2="1" y1="0" y2="1">
          <stop stopColor="#fff4c0" />
          <stop offset="1" stopColor="#9ebfff" />
        </linearGradient>
        <filter id="hava81-rich-shadow" x="-30%" y="-40%" width="160%" height="190%">
          <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#4582ad" floodOpacity=".22" />
        </filter>
      </defs>
      {sun && <circle cx="111" cy="42" r="31" fill="url(#hava81-rich-sun)" />}
      {moon && (
        <path d="M126 21a32 32 0 1 0 8 53 29 29 0 0 1-8-53Z" fill="url(#hava81-rich-moon)" />
      )}
      {family === '01' && !cloud && !haze && !rain && (
        <circle
          cx="80"
          cy="63"
          r="43"
          fill={night ? 'url(#hava81-rich-moon)' : 'url(#hava81-rich-sun)'}
          filter="url(#hava81-rich-shadow)"
        />
      )}
      {cloud && (
        <g filter="url(#hava81-rich-shadow)">
          {family === '04' && (
            <path
              d="M29 73c-1-17 11-26 25-24 10-26 48-26 59 1 22 0 29 28 15 36H38C29 85 27 79 29 73Z"
              fill="#d8e9fa"
              opacity=".75"
            />
          )}
          <path
            d="M27 81c0-14 11-24 25-24 5 0 10 1 14 4 6-18 23-29 42-23 14 4 23 16 23 31 15 1 24 12 24 25 0 14-11 24-25 24H43c-17 0-28-14-25-27 1-5 4-8 9-10Z"
            fill="url(#hava81-rich-cloud)"
            stroke="#d1e5f6"
            strokeWidth="1.5"
          />
          <path
            d="M40 94c18 8 71 9 95-4"
            fill="none"
            stroke="white"
            strokeWidth="3"
            opacity=".75"
            strokeLinecap="round"
          />
        </g>
      )}
      {rain && (
        <g fill="none" stroke="#409fe1" strokeWidth="5" strokeLinecap="round">
          <path d="m56 114-5 10 M86 114l-5 10 M116 114l-5 10" />
        </g>
      )}
      {snow && (
        <g fill="#78bdf2">
          <circle cx="57" cy="119" r="4" />
          <circle cx="89" cy="124" r="4" />
          <circle cx="119" cy="119" r="4" />
        </g>
      )}
      {family === '11' && (
        <path
          d="m93 93-14 22h14l-8 18 30-29H99l9-11Z"
          fill="#ffd256"
          stroke="#f4ab33"
          strokeWidth="1"
        />
      )}
      {haze && (
        <g stroke="#aacadd" strokeWidth="9" strokeLinecap="round" opacity=".8">
          <path d="M25 45h100 M38 69h108 M14 94h110" />
        </g>
      )}
    </svg>
  );
}

export default WeatherIllustration;
