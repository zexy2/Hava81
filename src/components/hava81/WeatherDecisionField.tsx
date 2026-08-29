import { useEffect, useId, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../context';
import { getCityMetadata } from '../../constants/cityMetadata';
import type { AirQuality, DailyForecast, HourlyForecast, NormalizedWeatherData } from '../../types';
import { getOpenWeatherAqiLabelKey } from '../../utils/airQuality';
import { formatPrecipitationAmount } from '../../utils/precipitation';
import { getWeatherDecisions, type WeatherDecision } from '../../utils/weatherDecisions';
import { WeatherSymbol } from './WeatherSymbol';
import './WeatherDecisionField.css';

export interface WeatherDecisionFieldProps {
  weather: NormalizedWeatherData;
  hourly: HourlyForecast[];
  daily?: DailyForecast[];
  airQuality?: AirQuality;
  uvIndexMax?: number;
  className?: string;
}

export function WeatherDecisionField({
  weather,
  hourly,
  daily = [],
  airQuality,
  uvIndexMax,
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
    () => getWeatherDecisions({ weather, hourly, airQuality, uvIndexMax }),
    [airQuality, hourly, uvIndexMax, weather]
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
  const formatDailyRange = (high: number, low: number): string => {
    const convertedHigh = convertTemperature(high);
    const convertedLow = convertTemperature(low);
    const roundedHigh = Math.round(convertedHigh);
    const roundedLow = Math.round(convertedLow);

    if (roundedHigh !== roundedLow || convertedHigh === convertedLow) {
      return `${numberFormatter.format(roundedHigh)}${temperatureSymbol} / ${numberFormatter.format(roundedLow)}${temperatureSymbol}`;
    }

    const preciseFormatter = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    });
    return `${preciseFormatter.format(convertedHigh)}${temperatureSymbol} / ${preciseFormatter.format(convertedLow)}${temperatureSymbol}`;
  };

  const timezoneOffsetMs = (weather.meta.timezoneOffsetSeconds ?? 0) * 1000;
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
  const observedAtDateTime = Number.isNaN(observedAt.getTime())
    ? undefined
    : observedAt.toISOString();

  const decisionCopy = (decision: WeatherDecision): string => {
    switch (decision.kind) {
      case 'rain': {
        const precipitationAmount = formatPrecipitationAmount(decision.amount, locale);
        const probability = Math.round((decision.value ?? 0) * 100);
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
          defaultValue:
            '{{time}} civarında yağış olasılığı %{{probability}}; şemsiye iyi fikir.',
          time,
          probability,
        });
      }
      case 'wind':
        return t('hava81.decision.actions.wind', {
          defaultValue:
            'Rüzgâr veya hamleler {{speed}} seviyesine çıkabilir; açık alanda dikkat.',
          speed: `${numberFormatter.format(convertWindSpeed(decision.value ?? 0))} ${windSpeedSymbol}`,
        });
      case 'heat':
        return t('hava81.decision.actions.heat', {
          defaultValue:
            'Hissedilen sıcaklık {{temperature}} seviyesine çıkabilir; gölge ve su planla.',
          temperature: formatTemperature(decision.value ?? 0),
        });
      case 'cold':
        return t('hava81.decision.actions.cold', {
          defaultValue:
            'Hissedilen sıcaklık {{temperature}} seviyesine inebilir; soğuk stresine karşı dikkat.',
          temperature: formatTemperature(decision.value ?? 0),
        });
      case 'air-quality':
        return t('hava81.decision.actions.airQuality', {
          defaultValue: 'Hava kalitesi zayıf (AQI {{aqi}}/5); uzun süreli dış aktiviteyi azalt.',
          aqi: decision.value ?? '—',
        });
      case 'uv':
        return t('hava81.decision.actions.uv', {
          defaultValue:
            'Önümüzdeki 24 saatte UV model maksimumu {{uv}}; güneşten korunma planı yap.',
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
  const fetchedAtMs = fetchedAt.getTime();
  const ageMs = now - fetchedAtMs;
  const hasInvalidFutureTimestamp = !Number.isNaN(fetchedAtMs) && ageMs < -60_000;
  const ageMinutes =
    Number.isNaN(fetchedAtMs) || hasInvalidFutureTimestamp
      ? null
      : Math.max(0, Math.floor(ageMs / 60_000));
  const staleAfterMs = (weather.meta.freshForSeconds ?? 300) * 1000;
  const isStale = !Number.isNaN(fetchedAtMs) && !hasInvalidFutureTimestamp && ageMs > staleAfterMs;
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
  const airQualityLabelKey = airQuality ? getOpenWeatherAqiLabelKey(airQuality.aqi) : undefined;
  const airQualityValue =
    airQuality && airQualityLabelKey
      ? `${numberFormatter.format(airQuality.aqi)}/5 · ${t(airQualityLabelKey)}`
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
          <dd>{todayDaily ? formatDailyRange(todayDaily.tempMax, todayDaily.tempMin) : '—'}</dd>
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
