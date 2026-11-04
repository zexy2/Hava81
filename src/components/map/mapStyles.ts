// OpenFreeMap: free vector tiles, commercial use allowed, no key (https://openfreemap.org).
// Positron reads quietly under weather layers; Dark keeps the same structure at night.
// The public instance has no SLA (#1757): `VITE_MAP_STYLE_BASE_URL` points the map at a
// self-hosted OpenFreeMap (same style names) or another host. scripts/apply-csp.mjs reads the
// same variable, so the CSP allows exactly that host. Check its terms and credits first.
const DEFAULT_STYLE_BASE = 'https://tiles.openfreemap.org/styles';

const styleBase = (): string => {
  const configured = import.meta.env.VITE_MAP_STYLE_BASE_URL?.trim();
  return configured && /^https:\/\//i.test(configured)
    ? configured.replace(/\/+$/, '')
    : DEFAULT_STYLE_BASE;
};

export const OPENFREEMAP_STYLES = {
  light: `${styleBase()}/positron`,
  dark: `${styleBase()}/dark`,
} as const;
export type MapTheme = keyof typeof OPENFREEMAP_STYLES;
