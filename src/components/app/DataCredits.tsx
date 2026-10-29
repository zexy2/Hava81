import { useTranslation } from 'react-i18next';

const MET_NORWAY_URL = 'https://api.met.no/';
const OPEN_METEO_URL = 'https://open-meteo.com/';
const OPENWEATHER_URL = 'https://openweathermap.org/';
const CC_BY_URL = 'https://creativecommons.org/licenses/by/4.0/';
const OSM_COPYRIGHT_URL = 'https://www.openstreetmap.org/copyright';

/**
 * OpenWeather's free plan requires the text "Weather data provided by OpenWeather", a link
 * and the logo (https://openweathermap.org/faq). Both theme variants ship; CSS shows one.
 */
export function OpenWeatherCredit() {
  return (
    <a
      className="data-credit data-credit--openweather"
      href={OPENWEATHER_URL}
      target="_blank"
      rel="noreferrer"
      title="Weather data provided by OpenWeather"
    >
      <img
        className="data-credit__logo data-credit__logo--light"
        src="/attribution/openweather-logo.webp"
        alt="OpenWeather"
        width={56}
        height={24}
        loading="lazy"
        decoding="async"
      />
      <img
        className="data-credit__logo data-credit__logo--dark"
        src="/attribution/openweather-logo-negative.webp"
        alt=""
        aria-hidden="true"
        width={56}
        height={24}
        loading="lazy"
        decoding="async"
      />
    </a>
  );
}

/**
 * Footer credits for the sources actually in use: the forecast provider reported by the API
 * (MET Norway by default, Open-Meteo on a paid plan), OpenWeather for current conditions,
 * chance of rain and air quality, and the map tiles.
 */
export function DataCredits({ forecastProvider }: { forecastProvider?: string }) {
  const { t } = useTranslation();
  const separator = <span aria-hidden="true"> · </span>;
  return (
    <p className="atlas-footer__credits">
      <span>{t('hava81.footerData')}</span>{' '}
      {forecastProvider === 'Open-Meteo' ? (
        <a href={OPEN_METEO_URL} target="_blank" rel="noreferrer">
          Open-Meteo
        </a>
      ) : (
        <>
          <a href={MET_NORWAY_URL} target="_blank" rel="noreferrer">
            MET Norway
          </a>{' '}
          <a href={CC_BY_URL} target="_blank" rel="noreferrer">
            CC BY 4.0
          </a>
        </>
      )}
      {separator}
      <OpenWeatherCredit />
      {separator}
      <a href={OSM_COPYRIGHT_URL} target="_blank" rel="noreferrer">
        OpenStreetMap
      </a>
    </p>
  );
}
