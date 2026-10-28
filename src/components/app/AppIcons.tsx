/** Header action icons for the app shell (decorative; buttons carry the labels). */

export const SearchIcon = () => (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.25 4.25" />
  </svg>
);

export const LocationIcon = () => (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
    <path d="M20 4 4 10.6l7 2.4 2.4 7Z" />
  </svg>
);

export const MapIcon = () => (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
    <path d="m3 5 5-2 8 3 5-2v15l-5 2-8-3-5 2Z" />
    <path d="M8 3v15M16 6v15" />
  </svg>
);

/** Sliders: reads as "preferences", not as weather. */
export const SettingsIcon = () => (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
    <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="17" r="2" />
  </svg>
);

export const StarIcon = ({ filled = false }: { filled?: boolean }) => (
  <svg
    aria-hidden="true"
    focusable="false"
    viewBox="0 0 24 24"
    className={filled ? 'is-filled' : undefined}
  >
    <path d="m12 3 2.7 5.47 6.04.88-4.37 4.26 1.03 6.02L12 16.8l-5.4 2.83 1.03-6.02-4.37-4.26 6.04-.88Z" />
  </svg>
);
