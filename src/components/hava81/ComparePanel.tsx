import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { weatherService } from '../../api/weatherService';
import { useSettings } from '../../context';
import { buildActivityPlan } from '../../domain/activity/buildActivityPlan';
import { buildDailyPlan } from '../../domain/decision/buildDailyPlan';
import { useDecisionProfile } from '../../hooks/useDecisionProfile';
import type {
  AirQuality,
  FavoriteCity,
  ForecastMeta,
  HourlyForecast,
  NormalizedWeatherData,
} from '../../types';
import { getCurrentWeatherFreshness } from '../../utils/currentWeatherFreshness';
import { getForecastFreshness } from '../../utils/forecastFreshness';
import { getOptionalEvidenceFreshness } from '../../utils/optionalEvidenceFreshness';
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
  const [freshnessRevision, setFreshnessRevision] = useState(0);
  const primaryActivity = profile.activities[0];

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    let active = true;
    if (selected.length < 2) {
      setRows([]);
      setLoading(false);
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
        return {
          weather,
          airQuality,
          hourly: decisionHourly,
          meta: decisionMeta,
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
  }, [language, selected]);

  const freshnessNow = Date.now();
  const freshRows = rows.flatMap(row => {
    const currentFreshness = getCurrentWeatherFreshness(row.weather.meta, freshnessNow);
    const forecastFreshness = getForecastFreshness(row.meta, freshnessNow);
    if (!currentFreshness.fresh || !forecastFreshness.fresh) return [];

    const freshAirQuality =
      row.airQuality && getOptionalEvidenceFreshness(row.airQuality.meta, freshnessNow).fresh
        ? row.airQuality
        : undefined;
    const plan = buildDailyPlan({ weather: row.weather, hourly: row.hourly, airQuality: freshAirQuality });
    const activityPlan = primaryActivity
      ? buildActivityPlan({
          activity: primaryActivity,
          weather: row.weather,
          hourly: row.hourly,
          airQuality: freshAirQuality,
          sensitivity: profile.temperatureSensitivity,
          preferredStart: profile.activityStart,
          preferredEnd: profile.activityEnd,
        })
      : undefined;

    return [{ ...row, airQuality: freshAirQuality, plan, activityPlan }];
  });
  const staleCount = rows.length - freshRows.length;
  const unavailableCount = failedCount + staleCount;

  useEffect(() => {
    void freshnessRevision;
    const expiryNow = Date.now();
    const expiryDelays = rows.flatMap(row => {
      const states = [
        getCurrentWeatherFreshness(row.weather.meta, expiryNow),
        getForecastFreshness(row.meta, expiryNow),
        ...(row.airQuality ? [getOptionalEvidenceFreshness(row.airQuality.meta, expiryNow)] : []),
      ];
      return states.flatMap(state => state.fresh && state.expiresInMs !== null ? [state.expiresInMs] : []);
    });
    const nextExpiry = expiryDelays.length ? Math.min(...expiryDelays) : null;
    const resyncFreshness = () => setFreshnessRevision(value => value + 1);
    const timeout = nextExpiry === null ? undefined : window.setTimeout(resyncFreshness, nextExpiry);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') resyncFreshness();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      if (timeout !== undefined) window.clearTimeout(timeout);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [freshnessRevision, rows]);

  const leaders = useMemo(() => {
    if (freshRows.length === 0) return [];
    const topScore = Math.max(...freshRows.map(row => row.plan.score));
    return freshRows.filter(row => row.plan.score === topScore);
  }, [freshRows]);
  const winner = leaders.length === 1 ? leaders[0] : undefined;
  const isLeader = (row: CompareRow) => leaders.includes(row);
  const offsetTime = (row: CompareRow, date?: Date) => {
    if (!date) return '—';
    const offset = row.weather.meta.timezoneOffsetSeconds * 1000;
    return new Date(date.getTime() + offset).toLocaleTimeString(i18n.language, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    });
  };

  return (
    <section className="hava81-compare" aria-labelledby="hava81-compare-title" aria-busy={loading}>
      <header className="hava81-compare__header">
        <div>
          <span className="atlas-kicker">{t('weather.favoriteCities')}</span>
          <h2 id="hava81-compare-title" ref={headingRef} tabIndex={-1}>
            {t('hava81.compare.title')}
          </h2>
        </div>
        {freshRows.length >= 2 && leaders.length > 0 ? (
          <div className="hava81-compare__winner" role="status">
            {winner ? (
              <>
                <span>{t('hava81.compare.winnerLabel')}</span>
                <strong>
                  {t('hava81.compare.winner', {
                    city: winner.weather.cityName,
                    score: winner.plan.score,
                    band: t(`hava81.dailyPlan.bands.${winner.plan.band}`),
                  })}
                </strong>
              </>
            ) : (
              <>
                <span>{t('hava81.compare.tieLabel')}</span>
                <strong>
                  {t('hava81.compare.tie', {
                    cities: leaders.map(row => row.weather.cityName).join(', '),
                    score: leaders[0]?.plan.score,
                  })}
                </strong>
              </>
            )}
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
      ) : unavailableCount === selected.length ? (
        <p role="status">
          {staleCount > 0 && failedCount === 0
            ? t('hava81.compare.stale')
            : t('hava81.compare.unavailable')}
        </p>
      ) : (
        <>
          {unavailableCount > 0 ? (
            <p className="hava81-compare__partial" role="status">
              {t(staleCount > 0 ? 'hava81.compare.partialStale' : 'hava81.compare.partialUnavailable')}
            </p>
          ) : null}
          <div
            className="hava81-compare__table"
            role="list"
            aria-label={t('hava81.compare.title')}
          >
          {freshRows.map(row => {
            const nearTerm = row.hourly.slice(0, 6);
            const precipitationPeak = pickMostSignificantPrecipitation(nearTerm);
            const peakPop = precipitationPeak?.pop ?? 0;
            const peakPrecipitationMm = precipitationPeak?.precipitationMm ?? 0;
            return (
              <article
                className={`hava81-compare__city${isLeader(row) ? ' is-winner' : ''}`}
                role="listitem"
                key={row.weather.cityName}
              >
                <header>
                  <h3>{row.weather.cityName}</h3>
                  <div className="hava81-compare__score-wrap">
                    <small>{t(`hava81.dailyPlan.bands.${row.plan.band}`)}</small>
                    <strong className="hava81-compare__score">
                      {row.plan.score}
                      <span>/100</span>
                    </strong>
                  </div>
                </header>
                <div className="hava81-compare__metrics">
                  <span>
                    <span className="hava81-compare__metric-label">{t('hava81.compare.temp')}</span>
                    <b>
                      {Math.round(convertTemperature(row.weather.temperature))}
                      {getTemperatureSymbol()}
                    </b>
                  </span>
                  <span>
                    <span className="hava81-compare__metric-label">{t('hava81.compare.rain')}</span>
                    <b>{formatPrecipitationSummary(
                      peakPop,
                      peakPrecipitationMm,
                      i18n.language,
                      t('hava81.compare.noRain')
                    )}</b>
                  </span>
                  <span>
                    <span className="hava81-compare__metric-label">{t('weather.wind')}</span>
                    <b>
                      {convertWindSpeed(row.weather.windSpeed)} {getWindSpeedSymbol()}
                    </b>
                  </span>
                  <span>
                    <span className="hava81-compare__metric-label">{t('hava81.compare.aqi')}</span>
                    <b>{row.airQuality ? `${row.airQuality.aqi}/5` : '—'}</b>
                  </span>
                  <span>
                    <span className="hava81-compare__metric-label">{t('hava81.compare.bestTime')}</span>
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
                      <span className="hava81-compare__metric-label">
                        {t(`hava81.activities.names.${row.activityPlan.activity}`)}
                      </span>
                      <b>
                        {row.activityPlan.score}/100 · {t(`hava81.dailyPlan.bands.${row.activityPlan.band}`)}
                      </b>
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
