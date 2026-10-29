import { useId, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../context';
import type { DailyForecast, HourlyForecast, ForecastMeta } from '../../types';
import { normalizeOptionalPrecipitationRatio } from '../../utils/precipitation';
import { LEGACY_HOUR_LIMIT, REAL_HOURLY_HORIZON } from './forecastAtlas/constants';
import { DailyForecastSection } from './forecastAtlas/DailyForecastSection';
import type { ForecastAtlasCurrent } from './forecastAtlas/ForecastAtlasCurrent';
import { HourlyForecastSection } from './forecastAtlas/HourlyForecastSection';
import type { ForecastAtlasClock } from './forecastAtlas/types';
import { useForecastClock } from './forecastAtlas/useForecastClock';
import { useForecastFormatters } from './forecastAtlas/useForecastFormatters';
import './ForecastAtlas.css';
import './forecastAtlas/forecastSurface.css';

export interface ForecastAtlasProps {
  daily: DailyForecast[];
  hourly: HourlyForecast[];
  meta: ForecastMeta;
  className?: string;
  /**
   * Faz 1.2: the "Now" tile shows the same "now" provider as the main card (current
   * observation, °C) instead of the model's hourly value, so the screen has one "now".
   */
  current?: ForecastAtlasCurrent;
}

/**
 * Forecast Atlas: hourly rhythm chart + hour strip and daily rows for one city.
 * The sections live in `./forecastAtlas/`; this shell owns the shared state
 * (display interval, location clock, freshness) and the prepared data.
 */
export function ForecastAtlas({
  daily,
  hourly,
  meta,
  className = '',
  current,
}: ForecastAtlasProps) {
  const { t } = useTranslation();
  const { settings, convertTemperature, getTemperatureSymbol } = useSettings();
  const id = useId();
  const locale = settings.language === 'en' ? 'en-US' : 'tr-TR';
  const temperatureSymbol = getTemperatureSymbol();
  const isFahrenheit = temperatureSymbol.includes('F');
  const headingId = `${id}-title`;

  const { timeFormatter, hourTileFormatter, dayFormatter, preciseTemperatureFormatter } =
    useForecastFormatters(locale, settings.language);
  const { currentTimeMs, forecastFreshness, timezoneOffsetMs } = useForecastClock(meta);
  const atLocationTime = (date: Date): Date => new Date(date.getTime() + timezoneOffsetMs);

  const intervalHours = meta.intervalHours;
  const currentHourKey = new Date(currentTimeMs + timezoneOffsetMs).toISOString().slice(0, 13);
  const currentTemperature = current?.temperature;

  const hourlyHorizonData = useMemo(() => {
    const source =
      intervalHours === 1
        ? hourly.slice(0, REAL_HOURLY_HORIZON)
        : hourly.slice(0, LEGACY_HOUR_LIMIT);

    return source.map(hour => {
      // One "now" on screen: the hour in progress carries the observed temperature, so the
      // curve, the hour strip and the summary agree with the main card.
      const isCurrentHour =
        typeof currentTemperature === 'number' &&
        new Date(hour.time.getTime() + timezoneOffsetMs).toISOString().slice(0, 13) ===
          currentHourKey;
      return {
        ...hour,
        timestamp: hour.time.getTime(),
        convertedTemp: Math.round(
          convertTemperature(isCurrentHour ? (currentTemperature as number) : hour.temp)
        ),
        precipitation: normalizeOptionalPrecipitationRatio(hour.pop),
      };
    });
  }, [convertTemperature, currentHourKey, currentTemperature, hourly, intervalHours, timezoneOffsetMs]);

  // Every forecast hour is shown, like Apple and Google weather: the strip scrolls through
  // the next 24 hours instead of thinning them out to every 2nd, 3rd … 12th hour.
  const hourlyData = hourlyHorizonData;

  const dailyData = useMemo(
    () =>
      daily.map(day => ({
        ...day,
        timestamp: day.date.getTime(),
        convertedMinExact: convertTemperature(day.tempMin),
        convertedMaxExact: convertTemperature(day.tempMax),
        convertedMin: Math.round(convertTemperature(day.tempMin)),
        convertedMax: Math.round(convertTemperature(day.tempMax)),
        precipitation: normalizeOptionalPrecipitationRatio(day.pop),
      })),
    [convertTemperature, daily]
  );

  const formatDay = (date: Date): string => {
    const nowAtLocation = atLocationTime(new Date());
    const dateKey = date.toISOString().slice(0, 10);
    const todayKey = nowAtLocation.toISOString().slice(0, 10);
    const tomorrow = new Date(Date.parse(`${todayKey}T12:00:00.000Z`) + 86_400_000)
      .toISOString()
      .slice(0, 10);

    if (dateKey === todayKey) return t('days.today');
    if (dateKey === tomorrow) return t('days.tomorrow');
    return dayFormatter.format(date);
  };

  const currentLocationTime = atLocationTime(new Date(currentTimeMs));
  const clock: ForecastAtlasClock = {
    locale,
    temperatureSymbol,
    atLocationTime,
    formatDay,
    timeFormatter,
    hourTileFormatter,
    currentLocationDateKey: currentLocationTime.toISOString().slice(0, 10),
    currentLocationHourKey: currentLocationTime.toISOString().slice(0, 13),
  };

  const rootClasses = ['hava81-forecast-atlas', className].filter(Boolean).join(' ');
  const hasData = hourlyData.length > 0 || dailyData.length > 0;

  if (!forecastFreshness.fresh) {
    return (
      <section className={rootClasses} aria-labelledby={headingId}>
        <header className="hava81-forecast-atlas__header">
          <h2 id={headingId} className="hava81-forecast-atlas__title">
            {t('hava81.forecastAtlas.title')}
          </h2>
          <span className="hava81-forecast-atlas__unit">{temperatureSymbol}</span>
        </header>
        <p className="hava81-forecast-atlas__empty" role="status">
          {t('hava81.forecastAtlas.stale')}
        </p>
      </section>
    );
  }

  return (
    <section className={rootClasses} aria-labelledby={headingId}>
      <header className="hava81-forecast-atlas__header">
        <h2 id={headingId} className="hava81-forecast-atlas__title">
          {t('hava81.forecastAtlas.title')}
        </h2>
        <span className="hava81-forecast-atlas__unit">{temperatureSymbol}</span>
      </header>

      {!hasData ? (
        <p className="hava81-forecast-atlas__empty" role="status">
          {t('weather.noData')}
        </p>
      ) : null}

      {hourlyData.length > 0 ? (
        <HourlyForecastSection
          id={id}
          meta={meta}
          hourlyCount={hourly.length}
          hourlyHorizonData={hourlyHorizonData}
          hourlyData={hourlyData}
          isFahrenheit={isFahrenheit}
          clock={clock}
          current={current}
        />
      ) : null}

      {dailyData.length > 0 ? (
        <DailyForecastSection
          id={id}
          dailyData={dailyData}
          preciseTemperatureFormatter={preciseTemperatureFormatter}
          clock={clock}
          nowTemperature={current ? convertTemperature(current.temperature) : undefined}
        />
      ) : null}
    </section>
  );
}

export default ForecastAtlas;
