import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../context';
import type { AirQuality, NormalizedWeatherData } from '../../types';
import { getOpenWeatherAqiLabelKey } from '../../utils/airQuality';
import './EnvironmentRail.css';

const WIND_DIRECTION_KEYS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

export interface EnvironmentRailProps {
  weather: NormalizedWeatherData;
  airQuality?: AirQuality;
  onOpenMap: () => void;
  mapExpanded: boolean;
}

function DaylightIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3 18.5h18" />
      <path d="M7.5 18.5a4.5 4.5 0 0 1 9 0" />
      <path d="M12 4.5v3M5.6 8.1l2.1 2.1M18.4 8.1l-2.1 2.1" />
    </svg>
  );
}

function WindIcon({ direction }: { direction: number }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="8.5" />
      <g transform={`rotate(${direction} 12 12)`}>
        <path d="M12 4v15" />
        <path d="m8.8 7.5 3.2-3.5 3.2 3.5" />
      </g>
    </svg>
  );
}

function AirIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M3.5 8.5h10.8c1.8 0 2.7-1 2.7-2.2 0-1.1-.8-2-2-2" />
      <path d="M3.5 12h15.2c1.2 0 2.3.9 2.3 2.1 0 1.3-1 2.4-2.5 2.4" />
      <path d="M3.5 15.5h8.8c1.6 0 2.7 1 2.7 2.3 0 1.2-.9 2.2-2.2 2.2" />
    </svg>
  );
}

function MapIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="m3.5 6 5-2.5 7 2.5 5-2.5v14.5l-5 2.5-7-2.5-5 2.5z" />
      <path d="M8.5 3.5v14.5M15.5 6v14.5" />
    </svg>
  );
}

function isValidDate(value: Date): boolean {
  return !Number.isNaN(value.getTime());
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

  const timeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        hour: '2-digit',
        minute: '2-digit',
      }),
    [locale]
  );

  const numberFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        maximumFractionDigits: 1,
      }),
    [locale]
  );

  const hasValidDaylight = isValidDate(weather.sunrise) && isValidDate(weather.sunset);
  const sunsetTime = hasValidDaylight ? timeFormatter.format(weather.sunset) : t('weather.noData');

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

  const hasValidWind = Number.isFinite(weather.windDirection) && Number.isFinite(weather.windSpeed);
  const normalizedDirection = hasValidWind ? ((weather.windDirection % 360) + 360) % 360 : 0;
  const directionKey = WIND_DIRECTION_KEYS[Math.round(normalizedDirection / 45) % 8];
  const directionLabel = hasValidWind ? t(`wind.directions.${directionKey}`) : t('weather.noData');
  const windSpeed = hasValidWind
    ? `${numberFormatter.format(convertWindSpeed(weather.windSpeed))} ${getWindSpeedSymbol()}`
    : t('weather.noData');
  const airQualityLabelKey = airQuality ? getOpenWeatherAqiLabelKey(airQuality.aqi) : undefined;
  const airQualityLabel = airQualityLabelKey ? t(airQualityLabelKey) : t('weather.noData');

  const sectionLabel = [
    t('daylight.title'),
    t('weather.wind'),
    t('weather.airQuality'),
    t('common.map'),
  ].join(', ');

  return (
    <section className="environment-rail" aria-label={sectionLabel}>
      <div className="environment-rail__module">
        <span className="environment-rail__icon">
          <DaylightIcon />
        </span>
        <span className="environment-rail__label">{t('daylight.sunset')}</span>
        <strong className="environment-rail__value">{sunsetTime}</strong>
        <span className="environment-rail__detail">
          {t('daylight.dayLength')} · {daylightLength}
        </span>
      </div>

      <div className="environment-rail__module">
        <span className="environment-rail__icon">
          <WindIcon direction={normalizedDirection} />
        </span>
        <span className="environment-rail__label">{t('weather.wind')}</span>
        <strong className="environment-rail__value">
          {directionLabel} · {windSpeed}
        </strong>
        <span className="environment-rail__detail">
          {hasValidWind ? `${Math.round(normalizedDirection)}°` : t('weather.noData')}
        </span>
      </div>

      <div className="environment-rail__module">
        <span className="environment-rail__icon">
          <AirIcon />
        </span>
        <span className="environment-rail__label">{t('weather.airQuality')}</span>
        <strong className="environment-rail__value">
          {airQualityLabelKey ? `${airQuality?.aqi} / 5` : '—'}
        </strong>
        <span className="environment-rail__detail">
          {airQuality && airQualityLabelKey
            ? `${airQualityLabel} · ${t('airQuality.pm25')} ${numberFormatter.format(
                airQuality.pm25
              )} µg/m³`
            : t('weather.noData')}
        </span>
      </div>

      <button
        type="button"
        className="environment-rail__module environment-rail__module--action"
        onClick={onOpenMap}
        aria-expanded={mapExpanded}
        aria-pressed={mapExpanded}
        aria-label={mapExpanded ? t('weather.hideMap') : t('weather.showMap')}
      >
        <span className="environment-rail__icon">
          <MapIcon />
        </span>
        <span className="environment-rail__label">{t('common.map')}</span>
        <strong className="environment-rail__value">
          {mapExpanded ? t('weather.hideMap') : t('weather.showMap')}
        </strong>
        <span className="environment-rail__detail">{weather.cityName}</span>
      </button>
    </section>
  );
}

export default EnvironmentRail;
