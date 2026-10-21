import { cityFromPathname, cityPath, isHomePathname } from './cityRoute';

// A district URL uses a query parameter rather than pretending to be a province.
// Keep the original, accented place name so the provider lookup survives refresh/share.
export const districtFromQuery = (search: string): string | null => {
  const district = new URLSearchParams(search).get('yer')?.trim();
  return district && /^[\p{L}][\p{L}\s'-]{1,79}$/u.test(district) ? district : null;
};

/**
 * The city the app opens with. Returning visitors should not have to grant
 * geolocation again just to see weather for a province they previously chose.
 * Never request location silently.
 */
export const resolveInitialCity = (location: Pick<Location, 'pathname' | 'search'>): string => {
  const routeCity = cityFromPathname(location.pathname);
  if (routeCity) return routeCity.name;
  if (!isHomePathname(location.pathname)) return '';
  const queriedDistrict = districtFromQuery(location.search);
  if (queriedDistrict) return `${queriedDistrict},TR`;
  try {
    const entries: unknown = JSON.parse(
      window.localStorage.getItem('recent_weather_searches') ?? '[]'
    );
    if (!Array.isArray(entries)) return 'İstanbul';
    for (const entry of entries) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
      const item = entry as { city?: unknown; timestamp?: unknown };
      if (typeof item.city !== 'string' || typeof item.timestamp !== 'number') continue;
      if (item.timestamp > Date.now() || Date.now() - item.timestamp > 30 * 86_400_000) continue;
      const path = cityPath(item.city);
      if (path) return cityFromPathname(path)?.name ?? '';
    }
  } catch {
    // Storage can be blocked or contain invalid JSON; fall back to İstanbul.
  }
  // Faz 2.4: first visit shows İstanbul immediately; location stays an explicit
  // choice in the header instead of a blocking gate.
  return 'İstanbul';
};
