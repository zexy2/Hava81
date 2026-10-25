import { useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { TFunction } from 'i18next';
import type { NormalizedWeatherData } from '../types/weather.types';
import { districtFromQuery } from '../utils/appRoute';
import type { AtlasView } from '../utils/atlasView';
import { withAtlasView } from '../utils/atlasView';
import { cityFromPathname, cityPath, homePath, isHomePathname } from '../utils/cityRoute';
import { ROOT_DOCUMENT_METADATA, ROOT_DOCUMENT_METADATA_EN } from '../utils/rootDocumentMetadata';

interface AppRoutingOptions {
  weather: NormalizedWeatherData | null;
  currentView: AtlasView;
  language: string;
  t: TFunction;
  fetchWeather: (city?: string) => unknown;
  clearWeather: () => void;
  setShowMap: Dispatch<SetStateAction<boolean>>;
  setActiveNav: Dispatch<SetStateAction<AtlasView>>;
}

/**
 * Keeps the URL and the document head in step with the app:
 * back/forward loads the city in the URL (`/<il>/` or `/?yer=<ilçe>`), the shown
 * city is written to the URL with its title, canonical and social metadata,
 * and `?view=` mirrors the open view (Faz 2.5 + 2.3).
 */
export function useAppRouting({
  weather,
  currentView,
  language,
  t,
  fetchWeather,
  clearWeather,
  setShowMap,
  setActiveNav,
}: AppRoutingOptions) {
  const rootDocumentMetadataRef = useRef({
    title: ROOT_DOCUMENT_METADATA.title,
    description: ROOT_DOCUMENT_METADATA.description,
    ogTitle: ROOT_DOCUMENT_METADATA.title,
    ogDescription: ROOT_DOCUMENT_METADATA.socialDescription,
    ogImageAlt: ROOT_DOCUMENT_METADATA.title,
    twitterTitle: ROOT_DOCUMENT_METADATA.title,
    twitterDescription: ROOT_DOCUMENT_METADATA.socialDescription,
    twitterImageAlt: ROOT_DOCUMENT_METADATA.title,
  });

  useEffect(() => {
    const handlePopState = () => {
      const routeCity = cityFromPathname(window.location.pathname);
      if (routeCity) {
        // `useAsync` deliberately preserves the last successful payload during a
        // refresh. On browser back/forward, that payload may belong to another
        // province; clear it before fetching so the route and displayed evidence
        // cannot temporarily describe different cities.
        const targetCityPath = cityPath(routeCity.name, 'tr');
        const currentCityPath = weather ? cityPath(weather.cityName, 'tr') : null;
        if (weather && targetCityPath && currentCityPath !== targetCityPath) {
          clearWeather();
        }
        void fetchWeather(routeCity.name);
        return;
      }
      const district = isHomePathname(window.location.pathname)
        ? districtFromQuery(window.location.search)
        : null;
      if (district) {
        void fetchWeather(`${district},TR`);
        return;
      }
      if (isHomePathname(window.location.pathname)) {
        clearWeather();
        setShowMap(false);
        setActiveNav('today');
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [clearWeather, fetchWeather, setActiveNav, setShowMap, weather]);

  useEffect(() => {
    const setMetaContent = (selector: string, content: string) => {
      const meta = document.querySelector<HTMLMetaElement>(selector);
      if (meta) meta.content = content;
    };
    // Faz 4: hreflang alternates follow the shown page (TR `/…`, EN `/en/…`).
    const setAlternates = (trPath: string | null, enPath: string | null) => {
      for (const [hreflang, path] of [
        ['tr', trPath],
        ['en', enPath],
        ['x-default', trPath],
      ] as const) {
        let link = document.querySelector<HTMLLinkElement>(
          `link[rel="alternate"][hreflang="${hreflang}"]`
        );
        if (!path) {
          link?.remove();
          continue;
        }
        if (!link) {
          link = document.createElement('link');
          link.rel = 'alternate';
          link.hreflang = hreflang;
          document.head.appendChild(link);
        }
        link.href = new URL(path, window.location.origin).toString();
      }
    };

    const updateCityMetadata = (cityName: string, path: string | null) => {
      const cityTitle = t('hava81.cityDocumentTitle', { city: cityName });
      const cityDescription = t('hava81.cityDocumentDescription', { city: cityName });
      document.title = cityTitle;
      if (!path) return;

      const canonicalUrl = new URL(path, window.location.origin).toString();
      let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (!canonical) {
        canonical = document.createElement('link');
        canonical.rel = 'canonical';
        document.head.appendChild(canonical);
      }
      canonical.href = canonicalUrl;
      setMetaContent('meta[name="description"]', cityDescription);
      setMetaContent('meta[property="og:url"]', canonicalUrl);
      setMetaContent('meta[property="og:title"]', cityTitle);
      setMetaContent('meta[property="og:description"]', cityDescription);
      setMetaContent('meta[property="og:image:alt"]', cityTitle);
      setMetaContent('meta[name="twitter:title"]', cityTitle);
      setMetaContent('meta[name="twitter:description"]', cityDescription);
      setMetaContent('meta[name="twitter:image:alt"]', cityTitle);
      setMetaContent('meta[property="og:locale"]', language === 'en' ? 'en_US' : 'tr_TR');
      setMetaContent('meta[property="og:locale:alternate"]', language === 'en' ? 'tr_TR' : 'en_US');
    };

    if (!weather) {
      // A city slug already gives us canonical identity. Keep the URL and head
      // locale-correct while the live weather request is slow or unavailable.
      const routeCity = cityFromPathname(window.location.pathname);
      if (routeCity) {
        const path = cityPath(routeCity.name, language);
        if (!path) return;
        if (window.location.pathname !== path) {
          window.history.replaceState(
            window.history.state,
            '',
            `${path}${window.location.search}${window.location.hash}`
          );
        }
        setAlternates(cityPath(routeCity.name, 'tr'), cityPath(routeCity.name, 'en'));
        updateCityMetadata(routeCity.name, path);
        return;
      }
      if (!isHomePathname(window.location.pathname)) return;
      const rootMetadata =
        language === 'en'
          ? {
              title: ROOT_DOCUMENT_METADATA_EN.title,
              description: ROOT_DOCUMENT_METADATA_EN.description,
              ogTitle: ROOT_DOCUMENT_METADATA_EN.title,
              ogDescription: ROOT_DOCUMENT_METADATA_EN.socialDescription,
              ogImageAlt: ROOT_DOCUMENT_METADATA_EN.title,
              twitterTitle: ROOT_DOCUMENT_METADATA_EN.title,
              twitterDescription: ROOT_DOCUMENT_METADATA_EN.socialDescription,
              twitterImageAlt: ROOT_DOCUMENT_METADATA_EN.title,
            }
          : rootDocumentMetadataRef.current;
      const home = homePath(language);
      if (window.location.pathname !== home) {
        window.history.replaceState(window.history.state, '', `${home}${window.location.search}`);
      }
      setAlternates('/', '/en/');
      const canonicalUrl = new URL(home, window.location.origin).toString();
      document.title = rootMetadata.title;
      let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
      if (!canonical) {
        canonical = document.createElement('link');
        canonical.rel = 'canonical';
        document.head.appendChild(canonical);
      }
      canonical.href = canonicalUrl;
      setMetaContent('meta[name="description"]', rootMetadata.description);
      setMetaContent('meta[property="og:url"]', canonicalUrl);
      setMetaContent('meta[property="og:title"]', rootMetadata.ogTitle);
      setMetaContent('meta[property="og:description"]', rootMetadata.ogDescription);
      setMetaContent('meta[property="og:image:alt"]', rootMetadata.ogImageAlt);
      setMetaContent('meta[name="twitter:title"]', rootMetadata.twitterTitle);
      setMetaContent('meta[name="twitter:description"]', rootMetadata.twitterDescription);
      setMetaContent('meta[name="twitter:image:alt"]', rootMetadata.twitterImageAlt);
      setMetaContent('meta[property="og:locale"]', language === 'en' ? 'en_US' : 'tr_TR');
      setMetaContent('meta[property="og:locale:alternate"]', language === 'en' ? 'tr_TR' : 'en_US');
      return;
    }
    const path =
      cityPath(weather.cityName, language) ??
      (weather.country.toUpperCase() === 'TR'
        ? `${homePath(language)}?yer=${encodeURIComponent(weather.cityName)}`
        : null);
    setAlternates(cityPath(weather.cityName, 'tr'), cityPath(weather.cityName, 'en'));
    const searchWithoutView = new URLSearchParams(window.location.search);
    searchWithoutView.delete('view');
    const currentSearch = searchWithoutView.toString();
    if (path && `${window.location.pathname}${currentSearch ? `?${currentSearch}` : ''}` !== path) {
      const previousCity =
        cityFromPathname(window.location.pathname)?.name ??
        districtFromQuery(window.location.search);
      const historyMethod =
        previousCity && previousCity !== weather.cityName ? 'pushState' : 'replaceState';
      window.history[historyMethod]({ city: weather.cityName }, '', path);
    }
    updateCityMetadata(weather.cityName, path);
  }, [language, t, weather]);

  useEffect(() => {
    if (!weather) return;
    const current = `${window.location.pathname}${window.location.search}`;
    const next = withAtlasView(current, currentView);
    if (next === current) return;
    window.history.replaceState(window.history.state, '', next);
  }, [currentView, weather]);
}
