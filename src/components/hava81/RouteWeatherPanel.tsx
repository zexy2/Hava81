import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { trackProductEvent } from '../../analytics/productEvents';
import { weatherService } from '../../api/weatherService';
import { TURKISH_CITIES } from '../../constants/cities';
import type { RouteWeatherResult } from '../../types';
import './RouteWeatherPanel.css';

interface Props {
  currentCityName: string;
}
const localInputValue = (date: Date) => {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
};

export function RouteWeatherPanel({ currentCityName }: Props) {
  const { t, i18n } = useTranslation();
  const initialDestination = currentCityName === 'Ankara' ? 'İstanbul' : 'Ankara';
  const [originName, setOriginName] = useState(currentCityName);
  const [destinationName, setDestinationName] = useState(initialDestination);
  const [departure, setDeparture] = useState(() =>
    localInputValue(new Date(Date.now() + 60 * 60_000))
  );
  const [result, setResult] = useState<RouteWeatherResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const origin = useMemo(() => TURKISH_CITIES.find(city => city.name === originName), [originName]);
  const destination = useMemo(
    () => TURKISH_CITIES.find(city => city.name === destinationName),
    [destinationName]
  );
  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' });

  const submit = async () => {
    if (!origin || !destination || origin.name === destination.name) return;
    setLoading(true);
    setError(null);
    try {
      const value = await weatherService.getRouteWeather(
        origin.coordinates,
        destination.coordinates,
        new Date(departure),
        i18n.language.startsWith('en') ? 'en' : 'tr'
      );
      setResult(value);
      trackProductEvent('route_checked', {
        origin: origin.name,
        destination: destination.name,
        score: value.score,
        kind: value.kind,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('hava81.route.error'));
    } finally {
      setLoading(false);
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
                setResult(null);
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
                setResult(null);
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
              min={localInputValue(new Date())}
              max={localInputValue(new Date(Date.now() + 18 * 60 * 60_000))}
              onChange={e => setDeparture(e.target.value)}
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
          <div className="route-weather__result">
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
                    {segment.temperature}° · %{segment.precipitationProbability} ·{' '}
                    {t('weather.wind')} {segment.windSpeed.toFixed(1)} m/s
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
