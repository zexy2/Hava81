import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../context';
import type { AirQuality, NormalizedWeatherData } from '../../types';
import { getOpenWeatherAqiLabelKey } from '../../utils/airQuality';
import { getCurrentWeatherFreshness } from '../../utils/currentWeatherFreshness';
import { getCityMetadata } from '../../constants/cityMetadata';
import { formatCityClock } from '../../utils/format';
import { AqiScale, SunArc, WindCompass } from './instruments/EnvironmentInstruments';
import { TurkeyLocator } from './instruments/TurkeyLocator';
import './instruments/instruments.css';
import './EnvironmentRail.css';

const WIND_DIRECTION_KEYS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;
export interface EnvironmentRailProps {
  weather: NormalizedWeatherData;
  airQuality?: AirQuality;
  onOpenMap: () => void;
  mapExpanded: boolean;
}

function isValidDate(value: Date): boolean {
  return !Number.isNaN(value.getTime());
}

function getLocationDateKey(date: Date, timezoneOffsetMs: number): string {
  return new Date(date.getTime() + timezoneOffsetMs).toISOString().slice(0, 10);
}

function millisecondsUntilNextLocationDay(timezoneOffsetMs: number): number {
  const shiftedNowMs = Date.now() + timezoneOffsetMs;
  const locationNow = new Date(shiftedNowMs);
  const nextDayStartMs = Date.UTC(
    locationNow.getUTCFullYear(),
    locationNow.getUTCMonth(),
    locationNow.getUTCDate() + 1
  );
  return Math.max(100, nextDayStartMs - shiftedNowMs);
}

export function EnvironmentRail({
  weather,
  airQuality,
  onOpenMap,
  mapExpanded,
}: EnvironmentRailProps) {
  const { t } = useTranslation();
  const { settings, convertWindSpeed, getWindSpeedSymbol } = useSettings();
  const locale = settings.language === 'en' ? 'en-US' : 'tr-TR';
  const [freshnessRevision, setFreshnessRevision] = useState(0);
  const timezoneOffsetMs = weather.meta.timezoneOffsetSeconds * 1000;
  const locationDateKey = getLocationDateKey(new Date(), timezoneOffsetMs);
  const sunriseDateKey = isValidDate(weather.sunrise)
    ? getLocationDateKey(weather.sunrise, timezoneOffsetMs)
    : null;
  const sunsetDateKey = isValidDate(weather.sunset)
    ? getLocationDateKey(weather.sunset, timezoneOffsetMs)
    : null;
  const hasValidDaylight =
    sunriseDateKey === locationDateKey &&
    sunsetDateKey === locationDateKey &&
    weather.sunset.getTime() > weather.sunrise.getTime();
  const daylightIsStale =
    isValidDate(weather.sunrise) && isValidDate(weather.sunset) && !hasValidDaylight;
  const currentFreshness = getCurrentWeatherFreshness(weather.meta);
  const airQualityFreshness = getCurrentWeatherFreshness(airQuality?.meta ?? null);
  const nextFreshnessExpiryMs = [
    currentFreshness.expiresInMs,
    airQuality ? airQualityFreshness.expiresInMs : null,
  ].reduce<number | null>(
    (soonest, candidate) =>
      candidate === null ? soonest : soonest === null ? candidate : Math.min(soonest, candidate),
    null
  );
  useEffect(() => {
    const resyncFreshness = () => setFreshnessRevision(revision => revision + 1);
    const nextLocalDayExpiryMs = millisecondsUntilNextLocationDay(timezoneOffsetMs);
    const nextRefreshMs =
      nextFreshnessExpiryMs === null
        ? nextLocalDayExpiryMs
        : Math.min(nextFreshnessExpiryMs, nextLocalDayExpiryMs);
    const timerId = window.setTimeout(resyncFreshness, Math.max(100, nextRefreshMs));
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') resyncFreshness();
    };

    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      if (timerId !== undefined) window.clearTimeout(timerId);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [
    airQuality?.meta.fetchedAt,
    airQuality?.meta.freshForSeconds,
    freshnessRevision,
    nextFreshnessExpiryMs,
    timezoneOffsetMs,
    weather.meta.fetchedAt,
    weather.meta.freshForSeconds,
    weather.meta.timezoneOffsetSeconds,
  ]);

  const timeFormatter = {
    format: (date: Date) =>
      formatCityClock(date, { language: settings.language, timezoneOffsetSeconds: 0 }),
  };

  const numberFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        maximumFractionDigits: 1,
      }),
    [locale]
  );

  const atLocationTime = (date: Date): Date => new Date(date.getTime() + timezoneOffsetMs);
  const sunriseTime = hasValidDaylight
    ? timeFormatter.format(atLocationTime(weather.sunrise))
    : t('weather.noData');
  const sunsetTime = hasValidDaylight
    ? timeFormatter.format(atLocationTime(weather.sunset))
    : t('weather.noData');

  // Outside daylight the useful next event is the sunrise, not a sunset that already passed.
  // Only today's pair is known, so after sunset the next sunrise is approximated as +24h.
  const nowMs = Date.now();
  const showSunrise =
    hasValidDaylight && (nowMs >= weather.sunset.getTime() || nowMs < weather.sunrise.getTime());
  const nextSunrise =
    showSunrise && nowMs >= weather.sunset.getTime()
      ? new Date(weather.sunrise.getTime() + 86_400_000)
      : weather.sunrise;
  const nextSunriseTime = hasValidDaylight
    ? timeFormatter.format(atLocationTime(nextSunrise))
    : t('weather.noData');

  const daylightProgress = hasValidDaylight
    ? (nowMs - weather.sunrise.getTime()) / (weather.sunset.getTime() - weather.sunrise.getTime())
    : 0;
  const cityMetadata = getCityMetadata(weather.cityName);
  const cityCoordinates = cityMetadata?.coordinates ?? weather.coordinates;

  const daylightLength = useMemo(() => {
    if (!hasValidDaylight) return t('weather.noData');

    const totalMinutes = Math.max(
      0,
      Math.round((weather.sunset.getTime() - weather.sunrise.getTime()) / 60_000)
    );
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `${hours} ${t('daylight.hours')} ${minutes} ${t('daylight.minutes')}`;
  }, [hasValidDaylight, t, weather.sunrise, weather.sunset]);

  const hasValidWind =
    currentFreshness.fresh &&
    Number.isFinite(weather.windDirection) &&
    Number.isFinite(weather.windSpeed);
  const normalizedDirection = hasValidWind ? ((weather.windDirection % 360) + 360) % 360 : 0;
  const directionKey = WIND_DIRECTION_KEYS[Math.round(normalizedDirection / 45) % 8];
  const directionLabel = hasValidWind ? t(`wind.directions.${directionKey}`) : t('weather.noData');
  const windSpeed = hasValidWind
    ? `${numberFormatter.format(convertWindSpeed(weather.windSpeed))} ${getWindSpeedSymbol()}`
    : t('weather.noData');
  const freshAirQuality = airQuality && airQualityFreshness.fresh ? airQuality : undefined;
  const airQualityIsStale =
    airQuality !== undefined &&
    !airQualityFreshness.fresh &&
    airQualityFreshness.status === 'stale';
  const airQualityLabelKey = freshAirQuality
    ? getOpenWeatherAqiLabelKey(freshAirQuality.aqi)
    : undefined;
  const airQualityLabel = airQualityLabelKey ? t(airQualityLabelKey) : t('weather.noData');
  const airQualityObservedAt = freshAirQuality?.meta.observedAt;
  const airQualityObservedTime =
    airQualityObservedAt && isValidDate(airQualityObservedAt)
      ? timeFormatter.format(atLocationTime(airQualityObservedAt))
      : null;

  const sectionLabel = [
    t('daylight.title'),
    t('weather.wind'),
    t('weather.airQuality'),
    t('common.map'),
  ].join(', ');

  return (
    <section className="environment-rail" aria-label={sectionLabel}>
      <div className="environment-rail__module" data-testid="instrument-daylight">
        <span className="environment-rail__icon">
          <SunArc progress={daylightProgress} night={showSunrise} />
        </span>
        <span className="environment-rail__label">
          {showSunrise ? t('daylight.nextSunrise') : t('daylight.sunset')}
        </span>
        <strong className="environment-rail__value">
          {showSunrise ? (
            <time dateTime={nextSunrise.toISOString()}>{nextSunriseTime}</time>
          ) : hasValidDaylight ? (
            <time dateTime={weather.sunset.toISOString()}>{sunsetTime}</time>
          ) : (
            sunsetTime
          )}
        </strong>
        <span className="environment-rail__detail" role={daylightIsStale ? 'status' : undefined}>
          {daylightIsStale ? (
            t('daylight.stale')
          ) : showSunrise ? (
            <>
              {t('daylight.sunset')}{' '}
              <time dateTime={weather.sunset.toISOString()}>{sunsetTime}</time> ·{' '}
              {t('daylight.dayLength')} · {daylightLength}
            </>
          ) : (
            <>
              {t('daylight.sunrise')}{' '}
              {hasValidDaylight ? (
                <time dateTime={weather.sunrise.toISOString()}>{sunriseTime}</time>
              ) : (
                sunriseTime
              )}{' '}
              · {t('daylight.dayLength')} · {daylightLength}
            </>
          )}
        </span>
      </div>

      <div className="environment-rail__module" data-testid="instrument-wind">
        <span className="environment-rail__icon">
          <WindCompass direction={normalizedDirection} active={hasValidWind} />
        </span>
        <span className="environment-rail__label">{t('weather.wind')}</span>
        <strong className="environment-rail__value">
          {directionLabel} · {windSpeed}
        </strong>
        <span
          className="environment-rail__detail"
          role={currentFreshness.fresh ? undefined : 'status'}
        >
          {hasValidWind
            ? t('wind.fromDirection', {
                direction: t(`wind.from.${directionKey}`),
                degrees: Math.round(normalizedDirection),
              })
            : currentFreshness.fresh
              ? t('weather.noData')
              : t('weather.staleCurrentData')}
        </span>
      </div>

      <div className="environment-rail__module" data-testid="instrument-aqi">
        <span className="environment-rail__icon">
          <AqiScale aqi={airQualityLabelKey && freshAirQuality ? freshAirQuality.aqi : null} />
        </span>
        <span className="environment-rail__label">{t('weather.airQuality')}</span>
        <strong className="environment-rail__value">
          {airQualityLabelKey ? `${freshAirQuality?.aqi} / 5` : '—'}
        </strong>
        <span className="environment-rail__detail" role={airQualityIsStale ? 'status' : undefined}>
          {freshAirQuality && airQualityLabelKey ? (
            <>
              {`${airQualityLabel} · ${t('airQuality.pm25')} ${numberFormatter.format(
                freshAirQuality.pm25
              )} µg/m³`}
              {airQualityObservedTime && airQualityObservedAt ? (
                <>
                  {' · '}
                  <time dateTime={airQualityObservedAt.toISOString()}>
                    {t('airQuality.observedAt', { time: airQualityObservedTime })}
                  </time>
                </>
              ) : null}
            </>
          ) : airQualityIsStale ? (
            t('weather.staleCurrentData')
          ) : (
            t('weather.noData')
          )}
        </span>
      </div>

      <button
        type="button"
        className="environment-rail__module environment-rail__module--action"
        onClick={onOpenMap}
        aria-expanded={mapExpanded}
        aria-controls={mapExpanded ? 'weather-map-region' : undefined}
        data-testid="instrument-map"
      >
        <span className="environment-rail__icon">
          {cityCoordinates ? (
            <TurkeyLocator lat={cityCoordinates.lat} lon={cityCoordinates.lon} />
          ) : null}
        </span>
        <span className="environment-rail__label">{t('common.map')}</span>
        <strong className="environment-rail__value">
          {mapExpanded ? t('weather.hideMap') : t('weather.showMap')}
        </strong>
        <span className="environment-rail__detail">
          {cityMetadata?.name ?? weather.cityName}
        </span>
      </button>
    </section>
  );
}

export default EnvironmentRail;
