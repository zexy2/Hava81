import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { trackProductEvent } from '../../analytics/productEvents';
import { useSettings } from '../../context';
import { weatherService } from '../../api/weatherService';
import { TURKISH_CITIES } from '../../constants/cities';
import type { RouteWeatherResult } from '../../types';
import { getScoreBand } from '../../domain/decision/scoreWeatherWindow';
import { citySlug } from '../../utils/cityRoute';
import { formatPrecipitationSummary } from '../../utils/precipitation';
import {
  formatTurkeyTime,
  parseTurkeyLocalInputValue,
  toTurkeyLocalInputValue,
} from '../../utils/turkeyTime';
import './RouteWeatherPanel.css';

interface Props {
  currentCityName: string;
}

const ROUTE_MAX_DEPARTURE_MS = 18 * 60 * 60_000;
const ROUTE_DEPARTURE_PAST_TOLERANCE_MS = 60_000;

const canonicalProvinceName = (name: string): string => {
  const slug = citySlug(name);
  return TURKISH_CITIES.find(city => citySlug(city.name) === slug)?.name ?? name;
};

export function RouteWeatherPanel({ currentCityName }: Props) {
  const { t, i18n } = useTranslation();
  const { convertTemperature, convertWindSpeed, getTemperatureSymbol, getWindSpeedSymbol } =
    useSettings();
  const initialOrigin = canonicalProvinceName(currentCityName);
  const initialDestination = initialOrigin === 'Ankara' ? 'İstanbul' : 'Ankara';
  const [originName, setOriginName] = useState(initialOrigin);
  const [destinationName, setDestinationName] = useState(initialDestination);
  const [departure, setDeparture] = useState(() =>
    toTurkeyLocalInputValue(new Date(Date.now() + 60 * 60_000))
  );
  const [departureBoundsNow, setDepartureBoundsNow] = useState(() => Date.now());
  const [departureEdited, setDepartureEdited] = useState(false);
  const [result, setResult] = useState<RouteWeatherResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const origin = useMemo(() => TURKISH_CITIES.find(city => city.name === originName), [originName]);
  const routeSelectionStatusId = originName === destinationName ? 'route-weather-same-city' : undefined;
  const destination = useMemo(
    () => TURKISH_CITIES.find(city => city.name === destinationName),
    [destinationName]
  );
  const formatTime = (iso: string) => formatTurkeyTime(new Date(iso), i18n.language);
  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(i18n.language.startsWith('en') ? 'en-US' : 'tr-TR'),
    [i18n.language]
  );
  const temperatureSymbol = getTemperatureSymbol();
  const windSpeedSymbol = getWindSpeedSymbol();
  const formatPrecipitation = (probabilityPercent: number, amount?: number) =>
    formatPrecipitationSummary(
      probabilityPercent / 100,
      amount,
      i18n.language,
      t('hava81.route.noRain')
    );
  const invalidateRequest = () => {
    requestIdRef.current += 1;
    setResult(null);
    setError(null);
    setLoading(false);
  };
  const swapEndpoints = () => {
    setOriginName(destinationName);
    setDestinationName(originName);
    invalidateRequest();
  };

  const refreshDepartureBounds = () => {
    const now = Date.now();
    setDepartureBoundsNow(now);
    if (departureEdited) return;
    const departureDate = parseTurkeyLocalInputValue(departure);
    if (!departureDate || departureDate.getTime() < now - ROUTE_DEPARTURE_PAST_TOLERANCE_MS) {
      setDeparture(toTurkeyLocalInputValue(new Date(now + 60 * 60_000)));
      invalidateRequest();
    }
  };

  useEffect(() => {
    const nextOrigin = canonicalProvinceName(currentCityName);
    setOriginName(nextOrigin);
    setDestinationName(currentDestination =>
      currentDestination === nextOrigin
        ? nextOrigin === 'Ankara'
          ? 'İstanbul'
          : 'Ankara'
        : currentDestination
    );
    requestIdRef.current += 1;
    setResult(null);
    setError(null);
    setLoading(false);
  }, [currentCityName]);

  useEffect(() => {
    requestIdRef.current += 1;
    setResult(null);
    setError(null);
    setLoading(false);
  }, [i18n.language]);

  const submit = async () => {
    if (!origin || !destination || origin.name === destination.name) return;
    const departureDate = parseTurkeyLocalInputValue(departure);
    if (!departureDate) {
      setError(t('hava81.route.error'));
      return;
    }
    const now = Date.now();
    const departureTime = departureDate.getTime();
    if (
      departureTime < now - ROUTE_DEPARTURE_PAST_TOLERANCE_MS ||
      departureTime > now + ROUTE_MAX_DEPARTURE_MS
    ) {
      setError(t('hava81.route.departureRangeError'));
      return;
    }
    const requestId = ++requestIdRef.current;
    setResult(null);
    setLoading(true);
    setError(null);
    try {
      const value = await weatherService.getRouteWeather(
        origin.coordinates,
        destination.coordinates,
        departureDate,
        i18n.language.startsWith('en') ? 'en' : 'tr'
      );
      if (requestId !== requestIdRef.current) return;
      setResult(value);
      trackProductEvent('route_checked', {
        origin: origin.name,
        destination: destination.name,
        score: value.score,
        kind: value.kind,
      });
    } catch {
      if (requestId === requestIdRef.current) setError(t('hava81.route.error'));
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  };

  return (
    <details className="route-weather">
      <summary>
        <span>
          <b>{t('hava81.route.title')}</b>
          <small>{t('hava81.route.summary')}</small>
        </span>
        <span className="route-weather__chevron" aria-hidden="true">
          ⌄
        </span>
      </summary>
      <div className="route-weather__body" aria-busy={loading}>
        <div className="route-weather__form">
          <label>
            {t('hava81.route.origin')}
            <select
              value={originName}
              aria-describedby={routeSelectionStatusId}
              onChange={e => {
                setOriginName(e.target.value);
                invalidateRequest();
              }}
            >
              {TURKISH_CITIES.map(city => (
                <option key={city.name}>{city.name}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="route-weather__swap"
            onClick={swapEndpoints}
            aria-label={t('hava81.route.swap')}
          >
            <span aria-hidden="true">⇄</span>
            <span>{t('hava81.route.swap')}</span>
          </button>
          <label>
            {t('hava81.route.destination')}
            <select
              value={destinationName}
              aria-describedby={routeSelectionStatusId}
              onChange={e => {
                setDestinationName(e.target.value);
                invalidateRequest();
              }}
            >
              {TURKISH_CITIES.map(city => (
                <option key={city.name}>{city.name}</option>
              ))}
            </select>
          </label>
          <label>
            {t('hava81.route.departure')}
            <input
              type="datetime-local"
              value={departure}
              min={toTurkeyLocalInputValue(new Date(departureBoundsNow))}
              max={toTurkeyLocalInputValue(new Date(departureBoundsNow + ROUTE_MAX_DEPARTURE_MS))}
              onFocus={refreshDepartureBounds}
              onChange={e => {
                setDepartureEdited(true);
                setDeparture(e.target.value);
                invalidateRequest();
              }}
            />
          </label>
          <button
            type="button"
            disabled={loading || originName === destinationName}
            aria-busy={loading}
            aria-describedby={routeSelectionStatusId}
            onClick={() => void submit()}
          >
            {loading ? t('common.loading') : t('hava81.route.check')}
          </button>
        </div>
        {originName === destinationName ? (
          <p id="route-weather-same-city" className="route-weather__hint" role="status">
            {t('hava81.route.sameCity')}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="route-weather__error">
            {error}
          </p>
        ) : null}
        {result ? (
          <div
            className="route-weather__result"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <header>
              <div>
                <span className="atlas-kicker">{t('hava81.route.corridor')}</span>
                <h3>
                  {originName} → {destinationName}
                </h3>
              </div>
              <div className="route-weather__score">
                <small>{t(`hava81.dailyPlan.bands.${getScoreBand(result.score)}`)}</small>
                <strong>
                  {result.score}
                  <span>/100</span>
                </strong>
              </div>
            </header>
            <p>
              {t('hava81.route.estimate', {
                distance: result.estimatedDistanceKm,
                minutes: result.estimatedDurationMinutes,
              })}
            </p>
            {result.betterDeparture ? (
              <p className="route-weather__better">
                {t('hava81.route.better', {
                  time: formatTime(result.betterDeparture.departure),
                  improvement: result.betterDeparture.improvement,
                })}
              </p>
            ) : null}
            <div
              className="route-weather__segments"
              role="list"
              tabIndex={0}
              aria-label={t('hava81.route.segments')}
            >
              {result.segments.map((segment, index) => (
                <article
                  role="listitem"
                  key={`${segment.fraction}-${index}`}
                  className={`route-segment route-segment--${segment.risk}`}
                >
                  <time>{formatTime(segment.eta)}</time>
                  <strong>
                    {segment.score}/100 ·{' '}
                    {t(`hava81.dailyPlan.bands.${getScoreBand(segment.score)}`)}
                  </strong>
                  <span>
                    {numberFormatter.format(Math.round(convertTemperature(segment.temperature)))}
                    {temperatureSymbol} ·{' '}
                    {formatPrecipitation(segment.precipitationProbability, segment.precipitationMm)}{' '}
                    · {t('weather.wind')}{' '}
                    {numberFormatter.format(convertWindSpeed(segment.windSpeed))} {windSpeedSymbol}
                  </span>
                  <small>{segment.description}</small>
                </article>
              ))}
            </div>
            <small className="route-weather__disclaimer">{result.disclaimer}</small>
          </div>
        ) : null}
      </div>
    </details>
  );
}

export default RouteWeatherPanel;
