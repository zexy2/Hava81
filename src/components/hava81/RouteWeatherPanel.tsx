import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { trackProductEvent } from '../../analytics/productEvents';
import { weatherService } from '../../api/weatherService';
import { TURKISH_CITIES } from '../../constants/cities';
import type { RouteWeatherResult } from '../../types';
import { citySlug } from '../../utils/cityRoute';
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
  const initialOrigin = canonicalProvinceName(currentCityName);
  const initialDestination = initialOrigin === 'Ankara' ? 'İstanbul' : 'Ankara';
  const [originName, setOriginName] = useState(initialOrigin);
  const [destinationName, setDestinationName] = useState(initialDestination);
  const [departure, setDeparture] = useState(() =>
    toTurkeyLocalInputValue(new Date(Date.now() + 60 * 60_000))
  );
  const [result, setResult] = useState<RouteWeatherResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const origin = useMemo(() => TURKISH_CITIES.find(city => city.name === originName), [originName]);
  const destination = useMemo(
    () => TURKISH_CITIES.find(city => city.name === destinationName),
    [destinationName]
  );
  const formatTime = (iso: string) => formatTurkeyTime(new Date(iso), i18n.language);
  const precipitationFormatter = useMemo(
    () =>
      new Intl.NumberFormat(i18n.language, { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    [i18n.language]
  );
  const formatPrecipitation = (probabilityPercent: number, amount?: number) => {
    const probability = Math.round(probabilityPercent);
    const parts = [i18n.language.startsWith('en') ? `${probability}%` : `%${probability}`];
    if (Number.isFinite(amount) && (amount ?? 0) > 0) {
      const value = amount as number;
      parts.push(
        value < 0.1
          ? `<${precipitationFormatter.format(0.1)} mm`
          : `${precipitationFormatter.format(value)} mm`
      );
    }
    return parts.join(' · ');
  };
  const invalidateRequest = () => {
    requestIdRef.current += 1;
    setResult(null);
    setError(null);
    setLoading(false);
  };

  useEffect(() => {
    const nextOrigin = canonicalProvinceName(currentCityName);
    setOriginName(nextOrigin);
    requestIdRef.current += 1;
    setResult(null);
    setError(null);
    setLoading(false);
  }, [currentCityName]);

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
      <div className="route-weather__body">
        <div className="route-weather__form">
          <label>
            {t('hava81.route.origin')}
            <select
              value={originName}
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
          <label>
            {t('hava81.route.destination')}
            <select
              value={destinationName}
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
              min={toTurkeyLocalInputValue(new Date())}
              max={toTurkeyLocalInputValue(new Date(Date.now() + 18 * 60 * 60_000))}
              onChange={e => {
                setDeparture(e.target.value);
                invalidateRequest();
              }}
            />
          </label>
          <button
            type="button"
            disabled={loading || originName === destinationName}
            onClick={() => void submit()}
          >
            {loading ? t('common.loading') : t('hava81.route.check')}
          </button>
        </div>
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
              <strong>
                {result.score}
                <span>/100</span>
              </strong>
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
              aria-label={t('hava81.route.segments')}
            >
              {result.segments.map((segment, index) => (
                <article
                  role="listitem"
                  key={`${segment.fraction}-${index}`}
                  className={`route-segment route-segment--${segment.risk}`}
                >
                  <time>{formatTime(segment.eta)}</time>
                  <strong>{segment.score}</strong>
                  <span>
                    {segment.temperature}° ·{' '}
                    {formatPrecipitation(segment.precipitationProbability, segment.precipitationMm)}{' '}
                    · {t('weather.wind')} {segment.windSpeed.toFixed(1)} m/s
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
