import { formatCityTime, formatWithUnit } from '../../utils/format';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { weatherService } from '../../api/weatherService';
import { useSettings } from '../../context';
import { buildActivityPlan } from '../../domain/activity/buildActivityPlan';
import { buildDailyPlan } from '../../domain/decision/buildDailyPlan';
import { REASON_I18N_KEY } from '../../domain/decision/reasonKeys';
import { buildDayOutlook, outlookDayLabelKey } from '../../domain/plan/dayOutlook';
import { toleranceOf, useDecisionProfile } from '../../hooks/useDecisionProfile';
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
import {
  formatPrecipitationSummary,
  pickMostSignificantPrecipitation,
} from '../../utils/precipitation';
import './ComparePanel.css';

interface ComparePanelProps {
  cities: FavoriteCity[];
  language: 'tr' | 'en';
  onExplore?: () => void;
}

interface CompareRow {
  weather: NormalizedWeatherData;
  airQuality?: AirQuality;
  hourly: HourlyForecast[];
  meta: ForecastMeta;
}

export function ComparePanel({ cities, language, onExplore }: ComparePanelProps) {
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
  const [compareDay, setCompareDay] = useState<string | null>(null);
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
    // Faz 3.2: görünümden çıkınca (unmount) ya da şehir listesi değişince uçuştaki
    // karşılaştırma isteklerini iptal et.
    const controller = new AbortController();
    const { signal } = controller;
    Promise.allSettled(
      selected.map(async city => {
        const weather = await weatherService.getCurrentWeather(
          { city: city.name, lang: language },
          { signal }
        );
        const [hourlyResult, airResult] = await Promise.allSettled([
          weatherService.getHourlyForecast(
            weather.coordinates.lat,
            weather.coordinates.lon,
            language,
            { signal }
          ),
          weatherService.getAirQuality(weather.coordinates.lat, weather.coordinates.lon, language, {
            signal,
          }),
        ]);
        const airQuality = airResult.status === 'fulfilled' ? airResult.value : undefined;
        let hourlySource =
          hourlyResult.status === 'fulfilled' && hourlyResult.value.hourly.length
            ? hourlyResult.value
            : undefined;
        if (!hourlySource) {
          const fallbackForecast = await weatherService.getForecast(
            weather.coordinates.lat,
            weather.coordinates.lon,
            language,
            { signal }
          );
          hourlySource = fallbackForecast.hourly.length ? fallbackForecast : undefined;
        }
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
      controller.abort();
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
    const plan = buildDailyPlan({
      weather: row.weather,
      hourly: row.hourly,
      airQuality: freshAirQuality,
      now: new Date(),
    });
    const activityPlan = primaryActivity
      ? buildActivityPlan({
          activity: primaryActivity,
          weather: row.weather,
          hourly: row.hourly,
          airQuality: freshAirQuality,
          sensitivity: profile.temperatureSensitivity,
          preferredStart: profile.activityStart,
          preferredEnd: profile.activityEnd,
          now: new Date(),
          tolerance: toleranceOf(profile),
        })
      : undefined;

    const outlook = buildDayOutlook({
      weather: row.weather,
      hourly: row.hourly,
      airQuality: freshAirQuality,
      now: new Date(),
    });
    const dayFor = (dateKey: string) => outlook.find(day => day.dateKey === dateKey);
    return [{ ...row, airQuality: freshAirQuality, plan, activityPlan, outlook, dayFor }];
  });
  // Days every compared city has a summary for (tomorrow onwards); "next 12 h" is the default.
  const dayOptions = (freshRows[0]?.outlook ?? []).filter(
    day => day.dayOffset >= 1 && freshRows.every(row => row.dayFor(day.dateKey))
  );
  const selectedDay = dayOptions.some(day => day.dateKey === compareDay) ? compareDay : null;
  const headlineOf = (row: (typeof freshRows)[number]) =>
    (selectedDay ? row.dayFor(selectedDay) : undefined) ?? row.plan;
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
      return states.flatMap(state =>
        state.fresh && state.expiresInMs !== null ? [state.expiresInMs] : []
      );
    });
    const nextExpiry = expiryDelays.length ? Math.min(...expiryDelays) : null;
    const resyncFreshness = () => setFreshnessRevision(value => value + 1);
    const timeout =
      nextExpiry === null ? undefined : window.setTimeout(resyncFreshness, nextExpiry);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') resyncFreshness();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      if (timeout !== undefined) window.clearTimeout(timeout);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [freshnessRevision, rows]);

  // freshRows is rebuilt every render, so this is a plain derivation (three cities at most).
  const topScore = freshRows.length ? Math.max(...freshRows.map(row => headlineOf(row).score)) : 0;
  const leaders = freshRows.filter(row => headlineOf(row).score === topScore);
  const winner = leaders.length === 1 ? leaders[0] : undefined;
  const selectedDayOption = dayOptions.find(day => day.dateKey === selectedDay);
  const selectedDayLabel = selectedDayOption
    ? t(outlookDayLabelKey(selectedDayOption, freshRows[0].weather.meta.timezoneOffsetSeconds))
    : undefined;
  const isLeader = (row: (typeof freshRows)[number]) => leaders.includes(row);
  const offsetTime = (row: CompareRow, date?: Date) => {
    if (!date) return '—';
    return formatCityTime(date, row.weather.meta.timezoneOffsetSeconds, i18n.language);
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
                <span>
                  {selectedDayLabel
                    ? t('hava81.compare.dayWinnerLabel', { day: selectedDayLabel })
                    : t('hava81.compare.winnerLabel')}
                </span>
                <strong>
                  {t('hava81.compare.winner', {
                    city: winner.weather.cityName,
                    score: headlineOf(winner).score,
                    band: t(`hava81.dailyPlan.bands.${headlineOf(winner).band}`),
                  })}
                </strong>
              </>
            ) : (
              <>
                <span>{t('hava81.compare.tieLabel')}</span>
                <strong>
                  {t('hava81.compare.tie', {
                    cities: leaders.map(row => row.weather.cityName).join(', '),
                    score: leaders[0] ? headlineOf(leaders[0]).score : undefined,
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
        <div className="hava81-compare__empty">
          <div className="hava81-compare__empty-illustration" aria-hidden="true">
            <span className="hava81-compare__empty-bar" />
            <span className="hava81-compare__empty-bar" />
            <span className="hava81-compare__empty-bar" />
          </div>
          <h3>{t('hava81.compare.emptyTitle')}</h3>
          <p>{t('hava81.compare.needTwo')}</p>
          <p className="hava81-compare__empty-tip">{t('hava81.compare.emptyTip')}</p>
          {onExplore ? (
            <button type="button" onClick={onExplore} className="hava81-compare__empty-action">
              {t('hava81.compare.emptyAction')} <span aria-hidden="true">→</span>
            </button>
          ) : null}
        </div>
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
              {t(
                staleCount > 0 ? 'hava81.compare.partialStale' : 'hava81.compare.partialUnavailable'
              )}
            </p>
          ) : null}
          {dayOptions.length ? (
            <div
              className="hava81-compare__days"
              role="group"
              aria-label={t('hava81.compare.dayLabel')}
            >
              <button type="button" aria-pressed={!selectedDay} onClick={() => setCompareDay(null)}>
                {t('hava81.compare.next12')}
              </button>
              {dayOptions.map(day => (
                <button
                  key={day.dateKey}
                  type="button"
                  aria-pressed={selectedDay === day.dateKey}
                  onClick={() => setCompareDay(day.dateKey)}
                >
                  {t(outlookDayLabelKey(day, freshRows[0].weather.meta.timezoneOffsetSeconds))}
                </button>
              ))}
            </div>
          ) : null}
          <div className="hava81-compare__table" role="list" aria-label={t('hava81.compare.title')}>
            {freshRows.map(row => {
              const dayView = selectedDay ? row.dayFor(selectedDay) : undefined;
              const headline = dayView ?? row.plan;
              const nearTerm = row.hourly.slice(0, 6);
              const precipitationPeak = pickMostSignificantPrecipitation(nearTerm);
              const precipitationSummary = precipitationPeak
                ? formatPrecipitationSummary(
                    precipitationPeak.pop ?? Number.NaN,
                    precipitationPeak.precipitationMm,
                    i18n.language,
                    t('hava81.compare.noRain')
                  )
                : t('hava81.compare.precipitationUnknown');
              return (
                <article
                  className={`hava81-compare__city${isLeader(row) ? ' is-winner' : ''}`}
                  role="listitem"
                  key={row.weather.cityName}
                >
                  <header>
                    <h3>{row.weather.cityName}</h3>
                    <div className="hava81-compare__score-wrap">
                      <small>{t(`hava81.dailyPlan.bands.${headline.band}`)}</small>
                      <strong className="hava81-compare__score">
                        {headline.score}
                        <span>/100</span>
                      </strong>
                    </div>
                  </header>
                  <div className="hava81-compare__metrics">
                    {dayView ? (
                      <span>
                        <span className="hava81-compare__metric-label">
                          {t('hava81.compare.dayRisk')}
                        </span>
                        <b>
                          {dayView.reasons[0]
                            ? t(`hava81.dailyPlan.reasons.${REASON_I18N_KEY[dayView.reasons[0]]}`)
                            : t('hava81.dailyPlan.reasons.clear')}
                        </b>
                      </span>
                    ) : (
                      <>
                        <span>
                          <span className="hava81-compare__metric-label">
                            {t('hava81.compare.temp')}
                          </span>
                          <b>
                            {Math.round(convertTemperature(row.weather.temperature))}
                            {getTemperatureSymbol()}
                          </b>
                        </span>
                        <span>
                          <span className="hava81-compare__metric-label">
                            {t('hava81.compare.rain')}
                          </span>
                          <b>{precipitationSummary}</b>
                        </span>
                        <span>
                          <span className="hava81-compare__metric-label">{t('weather.wind')}</span>
                          <b>
                            {formatWithUnit(
                              convertWindSpeed(row.weather.windSpeed),
                              getWindSpeedSymbol(),
                              i18n.language
                            )}
                          </b>
                        </span>
                        <span>
                          <span className="hava81-compare__metric-label">
                            {t('hava81.compare.aqi')}
                          </span>
                          <b>{row.airQuality ? `${row.airQuality.aqi}/5` : '—'}</b>
                        </span>
                      </>
                    )}
                    <span>
                      <span className="hava81-compare__metric-label">
                        {t('hava81.compare.bestTime')}
                      </span>
                      <b>
                        {headline.bestWindowRange ? (
                          <>
                            <time dateTime={headline.bestWindowRange.start.time.toISOString()}>
                              {offsetTime(row, headline.bestWindowRange.start.time)}
                            </time>
                            {'–'}
                            <time dateTime={headline.bestWindowRange.endTime.toISOString()}>
                              {offsetTime(row, headline.bestWindowRange.endTime)}
                            </time>
                          </>
                        ) : (
                          '—'
                        )}
                      </b>
                    </span>
                    {row.activityPlan && !dayView ? (
                      <span>
                        <span className="hava81-compare__metric-label">
                          {t(`hava81.activities.names.${row.activityPlan.activity}`)} (
                          {t('hava81.scoreScope.activity').toLocaleLowerCase(language)})
                        </span>
                        <b>
                          {row.activityPlan.score}/100 ·{' '}
                          {t(`hava81.dailyPlan.bands.${row.activityPlan.band}`)}
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
