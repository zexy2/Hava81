import { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { cityPath, homePath, suggestProvincesForPath } from '../../utils/cityRoute';

interface NotFoundStateProps {
  pathname: string;
  language: string;
  onSearch: () => void;
}

/**
 * Faz 4: the real 404 view. GitHub Pages answers unknown paths with 404.html (HTTP 404,
 * `noindex`); the app then explains that no province lives at this address and suggests
 * the closest province names as real links.
 */
export function NotFoundState({ pathname, language, onSearch }: NotFoundStateProps) {
  const { t } = useTranslation();
  const suggestions = useMemo(() => suggestProvincesForPath(pathname), [pathname]);
  let shownPath = pathname;
  try {
    shownPath = decodeURI(pathname);
  } catch {
    // Keep the raw path when it cannot be decoded.
  }

  useEffect(() => {
    document.title = t('hava81.notFound.documentTitle');
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement('meta');
      robots.name = 'robots';
      document.head.appendChild(robots);
    }
    robots.content = 'noindex';
  }, [t]);

  return (
    <section className="atlas-empty atlas-not-found" aria-labelledby="atlas-not-found-title">
      <span className="atlas-kicker">{t('hava81.notFound.eyebrow')}</span>
      <h1 id="atlas-not-found-title">{t('hava81.notFound.title')}</h1>
      <p>{t('hava81.notFound.body', { path: shownPath })}</p>
      {suggestions.length > 0 && (
        <nav aria-labelledby="atlas-not-found-suggestions">
          <h2 id="atlas-not-found-suggestions" className="atlas-not-found__heading">
            {t('hava81.notFound.suggestions')}
          </h2>
          <ul className="atlas-not-found__list">
            {suggestions.map(city => (
              <li key={city.plateCode}>
                <a
                  className="atlas-button"
                  href={cityPath(city.name, language) ?? homePath(language)}
                >
                  {city.name}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <div className="atlas-empty__actions">
        <button type="button" className="atlas-button atlas-button--primary" onClick={onSearch}>
          {t('hava81.notFound.search')}
        </button>
        <a className="atlas-button" href={homePath(language)}>
          {t('hava81.notFound.home')}
        </a>
      </div>
    </section>
  );
}
