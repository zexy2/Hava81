// OpenFreeMap: free vector tiles, commercial use allowed, no key (https://openfreemap.org).
// Positron reads quietly under weather layers; Dark keeps the same structure at night.
export const OPENFREEMAP_STYLES = {
  light: 'https://tiles.openfreemap.org/styles/positron',
  dark: 'https://tiles.openfreemap.org/styles/dark',
} as const;
export type MapTheme = keyof typeof OPENFREEMAP_STYLES;
