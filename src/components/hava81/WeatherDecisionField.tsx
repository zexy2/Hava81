import { useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../context';
import { getCityMetadata } from '../../constants/cityMetadata';
import type {
  AirQuality,
  DailyForecast,
  ForecastMeta,
  HourlyForecast,
  NormalizedWeatherData,
} from '../../types';
import { getOpenWeatherAqiLabelKey } from '../../utils/airQuality';
import { formatPrecipitationAmount } from '../../utils/precipitation';
import { getForecastFreshness } from '../../utils/forecastFreshness';
import { getCurrentWeatherFreshness } from '../../utils/currentWeatherFreshness';
import { getWeatherDecisions, type WeatherDecision } from '../../utils/weatherDecisions';
import { WeatherSymbol } from './WeatherSymbol';
import './WeatherDecisionField.css';

export interface WeatherDecisionFieldProps {
  weather: NormalizedWeatherData;
  hourly: HourlyForecast[];
  daily?: DailyForecast[];
  airQuality?: AirQuality;
  uvIndexMax?: number;
  forecastMeta?: ForecastMeta | null;
  className?: string;
}

export function WeatherDecisionField({
  weather,
  hourly,
  daily = [],
  airQuality,
  uvIndexMax,
  forecastMeta,
  className = '',
}: WeatherDecisionFieldProps) {
  const headingId = useId();
  const changeHeadingId = useId();
  const { t } = useTranslation();
  const {
    settings,
    convertTemperature,
    convertWindSpeed,
    getTemperatureSymbol,
    getWindSpeedSymbol,
  } = useSettings();

  const locale = settings.language === 'en' ? 'en-US' : 'tr-TR';
  const cityMetadata = useMemo(() => getCityMetadata(weather.cityName), [weather.cityName]);

  const temperatureSymbol = getTemperatureSymbol();
  const windSpeedSymbol = getWindSpeedSymbol();
  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const uvFormatter = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }),
    [locale]
  );
  const coordinateFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [locale]
  );
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
      }),
    [locale]
  );
  const compactDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'UTC',
      }),
    [locale]
  );
  const timeFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }),
    [locale]
  );

  const formatTemperature = (temperature: number): string =>
    `${numberFormatter.format(Math.round(convertTemperature(temperature)))}${temperatureSymbol}`;
  const formatDailyRange = (high: number, low: number): string => {
    const convertedHigh = convertTemperature(high);
    const convertedLow = convertTemperature(low);
    const roundedHigh = Math.round(convertedHigh);
    const roundedLow = Math.round(convertedLow);

    if (Math.abs(convertedHigh - convertedLow) < 0.1) {
      return `${numberFormatter.format(roundedHigh)}${temperatureSymbol}`;
    }

    if (roundedHigh !== roundedLow) {
      return `${numberFormatter.format(roundedHigh)}${temperatureSymbol} / ${numberFormatter.format(roundedLow)}${temperatureSymbol}`;
    }

    const preciseFormatter = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    return `${preciseFormatter.format(convertedHigh)}${temperatureSymbol} / ${preciseFormatter.format(convertedLow)}${temperatureSymbol}`;
  };

  const timezoneOffsetMs = weather.meta.timezoneOffsetSeconds * 1000;
  const atLocationTime = (date: Date): Date => new Date(date.getTime() + timezoneOffsetMs);
  const todayKey = atLocationTime(new Date()).toISOString().slice(0, 10);
  const todayDaily = daily.find(day => day.date.toISOString().slice(0, 10) === todayKey);

  const formatForecastTime = (time: Date): string => {
    const date = time instanceof Date ? time : new Date(time);
    return Number.isNaN(date.getTime()) ? '—' : timeFormatter.format(atLocationTime(date));
  };

  const observedAt =
    weather.timestamp instanceof Date ? weather.timestamp : new Date(weather.timestamp);
  const observedAtText = Number.isNaN(observedAt.getTime())
    ? '—'
    : dateFormatter.format(atLocationTime(observedAt));
  const compactObservedAtText = Number.isNaN(observedAt.getTime())
    ? '—'
    : compactDateFormatter.format(atLocationTime(observedAt));
  const observedAtDateTime = Number.isNaN(observedAt.getTime())
    ? undefined
    : observedAt.toISOString();

  const decisionCopy = (decision: WeatherDecision): string => {
    switch (decision.kind) {
      case 'rain': {
        const precipitationAmount = formatPrecipitationAmount(decision.amount, locale);
        const probability = Math.round(decision.value * 100);
        const time = decision.time ? formatForecastTime(decision.time) : '—';
        if (precipitationAmount && probability > 0) {
          return t('hava81.decision.actions.rainWithAmount', {
            defaultValue:
              '{{time}} civarında yağış olasılığı %{{probability}}; saatlik yaklaşık {{amount}} yağış bekleniyor.',
            time,
            probability,
            amount: precipitationAmount,
          });
        }
        if (precipitationAmount) {
          return t('hava81.decision.actions.rainAmount', {
            defaultValue:
              '{{time}} civarında saatlik yaklaşık {{amount}} yağış bekleniyor; şemsiye iyi fikir.',
            time,
            amount: precipitationAmount,
          });
        }
        return t('hava81.decision.actions.rain', {
          defaultValue: '{{time}} civarında yağış olasılığı %{{probability}}; şemsiye iyi fikir.',
          time,
          probability,
        });
      }
      case 'wind':
        return t('hava81.decision.actions.wind', {
          defaultValue: 'Rüzgâr veya hamleler {{speed}} seviyesine çıkabilir; açık alanda dikkat.',
          speed: `${numberFormatter.format(convertWindSpeed(decision.value))} ${windSpeedSymbol}`,
        });
      case 'heat':
        return t('hava81.decision.actions.heat', {
          defaultValue:
            'Hissedilen sıcaklık {{temperature}} seviyesine çıkabilir; gölge ve su planla.',
          temperature: formatTemperature(decision.value),
        });
      case 'cold':
        return t('hava81.decision.actions.cold', {
          defaultValue:
            'Hissedilen sıcaklık {{temperature}} seviyesine inebilir; soğuk stresine karşı dikkat.',
          temperature: formatTemperature(decision.value),
        });
      case 'air-quality':
        return t('hava81.decision.actions.airQuality', {
          defaultValue: 'Hava kalitesi zayıf (AQI {{aqi}}/5); uzun süreli dış aktiviteyi azalt.',
          aqi: decision.value,
        });
      case 'uv':
        return t('hava81.decision.actions.uv', {
          defaultValue:
            'Önümüzdeki 24 saatte UV model maksimumu {{uv}}; güneşten korunma planı yap.',
          uv: uvFormatter.format(decision.value),
        });
      case 'outdoor-window':
        return t('hava81.decision.actions.outdoor', {
          defaultValue: '{{time}} civarı hava açısından dışarıda olmak için daha sakin bir pencere görünüyor.',
          time: decision.time ? formatForecastTime(decision.time) : '—',
        });
      case 'stable':
        return t('hava81.decision.actions.stable', {
          defaultValue: 'Yakın tahmin aralığında belirgin bir risk görünmüyor.',
        });
      case 'unavailable':
        return t('hava81.decision.actions.unavailable', {
          defaultValue: 'Yakın saatler için karar verisi henüz hazır değil.',
        });
    }
  };

  const [now, setNow] = useState(() => Date.now());
  const [, setForecastFreshnessRevision] = useState(0);
  const forecastFreshness = forecastMeta === undefined ? null : getForecastFreshness(forecastMeta);
  const forecastExpiresInMs = forecastFreshness?.expiresInMs ?? null;
  useEffect(() => {
    let timerId: number | undefined;

    const scheduleFreshnessRefresh = () => {
      const currentTime = Date.now();
      setNow(currentTime);
      const elapsedInMinute = ((currentTime % 60_000) + 60_000) % 60_000;
      const nextMinuteDelay = 60_000 - elapsedInMinute + 100;
      const currentExpiresInMs = getCurrentWeatherFreshness(weather.meta, currentTime).expiresInMs;
      const airQualityExpiresInMs = airQuality
        ? getCurrentWeatherFreshness(airQuality.meta, currentTime).expiresInMs
        : null;
      const evidenceExpiryDelays = [currentExpiresInMs, airQualityExpiresInMs].filter(
        (value): value is number => value !== null
      );
      const nextDelay = Math.min(nextMinuteDelay, ...evidenceExpiryDelays);
      timerId = window.setTimeout(scheduleFreshnessRefresh, nextDelay);
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (timerId !== undefined) window.clearTimeout(timerId);
      scheduleFreshnessRefresh();
    };

    scheduleFreshnessRefresh();
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      if (timerId !== undefined) window.clearTimeout(timerId);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [airQuality, weather.meta]);

  useEffect(() => {
    if (forecastMeta === undefined) return undefined;
    const resyncFreshness = () => setForecastFreshnessRevision(value => value + 1);
    const timeout =
      forecastExpiresInMs === null
        ? undefined
        : window.setTimeout(resyncFreshness, forecastExpiresInMs);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') resyncFreshness();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      if (timeout !== undefined) window.clearTimeout(timeout);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [forecastExpiresInMs, forecastMeta]);

  const currentFreshness = getCurrentWeatherFreshness(weather.meta, now);
  const ageMinutes = currentFreshness.ageMinutes;
  const currentEvidenceFresh = currentFreshness.fresh;
  const isStale = currentFreshness.status === 'stale';
  const airQualityFreshness = airQuality ? getCurrentWeatherFreshness(airQuality.meta, now) : null;
  const freshAirQuality = airQualityFreshness?.fresh ? airQuality : undefined;
  const decisionEvidenceFresh = currentEvidenceFresh && (forecastFreshness?.fresh ?? true);
  const decisions = useMemo(
    () =>
      decisionEvidenceFresh
        ? getWeatherDecisions({ weather, hourly, airQuality: freshAirQuality, uvIndexMax })
        : ([{ kind: 'unavailable', severity: 'info' }] satisfies WeatherDecision[]),
    [decisionEvidenceFresh, freshAirQuality, hourly, uvIndexMax, weather]
  );
  const freshnessText =
    ageMinutes === null
      ? t('hava81.decision.freshness.unknown', { defaultValue: 'Güncellik bilinmiyor' })
      : ageMinutes < 1
        ? t('hava81.decision.freshness.now', { defaultValue: 'şimdi güncellendi' })
        : t('hava81.decision.freshness.minutes', {
            defaultValue: '{{count}} dk önce',
            count: ageMinutes,
          });

  const plateCode = cityMetadata ? String(cityMetadata.plateCode).padStart(2, '0') : '--';
  const currentTemperature = currentEvidenceFresh
    ? numberFormatter.format(Math.round(convertTemperature(weather.temperature)))
    : '—';
  const windSpeed = currentEvidenceFresh
    ? `${numberFormatter.format(convertWindSpeed(weather.windSpeed))} ${windSpeedSymbol}`
    : '—';
  const airQualityLabelKey = freshAirQuality
    ? getOpenWeatherAqiLabelKey(freshAirQuality.aqi)
    : undefined;
  const airQualityValue =
    freshAirQuality && airQualityLabelKey
      ? `${numberFormatter.format(freshAirQuality.aqi)}/5 · ${t(airQualityLabelKey)}`
      : t('hava81.decision.notAvailable', { defaultValue: '—' });

  return (
    <section className={`hava81-decision-field ${className}`.trim()} aria-labelledby={headingId}>
      <header className="hava81-decision-field__identity">
        <div className="hava81-decision-field__city-row">
          <h1 id={headingId} className="hava81-decision-field__city">
            {weather.cityName}
          </h1>
          <span
            className="hava81-decision-field__plate"
            role="group"
            aria-label={t('hava81.decision.plateCodeLabel', {
              defaultValue: 'Plaka kodu {{code}}',
              code: plateCode,
            })}
          >
            <span aria-hidden="true">TR</span>
            <strong aria-hidden="true">{plateCode}</strong>
          </span>
        </div>

        <div className="hava81-decision-field__atlas-meta">
          <time className="hava81-decision-field__observed-full" dateTime={observedAtDateTime}>
            {observedAtText}
          </time>
          <time className="hava81-decision-field__observed-compact" dateTime={observedAtDateTime}>
            {compactObservedAtText}
          </time>
          <span className="hava81-decision-field__coordinate-meta" aria-hidden="true">·</span>
          <span className="hava81-decision-field__coordinate-meta">
            {t('hava81.decision.latitude', { defaultValue: 'Enlem' })}{' '}
            {coordinateFormatter.format(weather.coordinates.lat)}°
          </span>
          <span className="hava81-decision-field__coordinate-meta" aria-hidden="true">·</span>
          <span className="hava81-decision-field__coordinate-meta">
            {t('hava81.decision.longitude', { defaultValue: 'Boylam' })}{' '}
            {coordinateFormatter.format(weather.coordinates.lon)}°
          </span>
          <span className="hava81-decision-field__coordinate-meta" aria-hidden="true">·</span>
          <span>{weather.meta.provider}</span>
          <span aria-hidden="true">·</span>
          <span className={isStale ? 'is-stale' : undefined}>
            {isStale
              ? t('hava81.decision.freshness.stale', { defaultValue: 'Eski veri' })
              : freshnessText}
          </span>
        </div>
      </header>

      <div className="hava81-decision-field__current">
        {currentEvidenceFresh ? (
          <>
            <div className="hava81-decision-field__reading">
              <p className="hava81-decision-field__temperature">
                <span className="hava81-decision-field__temperature-value">
                  {currentTemperature}
                </span>
                <span className="hava81-decision-field__temperature-unit">{temperatureSymbol}</span>
              </p>

              <div className="hava81-decision-field__symbol" aria-hidden="true">
                <WeatherSymbol
                  code={weather.icon}
                  label={weather.description}
                  className="hava81-decision-field__weather-symbol"
                />
              </div>
            </div>

            <p className="hava81-decision-field__condition">{weather.description}</p>
            <p className="hava81-decision-field__feels-like">
              {t('hava81.decision.feelsLike', {
                defaultValue: 'Hissedilen {{temperature}}',
                temperature: formatTemperature(weather.feelsLike),
              })}
            </p>
          </>
        ) : (
          <p className="hava81-decision-field__condition" role="status">
            {t('weather.staleCurrentData')}
          </p>
        )}
      </div>

      <aside className="hava81-decision-field__change" aria-labelledby={changeHeadingId}>
        <h2 id={changeHeadingId} className="hava81-decision-field__change-title">
          {t('hava81.decision.nextChange', { defaultValue: 'Plan için öne çıkanlar' })}
        </h2>
        <ul className="hava81-decision-field__decision-list">
          {decisions.map((decision, index) => (
            <li key={`${decision.kind}-${index}`} data-severity={decision.severity}>
              {decisionCopy(decision)}
            </li>
          ))}
        </ul>
      </aside>

      <dl className="hava81-decision-field__rail">
        <div className="hava81-decision-field__metric">
          <dt>{t('hava81.decision.highLow', { defaultValue: 'Bugünün yüksek / düşük' })}</dt>
          <dd>
            {forecastFreshness?.fresh !== false && todayDaily
              ? formatDailyRange(todayDaily.tempMax, todayDaily.tempMin)
              : '—'}
          </dd>
        </div>
        <div className="hava81-decision-field__metric">
          <dt>{t('weather.humidity')}</dt>
          <dd>{currentEvidenceFresh ? `${numberFormatter.format(weather.humidity)}%` : '—'}</dd>
        </div>
        <div className="hava81-decision-field__metric">
          <dt>{t('weather.wind')}</dt>
          <dd>{windSpeed}</dd>
        </div>
        <div className="hava81-decision-field__metric">
          <dt>{t('weather.airQuality')}</dt>
          <dd>{airQualityValue}</dd>
        </div>
      </dl>
    </section>
  );
}

export default WeatherDecisionField;
