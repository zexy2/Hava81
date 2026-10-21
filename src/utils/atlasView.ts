/**
 * Top-level views reachable from the bottom navigation (mobile) and the header (desktop).
 *
 * Faz 2.5 added `?view=map` and `?view=compare`; Faz 2.3 adds `?view=plan` for the
 * secondary "Planla" surface (day plan, commute, activities, alerts, signals, route).
 * `today` is the default and is never written to the URL.
 */
export type AtlasView = 'today' | 'map' | 'compare' | 'plan';

const URL_VIEWS: ReadonlySet<AtlasView> = new Set(['map', 'compare', 'plan']);

/** Reads the initial view from a `location.search` string; unknown values fall back to today. */
export function parseAtlasView(search: string): AtlasView {
  const value = new URLSearchParams(search).get('view');
  return value && URL_VIEWS.has(value as AtlasView) ? (value as AtlasView) : 'today';
}

/**
 * The view that is actually on screen. The map is a panel that can be closed while the
 * navigation still says `map`, so it only counts as the map view while it is open.
 */
export function resolveAtlasView(activeNav: AtlasView, showMap: boolean): AtlasView {
  if (showMap) return 'map';
  return activeNav === 'map' ? 'today' : activeNav;
}

/**
 * Returns `pathname + search` with the `view` parameter set for `view`
 * (or removed for today). Other query parameters such as `?yer=` are kept.
 */
export function withAtlasView(href: string, view: AtlasView): string {
  const url = new URL(href, 'http://hava81.local');
  if (view === 'today') url.searchParams.delete('view');
  else url.searchParams.set('view', view);
  return `${url.pathname}${url.search}`;
}
