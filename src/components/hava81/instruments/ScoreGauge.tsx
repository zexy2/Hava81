import type { CSSProperties } from 'react';

/** 270° sweep, opening at the bottom. */
const SWEEP = 270;
const START = 135;
const RADIUS = 52;
const CENTER = 64;
const TICKS = 21;

const polar = (angle: number, radius: number) => {
  const radians = (angle * Math.PI) / 180;
  return { x: CENTER + radius * Math.cos(radians), y: CENTER + radius * Math.sin(radians) };
};

const arc = (from: number, to: number, radius: number) => {
  const start = polar(from, radius);
  const end = polar(to, radius);
  const large = to - from > 180 ? 1 : 0;
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
};

interface Props {
  score: number;
  band: string;
  label: string;
}

/** Hava81 score as an instrument dial: a scale of ticks and one progress arc. */
export function ScoreGauge({ score, band, label }: Props) {
  const value = Math.min(100, Math.max(0, Math.round(score)));
  const track = arc(START, START + SWEEP, RADIUS);
  const length = (Math.PI * RADIUS * SWEEP) / 180;
  const ticks = Array.from({ length: TICKS }, (_, index) => {
    const angle = START + (SWEEP * index) / (TICKS - 1);
    const major = index % 5 === 0;
    const outer = polar(angle, RADIUS + 9);
    const inner = polar(angle, RADIUS + (major ? 3 : 5));
    return { index, major, outer, inner, lit: (index / (TICKS - 1)) * 100 <= value };
  });
  return (
    <svg className="score-gauge" data-band={band} viewBox="0 0 128 128" role="img" aria-label={label}>
      <path className="score-gauge__track" d={track} />
      <path
        className="score-gauge__progress"
        d={track}
        data-gauge-progress=""
        style={
          {
            strokeDasharray: `${length.toFixed(2)}`,
            '--gauge-length': `${length.toFixed(2)}`,
            '--gauge-offset': `${(length * (1 - value / 100)).toFixed(2)}`,
            strokeDashoffset: 'var(--gauge-offset)',
          } as CSSProperties
        }
      />
      {ticks.map(tick => (
        <line
          key={tick.index}
          className="score-gauge__tick"
          data-gauge-tick=""
          data-major={tick.major}
          data-lit={tick.lit}
          x1={tick.inner.x.toFixed(2)}
          y1={tick.inner.y.toFixed(2)}
          x2={tick.outer.x.toFixed(2)}
          y2={tick.outer.y.toFixed(2)}
        />
      ))}
    </svg>
  );
}
