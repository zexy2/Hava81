import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { weatherService } from '../../api/weatherService';
import { useSettings } from '../../context';
import { buildActivityPlan } from '../../domain/activity/buildActivityPlan';
import type { ActivityPlan } from '../../domain/activity/types';
import { buildDailyPlan } from '../../domain/decision/buildDailyPlan';
import type { DailyPlan } from '../../domain/decision/types';
import { useDecisionProfile } from '../../hooks/useDecisionProfile';
import type {
  AirQuality,
  FavoriteCity,
  ForecastMeta,
  HourlyForecast,
  NormalizedWeatherData,
} from '../../types';
import { formatPrecipitationSummary, pickMostSignificantPrecipitation } from '../../utils/precipitation';
import './ComparePanel.css';

interface ComparePanelProps {
  cities: FavoriteCity[];
  language: 'tr' | 'en';
}

interface CompareRow {
  weather: NormalizedWeatherData;
  airQuality?: AirQuality;
  hourly: HourlyForecast[];
  meta: ForecastMeta;
  plan: DailyPlan;
  activityPlan?: ActivityPlan;
}

export function ComparePanel({ cities, language }: ComparePanelProps) {
  const { t, i18n } = useTranslation();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const { convertTemperature, convertWindSpeed, getTemperatureSymbol, getWindSpeedSymbol } =
    useSettings();
  const { profile } = useDecisionProfile();
  const selected = useMemo(() => cities.slice(0, 3), [cities]);
  const [rows, setRows] = useState<CompareRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [failedCount, setFailedCount] = useState(0);
  const primaryActivity = profile.activities[0];

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    let active = true;
    if (selected.length < 2) {
      setRows([]);
      setFailedCount(0);
      return () => {
        active = false;
      };
    }
    setRows([]);
    setLoading(true);
    setFailedCount(0);
    Promise.allSettled(
      selected.map(async city => {
        const weather = await weatherService.getCurrentWeather({ city: city.name, lang: language });
        const [forecastResult, hourlyResult, airResult] = await Promise.allSettled([
          weatherService.getForecast(weather.coordinates.lat, weather.coordinates.lon, language),
          weatherService.getHourlyForecast(weather.coordinates.lat, weather.coordinates.lon, language),
          weatherService.getAirQuality(weather.coordinates.lat, weather.coordinates.lon, language),
        ]);
        const airQuality = airResult.status === 'fulfilled' ? airResult.value : undefined;
        const hourlySource =
          hourlyResult.status === 'fulfilled' && hourlyResult.value.hourly.length
            ? hourlyResult.value
            : forecastResult.status === 'fulfilled' && forecastResult.value.hourly.length
              ? forecastResult.value
              : undefined;
        if (!hourlySource) {
          throw new Error('No usable hourly comparison forecast');
        }
        const decisionHourly = hourlySource.hourly;
        const decisionMeta = hourlySource.meta;
        const plan = buildDailyPlan({ weather, hourly: decisionHourly, airQuality });
        const activityPlan = primaryActivity
          ? buildActivityPlan({
              activity: primaryActivity,
              weather,
              hourly: decisionHourly,
              airQuality,
              sensitivity: profile.temperatureSensitivity,
              preferredStart: profile.activityStart,
              preferredEnd: profile.activityEnd,
            })
          : undefined;
        return {
          weather,
          airQuality,
          hourly: decisionHourly,
          meta: decisionMeta,
          plan,
          activityPlan,
        } satisfies CompareRow;
      })
    )
      .then(results => {
        if (!active) return;
        const successfulRows = results.flatMap(result =>
          result.status === 'fulfilled' ? [result.value] : []
        );
        setRows(successfulRows);
        setFailedCount(results.length - successfulRows.length);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [language, primaryActivity, profile.activityEnd, profile.activityStart, profile.temperatureSensitivity, selected]);

  const winner = useMemo(
    () =>
      rows.reduce<CompareRow | undefined>(
        (best, row) => (!best || row.plan.score > best.plan.score ? row : best),
        undefined
      ),
    [rows]
  );
  const offsetTime = (row: CompareRow, date?: Date) => {
    if (!date) return '—';
    const offset = (row.weather.meta.timezoneOffsetSeconds ?? 0) * 1000;
    return new Date(date.getTime() + offset).toLocaleTimeString(i18n.language, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    });
  };

  return (
    <section className="hava81-compare" aria-labelledby="hava81-compare-title">
      <header className="hava81-compare__header">
        <div>
          <span className="atlas-kicker">{t('weather.favoriteCities')}</span>
          <h2 id="hava81-compare-title" ref={headingRef} tabIndex={-1}>
            {t('hava81.compare.title')}
          </h2>
        </div>
        {winner && rows.length >= 2 ? (
          <div className="hava81-compare__winner" role="status">
            <span>{t('hava81.compare.winnerLabel')}</span>
            <strong>
              {t('hava81.compare.winner', {
                city: winner.weather.cityName,
                score: winner.plan.score,
              })}
            </strong>
            <small>{t('hava81.compare.winnerNote')}</small>
          </div>
        ) : null}
      </header>
      {cities.length > selected.length ? (
        <p className="hava81-compare__limit-note">
          {t('hava81.compare.limitNote', { cities: selected.map(city => city.name).join(', ') })}
        </p>
      ) : null}
      {selected.length < 2 ? (
        <p>{t('hava81.compare.needTwo')}</p>
      ) : loading && rows.length === 0 ? (
        <p role="status">{t('common.loading')}</p>
      ) : failedCount === selected.length ? (
        <p role="status">{t('hava81.compare.unavailable')}</p>
      ) : (
        <>
          {failedCount > 0 ? (
            <p className="hava81-compare__partial" role="status">
              {t('hava81.compare.partialUnavailable')}
            </p>
          ) : null}
          <div
            className="hava81-compare__table"
            role="list"
            aria-label={t('hava81.compare.title')}
          >
          {rows.map(row => {
            const nearTerm = row.hourly.slice(0, 6);
            const precipitationPeak = pickMostSignificantPrecipitation(nearTerm);
            const peakPop = precipitationPeak?.pop ?? 0;
            const peakPrecipitationMm = precipitationPeak?.precipitationMm ?? 0;
            return (
              <article
                className={`hava81-compare__city${winner?.weather.cityName === row.weather.cityName ? ' is-winner' : ''}`}
                role="listitem"
                key={row.weather.cityName}
              >
                <header>
                  <h3>{row.weather.cityName}</h3>
                  <strong className="hava81-compare__score">
                    {row.plan.score}
                    <span>/100</span>
                  </strong>
                </header>
                <div className="hava81-compare__metrics">
                  <span>
                    {t('hava81.compare.temp')}{' '}
                    <b>
                      {Math.round(convertTemperature(row.weather.temperature))}
                      {getTemperatureSymbol()}
                    </b>
                  </span>
                  <span>
                    {t('hava81.compare.rain')}{' '}
                    <b>{formatPrecipitationSummary(
                      peakPop,
                      peakPrecipitationMm,
                      i18n.language,
                      t('hava81.compare.noRain')
                    )}</b>
                  </span>
                  <span>
                    {t('weather.wind')}{' '}
                    <b>
                      {convertWindSpeed(row.weather.windSpeed)} {getWindSpeedSymbol()}
                    </b>
                  </span>
                  <span>
                    {t('hava81.compare.aqi')}{' '}
                    <b>{row.airQuality ? `${row.airQuality.aqi}/5` : '—'}</b>
                  </span>
                  <span>
                    {t('hava81.compare.bestTime')}{' '}
                    <b>
                      {row.plan.bestWindowRange
                        ? row.plan.bestWindowRange.start.time.getTime() ===
                          row.plan.bestWindowRange.end.time.getTime()
                          ? offsetTime(row, row.plan.bestWindowRange.peak.time)
                          : `${offsetTime(row, row.plan.bestWindowRange.start.time)}–${offsetTime(
                              row,
                              row.plan.bestWindowRange.end.time
                            )}`
                        : '—'}
                    </b>
                  </span>
                  {row.activityPlan ? (
                    <span>
                      {t(`hava81.activities.names.${row.activityPlan.activity}`)}{' '}
                      <b>{row.activityPlan.score}/100</b>
                    </span>
                  ) : null}
                </div>
                <small>{row.weather.description}</small>
              </article>
            );
          })}
          </div>
        </>
      )}
    </section>
  );
}

export default ComparePanel;
