import type { CSSProperties, RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../../context';
import { formatPrecipitationAmount } from '../../../utils/precipitation';
import { WeatherSymbol } from '../WeatherSymbol';
import { PRECIPITATION_THRESHOLD } from './constants';
import type { ForecastAtlasCurrent } from './ForecastAtlasCurrent';
import type { ForecastAtlasClock, HourlyDatum } from './types';

interface HourlyTimelineProps {
  hourlyData: readonly HourlyDatum[];
  hoursRef: RefObject<HTMLOListElement | null>;
  displayIntervalHours: number;
  activeHourIndex: number | null;
  clock: ForecastAtlasClock;
  current?: ForecastAtlasCurrent;
}

/** One column per shown hour: time, symbol, temperature and rain. */
export function HourlyTimeline({
  hourlyData,
  hoursRef,
  displayIntervalHours,
  activeHourIndex,
  clock,
  current,
}: HourlyTimelineProps) {
  const { t } = useTranslation();
  const { convertTemperature } = useSettings();
  const { atLocationTime, currentLocationHourKey, formatDay, hourTileFormatter, locale } = clock;

  return (
    <ol
      ref={hoursRef}
      key={`hours-${displayIntervalHours}`}
      className="hava81-forecast-atlas__hours"
      style={{
        gridTemplateColumns: `repeat(${hourlyData.length}, minmax(0, 1fr))`,
      }}
    >
      {hourlyData.map((hour, index) => {
        const precipitation = Math.round(hour.precipitation * 100);
        const precipitationAmount = formatPrecipitationAmount(hour.precipitationMm, locale);
        const localTime = atLocationTime(hour.time);
        const previousLocalTime = index > 0 ? atLocationTime(hourlyData[index - 1].time) : null;
        const dayChanged =
          previousLocalTime !== null &&
          previousLocalTime.toISOString().slice(0, 10) !== localTime.toISOString().slice(0, 10);
        const dayContext = dayChanged ? formatDay(localTime) : null;
        const isCurrentHour = localTime.toISOString().slice(0, 13) === currentLocationHourKey;
        const hourClasses = [
          'hava81-forecast-atlas__hour',
          dayChanged ? 'is-day-boundary' : '',
          isCurrentHour ? 'is-current' : '',
          hour.icon.endsWith('n') ? 'is-night' : '',
          activeHourIndex === index ? 'is-active' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <li
            className={hourClasses}
            key={`hour-${hour.timestamp}`}
            style={{ '--rhythm-i': index } as CSSProperties}
          >
            <time
              dateTime={hour.time.toISOString()}
              aria-current={isCurrentHour ? 'time' : undefined}
            >
              {dayContext ? (
                <span className="hava81-forecast-atlas__hour-day">{dayContext}</span>
              ) : null}
              {isCurrentHour ? (
                <span className="hava81-forecast-atlas__hour-now">
                  {t('hava81.forecastAtlas.nowLabel')}
                </span>
              ) : null}
              <span>{hourTileFormatter.format(localTime)}</span>
            </time>
            <WeatherSymbol
              code={isCurrentHour && current ? current.icon : hour.icon}
              size={28}
              label={isCurrentHour && current ? current.description : hour.description}
              className="hava81-forecast-atlas__hour-symbol"
            />
            <strong>
              {isCurrentHour && current
                ? Math.round(convertTemperature(current.temperature))
                : hour.convertedTemp}
              °
            </strong>
            {precipitation > 0 || precipitationAmount ? (
              <span
                className={
                  precipitation >= PRECIPITATION_THRESHOLD * 100 ||
                  (Number.isFinite(hour.precipitationMm) && (hour.precipitationMm ?? 0) >= 0.2)
                    ? 'hava81-forecast-atlas__hour-pop is-signal'
                    : 'hava81-forecast-atlas__hour-pop'
                }
                role="group"
                aria-label={
                  precipitationAmount && precipitation > 0
                    ? t('hava81.forecastAtlas.hourlyPrecipitationWithAmount', {
                        percent: precipitation,
                        amount: precipitationAmount,
                      })
                    : precipitationAmount
                      ? t('hava81.activities.conditions.rainAmount', {
                          amount: precipitationAmount,
                        })
                      : `${t('weather.precipitation')}: ${precipitation}%`
                }
              >
                {precipitation > 0 ? <span>{precipitation}%</span> : null}
                {precipitation > 0 && precipitationAmount ? (
                  <span aria-hidden="true"> · </span>
                ) : null}
                {precipitationAmount ? <span>{precipitationAmount}</span> : null}
              </span>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
