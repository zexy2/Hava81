import { useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../context';
import { getCityMetadata } from '../../constants/cityMetadata';
import type { AirQuality, HourlyForecast, NormalizedWeatherData } from '../../types';
import { normalizePrecipitationProbability } from '../../utils/precipitation';
import { WeatherSymbol } from './WeatherSymbol';
import './WeatherDecisionField.css';

export interface WeatherDecisionFieldProps {
  weather: NormalizedWeatherData;
  hourly: HourlyForecast[];
  airQuality?: AirQuality;
  className?: string;
}

type MaterialChange =
  | { kind: 'precipitation'; point: HourlyForecast; probability: number }
  | { kind: 'warming'; point: HourlyForecast }
  | { kind: 'cooling'; point: HourlyForecast }
  | { kind: 'stable' }
  | { kind: 'unavailable' };

const AIR_QUALITY_LABEL_KEYS = [
  'airQuality.good',
  'airQuality.moderate',
  'airQuality.sensitive',
  'airQuality.unhealthy',
  'airQuality.veryUnhealthy',
] as const;

const getMaterialChange = (
  currentTemperature: number,
  hourly: HourlyForecast[]
): MaterialChange => {
  const forecastWindow = hourly.slice(0, 12);

  if (forecastWindow.length === 0) {
    return { kind: 'unavailable' };
  }

  for (const point of forecastWindow) {
    const probability = normalizePrecipitationProbability(point.pop);
    if (probability >= 0.35) {
      return { kind: 'precipitation', point, probability };
    }

    const temperatureDelta = point.temp - currentTemperature;
    if (temperatureDelta >= 4) {
      return { kind: 'warming', point };
    }

    if (temperatureDelta <= -4) {
      return { kind: 'cooling', point };
    }
  }

  return { kind: 'stable' };
};

export function WeatherDecisionField({
  weather,
  hourly,
  airQuality,
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
  const materialChange = useMemo(
    () => getMaterialChange(weather.temperature, hourly),
    [hourly, weather.temperature]
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
      }),
    [locale]
  );
  const timeFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }),
    [locale]
  );
  const percentageFormatter = useMemo(
    () => new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }),
    [locale]
  );

  const formatTemperature = (temperature: number): string =>
    `${numberFormatter.format(Math.round(convertTemperature(temperature)))}${temperatureSymbol}`;

  const formatForecastTime = (time: Date): string => {
    const date = time instanceof Date ? time : new Date(time);
    return Number.isNaN(date.getTime()) ? '—' : timeFormatter.format(date);
  };

  const observedAt =
    weather.timestamp instanceof Date ? weather.timestamp : new Date(weather.timestamp);
  const observedAtText = Number.isNaN(observedAt.getTime())
    ? '—'
    : dateFormatter.format(observedAt);
  const observedAtDateTime = Number.isNaN(observedAt.getTime())
    ? undefined
    : observedAt.toISOString();

  const nextChangeCopy = (() => {
    switch (materialChange.kind) {
      case 'precipitation':
        return t('hava81.decision.change.precipitation', {
          defaultValue: '{{time}} civarında yağış olasılığı {{probability}}.',
          time: formatForecastTime(materialChange.point.time),
          probability: percentageFormatter.format(materialChange.probability),
        });
      case 'warming':
        return t('hava81.decision.change.warming', {
          defaultValue: '{{time}} civarında sıcaklık {{temperature}} değerine çıkacak.',
          time: formatForecastTime(materialChange.point.time),
          temperature: formatTemperature(materialChange.point.temp),
        });
      case 'cooling':
        return t('hava81.decision.change.cooling', {
          defaultValue: '{{time}} civarında sıcaklık {{temperature}} değerine inecek.',
          time: formatForecastTime(materialChange.point.time),
          temperature: formatTemperature(materialChange.point.temp),
        });
      case 'stable':
        return t('hava81.decision.change.stable', {
          defaultValue: 'Yakın tahmin aralığında belirgin bir değişim görünmüyor.',
        });
      case 'unavailable':
        return t('hava81.decision.change.unavailable', {
          defaultValue: 'Yakın saatler için değişim verisi henüz hazır değil.',
        });
    }
  })();

  const plateCode = cityMetadata ? String(cityMetadata.plateCode).padStart(2, '0') : '--';
  const currentTemperature = numberFormatter.format(
    Math.round(convertTemperature(weather.temperature))
  );
  const windSpeed = `${numberFormatter.format(convertWindSpeed(weather.windSpeed))} ${windSpeedSymbol}`;
  const airQualityLabelKey = airQuality
    ? AIR_QUALITY_LABEL_KEYS[Math.min(Math.max(airQuality.aqi - 1, 0), 4)]
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
        <p className="hava81-decision-field__change-copy">{nextChangeCopy}</p>
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
