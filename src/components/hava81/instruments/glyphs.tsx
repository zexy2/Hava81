/** Line icons for the decision facts and the warning strip (24px grid, currentColor). */

const base = {
  viewBox: '0 0 24 24',
  'aria-hidden': true,
  focusable: false,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export function ClockGlyph() {
  return (
    <svg {...base}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function UmbrellaGlyph() {
  return (
    <svg {...base}>
      <path d="M3.5 12a8.5 8.5 0 0 1 17 0Z" />
      <path d="M12 12v6.5a2 2 0 0 1-4 0" />
      <path d="M12 3.5v-1" />
    </svg>
  );
}

export function StormGlyph() {
  return (
    <svg {...base}>
      <path d="M7 16.5H6a4 4 0 1 1 .9-7.9A5.5 5.5 0 0 1 17.6 9a3.8 3.8 0 0 1 .4 7.5h-1" />
      <path d="m12.5 12-2.5 4h3l-2 4" />
    </svg>
  );
}

export function DropGlyph() {
  return (
    <svg {...base}>
      <path d="M12 3.5s5.5 6.1 5.5 10a5.5 5.5 0 0 1-11 0c0-3.9 5.5-10 5.5-10Z" />
    </svg>
  );
}
