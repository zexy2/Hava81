import { useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../context';
import { getCityMetadata } from '../../constants/cityMetadata';
import type { AirQuality, HourlyForecast, NormalizedWeatherData } from '../../types';
import { getOpenWeatherAqiLabelKey } from '../../utils/airQuality';
import { getWeatherDecisions, type WeatherDecision } from '../../utils/weatherDecisions';
import { WeatherSymbol } from './WeatherSymbol';
import './WeatherDecisionField.css';

export interface WeatherDecisionFieldProps {
  weather: NormalizedWeatherData;
  hourly: HourlyForecast[];
  airQuality?: AirQuality;
  uvIndex?: number;
  className?: string;
}

export function WeatherDecisionField({
  weather,
  hourly,
  airQuality,
  uvIndex,
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
  const decisions = useMemo(
    () => getWeatherDecisions({ weather, hourly, airQuality, uvIndex }),
    [airQuality, hourly, uvIndex, weather]
  );

  const temperatureSymbol = getTemperatureSymbol();
  const windSpeedSymbol = getWindSpeedSymbol();
  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);
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
  const timeFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }),
    [locale]
  );

  const formatTemperature = (temperature: number): string =>
    `${numberFormatter.format(Math.round(convertTemperature(temperature)))}${temperatureSymbol}`;

  const timezoneOffsetMs = (weather.meta.timezoneOffsetSeconds ?? 0) * 1000;
  const atLocationTime = (date: Date): Date => new Date(date.getTime() + timezoneOffsetMs);

  const formatForecastTime = (time: Date): string => {
    const date = time instanceof Date ? time : new Date(time);
    return Number.isNaN(date.getTime()) ? '—' : timeFormatter.format(atLocationTime(date));
  };

  const observedAt =
    weather.timestamp instanceof Date ? weather.timestamp : new Date(weather.timestamp);
  const observedAtText = Number.isNaN(observedAt.getTime())
    ? '—'
    : dateFormatter.format(atLocationTime(observedAt));
  const observedAtDateTime = Number.isNaN(observedAt.getTime())
    ? undefined
    : observedAt.toISOString();

  const decisionCopy = (decision: WeatherDecision): string => {
    switch (decision.kind) {
      case 'rain':
        return t('hava81.decision.actions.rain', {
          defaultValue: '{{time}} civarında yağış olasılığı %{{probability}}; şemsiye iyi fikir.',
          time: decision.time ? formatForecastTime(decision.time) : '—',
          probability: Math.round((decision.value ?? 0) * 100),
        });
      case 'wind':
        return t('hava81.decision.actions.wind', {
          defaultValue: 'Rüzgâr {{speed}} m/s seviyesine çıkabilir; açık alanda dikkat.',
          speed: (decision.value ?? 0).toFixed(1),
        });
      case 'heat':
        return t('hava81.decision.actions.heat', {
          defaultValue: 'Sıcaklık {{temperature}}°C seviyesine çıkabilir; gölge ve su planla.',
          temperature: Math.round(decision.value ?? 0),
        });
      case 'cold':
        return t('hava81.decision.actions.cold', {
          defaultValue: 'Sıcaklık {{temperature}}°C seviyesine inebilir; buzlanmaya karşı dikkat.',
          temperature: Math.round(decision.value ?? 0),
        });
      case 'air-quality':
        return t('hava81.decision.actions.airQuality', {
          defaultValue: 'Hava kalitesi zayıf (AQI {{aqi}}/5); uzun süreli dış aktiviteyi azalt.',
          aqi: decision.value ?? '—',
        });
      case 'uv':
        return t('hava81.decision.actions.uv', {
          defaultValue: 'UV indeksi {{uv}}; güneş koruması kullan.',
          uv: decision.value ?? '—',
        });
      case 'outdoor-window':
        return t('hava81.decision.actions.outdoor', {
          defaultValue: '{{time}} civarı dışarıda olmak için daha sakin bir pencere görünüyor.',
          time: decision.time ? formatForecastTime(decision.time) : '—',
        });
      case 'stable':
        return t('hava81.decision.actions.stable', {
          defaultValue: 'Yakın tahmin aralığında belirgin bir risk görünmüyor.',
        });
    }
  };

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const fetchedAt =
    weather.meta.fetchedAt instanceof Date
      ? weather.meta.fetchedAt
      : new Date(weather.meta.fetchedAt);
  const ageMinutes = Number.isNaN(fetchedAt.getTime())
    ? null
    : Math.max(0, Math.floor((now - fetchedAt.getTime()) / 60_000));
  const staleAfterMs = (weather.meta.freshForSeconds ?? 300) * 1000;
  const isStale = !Number.isNaN(fetchedAt.getTime()) && now - fetchedAt.getTime() > staleAfterMs;
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
  const currentTemperature = numberFormatter.format(
    Math.round(convertTemperature(weather.temperature))
  );
  const windSpeed = `${numberFormatter.format(convertWindSpeed(weather.windSpeed))} ${windSpeedSymbol}`;
  const airQualityLabelKey = airQuality
    ? getOpenWeatherAqiLabelKey(airQuality.aqi)
    : undefined;
  const airQualityValue =
    airQuality && airQualityLabelKey
      ? `${numberFormatter.format(airQuality.aqi)}/5 · ${t(airQualityLabelKey)}`
      : t('hava81.decision.notAvailable', { defaultValue: '—' });

  return (
    <section
      className={`hava81-decision-field ${className}`.trim()}
      aria-labelledby={headingId}
      aria-live="polite"
    >
      <header className="hava81-decision-field__identity">
        <div className="hava81-decision-field__city-row">
          <h2 id={headingId} className="hava81-decision-field__city">
            {weather.cityName}
          </h2>
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
          <time dateTime={observedAtDateTime}>{observedAtText}</time>
          <span aria-hidden="true">·</span>
          <span>
            {t('hava81.decision.latitude', { defaultValue: 'Enlem' })}{' '}
            {coordinateFormatter.format(weather.coordinates.lat)}°
          </span>
          <span aria-hidden="true">·</span>
          <span>
            {t('hava81.decision.longitude', { defaultValue: 'Boylam' })}{' '}
            {coordinateFormatter.format(weather.coordinates.lon)}°
          </span>
          <span aria-hidden="true">·</span>
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
        <div className="hava81-decision-field__reading">
          <p className="hava81-decision-field__temperature">
            <span className="hava81-decision-field__temperature-value">{currentTemperature}</span>
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
      </div>

      <aside className="hava81-decision-field__change" aria-labelledby={changeHeadingId}>
        <h3 id={changeHeadingId} className="hava81-decision-field__change-title">
          {t('hava81.decision.nextChange', { defaultValue: 'Sıradaki değişim' })}
        </h3>
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
          <dt>{t('hava81.decision.highLow', { defaultValue: 'Yüksek / düşük' })}</dt>
          <dd>
            {formatTemperature(weather.tempMax)} / {formatTemperature(weather.tempMin)}
          </dd>
        </div>
        <div className="hava81-decision-field__metric">
          <dt>{t('weather.humidity')}</dt>
          <dd>{numberFormatter.format(weather.humidity)}%</dd>
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
