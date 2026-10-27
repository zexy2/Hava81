import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../context';
import { getCityMetadata } from '../../constants/cityMetadata';
import type {
  AirQuality,
  AirQualityHourly,
  DailyForecast,
  ForecastMeta,
  HourlyForecast,
  NormalizedWeatherData,
} from '../../types';
import { getOpenWeatherAqiLabelKey } from '../../utils/airQuality';
import { formatPrecipitationAmount } from '../../utils/precipitation';
import { getForecastFreshness } from '../../utils/forecastFreshness';
import { getCurrentWeatherFreshness } from '../../utils/currentWeatherFreshness';
import { getOptionalEvidenceFreshness } from '../../utils/optionalEvidenceFreshness';
import { getDecisionSnapshot } from '../../domain/decision/decisionSnapshot';
import { getNextChange } from '../../domain/decision/nextChange';
import { formatCityTime } from '../../utils/format';
import { getWeatherDecisions, type WeatherDecision } from '../../utils/weatherDecisions';
import { WeatherIllustration } from './WeatherIllustration';
import './WeatherDecisionField.css';
import HeroSky from '../sky/HeroSky';
import { resolveSkyScene } from '../sky/skyScene';
import { TEMPERATURE_SCALE_DARK, temperatureColor } from './forecastAtlas/temperatureColor';

export interface WeatherDecisionFieldProps {
  weather: NormalizedWeatherData;
  hourly: HourlyForecast[];
  daily?: DailyForecast[];
  airQuality?: AirQuality;
  airQualityHourly?: AirQualityHourly;
  uvIndexMax?: number;
  forecastMeta?: ForecastMeta | null;
  className?: string;
}

export function WeatherDecisionField({
  weather,
  hourly,
  daily = [],
  airQuality,
  airQualityHourly,
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
          defaultValue:
            '{{time}} civarı hava açısından dışarıda olmak için daha sakin bir pencere görünüyor.',
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

  const compactDecisionCopy = (decision: WeatherDecision): string => {
    switch (decision.kind) {
      case 'rain': {
        const precipitationAmount = formatPrecipitationAmount(decision.amount, locale);
        const probability = Math.round(decision.value * 100);
        const time = decision.time ? formatForecastTime(decision.time) : '—';
        if (precipitationAmount && probability > 0) {
          return t('hava81.decision.compactActions.rainWithAmount', {
            defaultValue: '{{time}} · Yağış %{{probability}} · {{amount}}',
            time,
            probability,
            amount: precipitationAmount,
          });
        }
        if (precipitationAmount) {
          return t('hava81.decision.compactActions.rainAmount', {
            defaultValue: '{{time}} · Yağış {{amount}}',
            time,
            amount: precipitationAmount,
          });
        }
        return t('hava81.decision.compactActions.rain', {
          defaultValue: '{{time}} · Yağış %{{probability}}',
          time,
          probability,
        });
      }
      case 'wind':
        return t('hava81.decision.compactActions.wind', {
          defaultValue: 'Rüzgâr {{speed}} · Açık alanda dikkat',
          speed: `${numberFormatter.format(convertWindSpeed(decision.value))} ${windSpeedSymbol}`,
        });
      case 'heat':
        return t('hava81.decision.compactActions.heat', {
          defaultValue: 'Hissedilen {{temperature}} · Su ve gölge planla',
          temperature: formatTemperature(decision.value),
        });
      case 'cold':
        return t('hava81.decision.compactActions.cold', {
          defaultValue: 'Hissedilen {{temperature}} · Soğuğa dikkat',
          temperature: formatTemperature(decision.value),
        });
      case 'air-quality':
        return t('hava81.decision.compactActions.airQuality', {
          defaultValue: 'AQI {{aqi}}/5 · Dış aktiviteyi azalt',
          aqi: decision.value,
        });
      case 'uv':
        return t('hava81.decision.compactActions.uv', {
          defaultValue: 'UV model zirvesi {{uv}} · Korunma planla',
          uv: uvFormatter.format(decision.value),
        });
      case 'outdoor-window':
        return t('hava81.decision.compactActions.outdoor', {
          defaultValue: 'Daha sakin hava · {{time}} civarı',
          time: decision.time ? formatForecastTime(decision.time) : '—',
        });
      case 'stable':
        return t('hava81.decision.compactActions.stable', {
          defaultValue: 'Belirgin hava riski görünmüyor',
        });
      case 'unavailable':
        return t('hava81.decision.compactActions.unavailable', {
          defaultValue: 'Karar verisi hazırlanıyor',
        });
    }
  };

  const [now, setNow] = useState(() => Date.now());
  const hasScheduledFreshnessRef = useRef(false);
  const [, setForecastFreshnessRevision] = useState(0);
  const forecastFreshness = forecastMeta === undefined ? null : getForecastFreshness(forecastMeta);
  const forecastExpiresInMs = forecastFreshness?.expiresInMs ?? null;
  useEffect(() => {
    let timerId: number | undefined;

    const scheduleFreshnessRefresh = (updateNow = false) => {
      const currentTime = Date.now();
      if (updateNow) setNow(currentTime);
      const elapsedInMinute = ((currentTime % 60_000) + 60_000) % 60_000;
      const nextMinuteDelay = 60_000 - elapsedInMinute + 100;
      const currentExpiresInMs = getCurrentWeatherFreshness(weather.meta, currentTime).expiresInMs;
      const airQualityExpiresInMs = airQuality
        ? getCurrentWeatherFreshness(airQuality.meta, currentTime).expiresInMs
        : null;
      const hourlyAirQualityExpiresInMs = airQualityHourly
        ? getOptionalEvidenceFreshness(airQualityHourly.meta, currentTime).expiresInMs
        : null;
      const evidenceExpiryDelays = [
        currentExpiresInMs,
        airQualityExpiresInMs,
        hourlyAirQualityExpiresInMs,
      ].filter((value): value is number => value !== null);
      const nextDelay = Math.min(nextMinuteDelay, ...evidenceExpiryDelays);
      timerId = window.setTimeout(() => scheduleFreshnessRefresh(true), nextDelay);
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (timerId !== undefined) window.clearTimeout(timerId);
      scheduleFreshnessRefresh(true);
    };

    scheduleFreshnessRefresh(hasScheduledFreshnessRef.current);
    hasScheduledFreshnessRef.current = true;
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      if (timerId !== undefined) window.clearTimeout(timerId);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [airQuality, airQualityHourly, weather.meta]);

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
  // An observation and a daily forecast can come from different models/providers.
  // Preserve their real values; explicitly explain differences instead of falsifying a high/low.
  const outsideForecastRange =
    Boolean(todayDaily) &&
    forecastFreshness?.fresh === true &&
    currentEvidenceFresh &&
    (weather.temperature > (todayDaily?.tempMax ?? Infinity) + 0.5 ||
      weather.temperature < (todayDaily?.tempMin ?? -Infinity) - 0.5);
  const airQualityFreshness = airQuality ? getCurrentWeatherFreshness(airQuality.meta, now) : null;
  const freshAirQuality = airQualityFreshness?.fresh ? airQuality : undefined;
  const freshAirQualityHourly =
    airQualityHourly && getOptionalEvidenceFreshness(airQualityHourly.meta, now).fresh
      ? airQualityHourly
      : undefined;
  const decisionEvidenceFresh = currentEvidenceFresh && (forecastFreshness?.fresh ?? true);
  const decisions = useMemo(
    () =>
      decisionEvidenceFresh
        ? getWeatherDecisions({
            weather,
            hourly,
            airQuality: freshAirQuality,
            uvIndexMax,
            bestWindowTime: hourly.length
              ? (getDecisionSnapshot({
                  weather,
                  hourly,
                  airQuality: freshAirQuality,
                  ...(freshAirQualityHourly ? { airQualityHourly: freshAirQualityHourly } : {}),
                }).bestWindow?.peak.time ?? null)
              : undefined,
            now: new Date(now),
          })
        : ([{ kind: 'unavailable', severity: 'info' }] satisfies WeatherDecision[]),
    [
      decisionEvidenceFresh,
      freshAirQuality,
      freshAirQualityHourly,
      hourly,
      now,
      uvIndexMax,
      weather,
    ]
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

  const currentWet = currentEvidenceFresh
    ? ['09d', '09n', '10d', '10n', '11d', '11n'].includes(weather.icon)
    : undefined;
  const nextChange = getNextChange(hourly, weather.temperature, new Date(now), currentWet);
  const nextChangeText =
    decisionEvidenceFresh && hourly.length > 0
      ? t(`hava81.decision.upcoming.${nextChange.kind}`, {
          time: formatCityTime(
            nextChange.time,
            weather.meta.timezoneOffsetSeconds,
            settings.language
          ),
          temperature: nextChange.temp === null ? '' : formatTemperature(nextChange.temp),
        })
      : t('hava81.decision.upcoming.unavailable', {
          defaultValue: 'Yakın saatler için değişim bilgisi henüz hazır değil.',
        });
  const trendHours = hourly.filter(hour => hour.time.getTime() > now).slice(0, 24);
  const trend = (() => {
    if (trendHours.length < 2) return null;
    const temps = trendHours.map(hour => hour.temp);
    const min = Math.min(...temps);
    const max = Math.max(...temps);
    const span = Math.max(max - min, 1);
    const points = temps.map((temp, index) => ({
      x: (index / (temps.length - 1)) * 240,
      y: 6 + (1 - (temp - min) / span) * 36,
    }));
    // Monotone cubic (Fritsch–Carlson) curve: smooth like a drawn line, but it never
    // overshoots the hourly values, so it cannot suggest a temperature that is not forecast.
    const slopes = points
      .slice(1)
      .map((point, i) => (point.y - points[i].y) / (point.x - points[i].x));
    const tangents = points.map((_, i) => {
      if (i === 0) return slopes[0];
      if (i === points.length - 1) return slopes[slopes.length - 1];
      const before = slopes[i - 1];
      const after = slopes[i];
      return before * after <= 0 ? 0 : (2 * before * after) / (before + after);
    });
    const f = (value: number) => value.toFixed(1);
    let line = `M${f(points[0].x)},${f(points[0].y)}`;
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i];
      const b = points[i + 1];
      const dx = (b.x - a.x) / 3;
      line += ` C${f(a.x + dx)},${f(a.y + tangents[i] * dx)} ${f(b.x - dx)},${f(b.y - tangents[i + 1] * dx)} ${f(b.x)},${f(b.y)}`;
    }
    const peakIndex = temps.indexOf(max);
    // Four evenly spaced hour labels give the curve a time axis.
    const tickIndexes = [0, 1, 2, 3].map(step => Math.round((step / 3) * (trendHours.length - 1)));
    return {
      min,
      max,
      line,
      area: `${line} L240,48 L0,48 Z`,
      start: { x: 0, y: (points[0].y / 48) * 100 },
      peak: { x: (points[peakIndex].x / 240) * 100, y: (points[peakIndex].y / 48) * 100 },
      ticks: tickIndexes.map(index => ({
        x: (points[index].x / 240) * 100,
        label: formatForecastTime(trendHours[index].time),
      })),
      // Absolute temperature colours (the same scale as the hourly chart), so a 2° day is
      // not painted as a full cold-to-hot swing.
      warmColor: temperatureColor(max, TEMPERATURE_SCALE_DARK),
      coolColor: temperatureColor(min, TEMPERATURE_SCALE_DARK),
    };
  })();
  const heroScene = useMemo(() => resolveSkyScene(weather, hourly, now), [weather, hourly, now]);
  // Light rain below the "likely" threshold still gets the next-change line; the calm verdict
  // must not read as if that rain did not exist.
  const lightRainAhead = nextChange.kind === 'rainStarts';
  const stableCopy = (compact: boolean) =>
    t(
      compact
        ? 'hava81.decision.compactActions.stableLightRain'
        : 'hava81.decision.actions.stableLightRain'
    );
  const trendGradientId = `${headingId}-trend`.replace(/[^a-zA-Z0-9_-]/g, '');

  return (
    <section className={`hava81-decision-field ${className}`.trim()} aria-labelledby={headingId}>
      <HeroSky scene={heroScene} />
      <header className="hava81-decision-field__identity">
        <div className="hava81-decision-field__city-row">
          <h1 id={headingId} className="hava81-decision-field__city">
            {cityMetadata?.name ?? weather.cityName}
          </h1>
          {cityMetadata ? (
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
          ) : (
            <span className="hava81-decision-field__plate hava81-decision-field__plate--district">
              <strong>{t('hava81.decision.districtLabel')}</strong>
            </span>
          )}
        </div>

        <div className="hava81-decision-field__atlas-meta">
          <time className="hava81-decision-field__observed-full" dateTime={observedAtDateTime}>
            {observedAtText}
          </time>
          <time className="hava81-decision-field__observed-compact" dateTime={observedAtDateTime}>
            {compactObservedAtText}
          </time>
          <span className="hava81-decision-field__coordinate-meta" aria-hidden="true">
            ·
          </span>
          <span className="hava81-decision-field__coordinate-meta">
            {t('hava81.decision.latitude', { defaultValue: 'Enlem' })}{' '}
            {coordinateFormatter.format(weather.coordinates.lat)}°
          </span>
          <span className="hava81-decision-field__coordinate-meta" aria-hidden="true">
            ·
          </span>
          <span className="hava81-decision-field__coordinate-meta">
            {t('hava81.decision.longitude', { defaultValue: 'Boylam' })}{' '}
            {coordinateFormatter.format(weather.coordinates.lon)}°
          </span>
          <span className="hava81-decision-field__coordinate-meta" aria-hidden="true">
            ·
          </span>
          <span className="hava81-decision-field__provider-meta">{weather.meta.provider}</span>
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
                <WeatherIllustration
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
            <p className="hava81-decision-field__next-change" data-kind={nextChange.kind}>
              {nextChangeText}
            </p>
            {trend ? (
              <div className="hava81-decision-field__trend-wrap">
                <svg
                  className="hava81-decision-field__trend"
                  viewBox="0 0 240 48"
                  preserveAspectRatio="none"
                  role="img"
                  aria-label={t('hava81.decision.upcoming.chart', {
                    min: formatTemperature(trend.min),
                    max: formatTemperature(trend.max),
                  })}
                >
                  <defs>
                    {/* Colour follows temperature: warm hours glow amber, cool hours blue. */}
                    <linearGradient
                      id={trendGradientId}
                      gradientUnits="userSpaceOnUse"
                      x1="0"
                      y1="6"
                      x2="0"
                      y2="42"
                    >
                      <stop offset="0" stopColor={trend.warmColor} />
                      <stop offset="1" stopColor={trend.coolColor} />
                    </linearGradient>
                    <linearGradient id={`${trendGradientId}-area`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="currentColor" stopOpacity="0.16" />
                      <stop offset="1" stopColor="currentColor" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    className="hava81-decision-field__trend-area"
                    d={trend.area}
                    style={{ fill: `url(#${trendGradientId}-area)` }}
                  />
                  <path
                    className="hava81-decision-field__trend-line"
                    d={trend.line}
                    style={{ stroke: `url(#${trendGradientId})` }}
                  />
                </svg>
                <span
                  className="hava81-decision-field__trend-now"
                  style={{ left: `${trend.start.x}%`, top: `${trend.start.y}%` }}
                  aria-hidden="true"
                />
                <span
                  className={`hava81-decision-field__trend-peak${
                    trend.peak.x < 15 ? ' is-start' : trend.peak.x > 85 ? ' is-end' : ''
                  }`}
                  style={{ left: `${trend.peak.x}%`, top: `${trend.peak.y}%` }}
                  aria-hidden="true"
                >
                  {t('hava81.decision.upcoming.peak', {
                    temperature: formatTemperature(trend.max),
                  })}
                </span>
                <ol className="hava81-decision-field__trend-ticks" aria-hidden="true">
                  {trend.ticks.map(tick => (
                    <li key={tick.x} style={{ left: `${tick.x}%` }}>
                      {tick.label}
                    </li>
                  ))}
                </ol>
              </div>
            ) : !forecastMeta ? (
              <div className="hava81-decision-field__trend-placeholder" aria-hidden="true" />
            ) : null}
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
          {decisions.map((decision, index) => {
            const lightRainCalm = decision.kind === 'stable' && lightRainAhead;
            const fullCopy = lightRainCalm ? stableCopy(false) : decisionCopy(decision);
            return (
              <li
                key={`${decision.kind}-${index}`}
                data-severity={decision.severity}
                data-kind={decision.kind}
                aria-label={fullCopy}
              >
                <span className="hava81-decision-field__decision-copy--full" aria-hidden="true">
                  {fullCopy}
                </span>
                <span className="hava81-decision-field__decision-copy--compact" aria-hidden="true">
                  {lightRainCalm ? stableCopy(true) : compactDecisionCopy(decision)}
                </span>
              </li>
            );
          })}
        </ul>
      </aside>

      <dl className="hava81-decision-field__rail">
        <div className="hava81-decision-field__metric">
          <dt>
            {t('hava81.decision.forecastHighLow', {
              defaultValue: 'Bugün (takvim günü) yüksek / düşük',
            })}
          </dt>
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
      {outsideForecastRange && (
        <p className="hava81-decision-field__source-note">
          {t('hava81.decision.sourceDifference', {
            currentProvider: weather.meta.provider,
            forecastProvider: forecastMeta?.provider ?? 'Open-Meteo',
          })}
        </p>
      )}
    </section>
  );
}

export default WeatherDecisionField;
