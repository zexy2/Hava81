import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { REASON_I18N_KEY } from '../../domain/decision/reasonKeys';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../context';
import { useWindowWhy } from '../../hooks/useWindowWhy';
import { getDecisionSnapshot } from '../../domain/decision/decisionSnapshot';
import { trackProductEvent } from '../../analytics/productEvents';
import { getCurrentWeatherFreshness } from '../../utils/currentWeatherFreshness';
import { getForecastFreshness } from '../../utils/forecastFreshness';
import { getOptionalEvidenceFreshness } from '../../utils/optionalEvidenceFreshness';
import { formatPrecipitationAmount } from '../../utils/precipitation';
import { buildDecisionShare } from '../../utils/shareDecision';
import type { Hava81ScoreBand, Hava81ScoreFactor } from '../../domain/decision/types';
import type {
  AirQuality,
  AirQualityHourly,
  ForecastMeta,
  HourlyForecast,
  NormalizedWeatherData,
} from '../../types';
import { getDailyPlanAirQualityEvidence } from '../../domain/decision/airQualityEvidence';
import { isWithinActiveHours } from '../../domain/decision/eligibility';
import HeroSky from '../sky/HeroSky';
import { resolveSkyScene } from '../sky/skyScene';
import './DailyPlanPanel.css';

interface DailyPlanPanelProps {
  weather: NormalizedWeatherData;
  hourly: HourlyForecast[];
  airQuality?: AirQuality;
  airQualityHourly?: AirQualityHourly;
  forecastMeta: ForecastMeta | null;
}

type FreshDailyPlanPanelProps = Omit<DailyPlanPanelProps, 'forecastMeta'> & {
  freshnessRevision: number;
};

const bandKey: Record<Hava81ScoreBand, string> = {
  excellent: 'excellent',
  good: 'good',
  caution: 'caution',
  difficult: 'difficult',
};

const reasonKey = REASON_I18N_KEY;

const factorKey: Record<Hava81ScoreFactor, string> = {
  thermal: 'thermal',
  precipitation: 'precipitation',
  wind: 'wind',
  'air-quality': 'airQuality',
  uv: 'uv',
  visibility: 'visibility',
  'severe-weather': 'severeWeather',
  compound: 'compound',
};

function FreshDailyPlanPanel({
  weather,
  hourly,
  airQuality,
  airQualityHourly,
  freshnessRevision,
}: FreshDailyPlanPanelProps) {
  const { t, i18n } = useTranslation();
  const { convertTemperature, getTemperatureSymbol } = useSettings();
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'unavailable'>('idle');
  const [sharing, setSharing] = useState(false);
  const shareFeedbackTimerRef = useRef<number | null>(null);
  const shareInFlightRef = useRef(false);
  const trackedPlanRef = useRef<string | null>(null);
  const snapshot = useMemo(() => {
    void freshnessRevision;
    return getDecisionSnapshot({ weather, hourly, airQuality, airQualityHourly });
  }, [airQuality, airQualityHourly, freshnessRevision, hourly, weather]);
  const plan = snapshot.plan;
  // Same scene as the Today field, so both pages show the same sky for the same data.
  const heroScene = useMemo(() => {
    void freshnessRevision;
    return resolveSkyScene(weather, hourly, Date.now());
  }, [freshnessRevision, hourly, weather]);
  const hasUnknownPrecipitation = plan.slots.some(
    slot =>
      !Number.isFinite(slot.precipitationProbability) && !Number.isFinite(slot.precipitationMm)
  );
  const aqiEvidence = useMemo(() => {
    void freshnessRevision;
    return getDailyPlanAirQualityEvidence({
      forecastTimes: plan.slots.map(slot => slot.time),
      airQuality,
      airQualityHourly,
    });
  }, [airQuality, airQualityHourly, freshnessRevision, plan.slots]);
  const bestWindowRange = snapshot.bestWindow;
  const timezoneOffsetMs = weather.meta.timezoneOffsetSeconds * 1000;
  const temperatureSymbol = getTemperatureSymbol();
  const formatTemperature = (temperature: number) =>
    `${Math.round(convertTemperature(temperature))}${temperatureSymbol}`;

  const formatTime = (date?: Date) => {
    if (!date) return '—';
    return new Date(date.getTime() + timezoneOffsetMs).toLocaleTimeString(i18n.language, {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    });
  };
  const windowWhy = useWindowWhy(date => formatTime(date));
  const formatSlotPrecipitation = (probability: number | undefined, amount?: number) => {
    const hasProbability = Number.isFinite(probability);
    const hasAmount = Number.isFinite(amount);
    if (!hasProbability && !hasAmount) return t('hava81.dailyPlan.precipitationUnknown');

    const probabilityPercent = Number.isFinite(probability)
      ? Math.round((probability as number) * 100)
      : undefined;
    const parts: string[] = [];
    // Under 10% is "no rain expected" in plain language; a bare "%3" next to a dry hour read
    // as two different states.
    if (probabilityPercent !== undefined && probabilityPercent >= 10) {
      parts.push(
        i18n.language.startsWith('en') ? `${probabilityPercent}%` : `%${probabilityPercent}`
      );
    }
    const amountText = formatPrecipitationAmount(amount, i18n.language);
    if (amountText) parts.push(amountText);
    return parts.length ? parts.join(' · ') : t('hava81.dailyPlan.precipitationDry');
  };

  useEffect(() => {
    return () => {
      if (shareFeedbackTimerRef.current !== null) {
        window.clearTimeout(shareFeedbackTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const key = `${weather.cityName}:${weather.meta.fetchedAt instanceof Date ? weather.meta.fetchedAt.toISOString() : weather.meta.fetchedAt}`;
    if (trackedPlanRef.current === key) return;
    trackedPlanRef.current = key;
    trackProductEvent('daily_plan_viewed', {
      city: weather.cityName,
      score: plan.score,
      band: plan.band,
    });
  }, [plan.band, plan.score, weather.cityName, weather.meta.fetchedAt]);

  // An even day promotes no window (domain: assessEvenDay); the copy says so plainly and
  // names only the clearly weaker hours.
  const evenDay = plan.evenDay;
  const weakSlots = evenDay?.weakSlots ?? [];
  const weakTimes = new Set(weakSlots.map(slot => slot.time.getTime()));
  const nowOrLaterText = evenDay
    ? t('hava81.dailyPlan.nowOrLater.even')
    : plan.nowOrLater.kind === 'later'
      ? t('hava81.dailyPlan.nowOrLater.later', { time: formatTime(plan.nowOrLater.targetTime) })
      : plan.nowOrLater.kind === 'now'
        ? t('hava81.dailyPlan.nowOrLater.now')
        : t('hava81.dailyPlan.nowOrLater.similar');

  const bestWindowShareText = bestWindowRange
    ? `${formatTime(bestWindowRange.start.time)}–${formatTime(bestWindowRange.endTime)}`
    : undefined;

  // Keep the visible timeline aligned with the same 12-hour horizon used by the score.
  // A fixed six-point slice meant six hours with rich hourly data but eighteen hours with
  // the three-hour fallback, which made the explanation visually inconsistent.
  const timelineSlots = useMemo(() => {
    const first = plan.slots[0];
    if (!first) return [];
    const end = first.time.getTime() + 12 * 60 * 60 * 1000;
    return plan.slots.filter(slot => slot.time.getTime() < end);
  }, [plan.slots]);

  // A single poor hour sets the day's worst air level; when only a few hours carry it, say
  // which ones instead of implying the whole day is affected.
  const airAffected = timelineSlots.filter(slot =>
    slot.reasons.some(reason => reason === 'poor-air-quality' || reason === 'sensitive-air-quality')
  );
  // Consecutive hours read as one range: "07:00–10:00", not four separate times.
  const airAffectedTimes: string[] = [];
  if (airAffected.length && airAffected.length <= timelineSlots.length / 2) {
    let runStart = airAffected[0];
    let runEnd = airAffected[0];
    const flush = () =>
      airAffectedTimes.push(
        runStart === runEnd
          ? formatTime(runStart.time)
          : `${formatTime(runStart.time)}–${formatTime(runEnd.time)}`
      );
    for (const slot of airAffected.slice(1)) {
      if (slot.time.getTime() - runEnd.time.getTime() <= 60 * 60_000) runEnd = slot;
      else {
        flush();
        runStart = slot;
        runEnd = slot;
      }
    }
    flush();
  }
  // Night hours are scored but never recommended (07–23 rule). When one outscores the best
  // window, say so — otherwise "best 07:00" next to a 92 at 03:00 reads as a contradiction.
  const offsetSeconds = weather.meta.timezoneOffsetSeconds;
  const nightSlots = timelineSlots.filter(slot => !isWithinActiveHours(slot.time, offsetSeconds));
  const nightOutscoresBest = Boolean(
    !evenDay && bestWindowRange && nightSlots.some(slot => slot.score > bestWindowRange.start.score)
  );
  const nightRange = nightSlots.length
    ? nightSlots.length === 1
      ? formatTime(nightSlots[0].time)
      : `${formatTime(nightSlots[0].time)}–${formatTime(nightSlots[nightSlots.length - 1].time)}`
    : '';
  const localDateKey = (date: Date) =>
    new Date(date.getTime() + timezoneOffsetMs).toISOString().slice(0, 10);

  const showShareFeedback = (state: 'copied' | 'unavailable', durationMs: number) => {
    if (shareFeedbackTimerRef.current !== null) {
      window.clearTimeout(shareFeedbackTimerRef.current);
    }
    setShareState(state);
    shareFeedbackTimerRef.current = window.setTimeout(() => {
      setShareState('idle');
      shareFeedbackTimerRef.current = null;
    }, durationMs);
  };

  const shareDecision = async () => {
    if (shareInFlightRef.current) return;
    shareInFlightRef.current = true;
    setSharing(true);
    const payload = buildDecisionShare({
      cityName: weather.cityName,
      score: plan.score,
      band: plan.band,
      bestTime: bestWindowShareText,
      umbrella: plan.umbrella,
      recommendation: nowOrLaterText,
      language: i18n.language,
    });
    try {
      if (navigator.share) {
        try {
          await navigator.share({ title: payload.title, text: payload.text, url: payload.url });
          trackProductEvent('share_created', { city: weather.cityName, score: plan.score });
          return;
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') return;
          // A present but unusable native share target should still allow the clipboard fallback.
        }
      }

      if (!navigator.clipboard) {
        showShareFeedback('unavailable', 2400);
        return;
      }
      await navigator.clipboard.writeText(payload.clipboardText);
      showShareFeedback('copied', 1600);
      trackProductEvent('share_created', { city: weather.cityName, score: plan.score });
    } catch {
      // Sharing is optional; surface transport failure without affecting the daily plan.
      showShareFeedback('unavailable', 2400);
    } finally {
      shareInFlightRef.current = false;
      setSharing(false);
    }
  };

  return (
    <section className="daily-plan daily-plan--sky" aria-labelledby="daily-plan-title">
      <HeroSky scene={heroScene} />
      <header className="daily-plan__header">
        <div>
          <span className="atlas-kicker">{t('hava81.dailyPlan.eyebrow')}</span>
          <h2 id="daily-plan-title">{t('hava81.dailyPlan.title')}</h2>
        </div>
        <div className="daily-plan__header-actions">
          <button
            type="button"
            className="daily-plan__share"
            onClick={() => void shareDecision()}
            disabled={sharing}
            aria-busy={sharing}
          >
            {sharing
              ? t('common.loading')
              : shareState === 'copied'
                ? t('hava81.share.copied')
                : shareState === 'unavailable'
                  ? t('hava81.share.unavailable')
                  : t('hava81.share.action')}
          </button>
          <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {shareState === 'copied'
              ? t('hava81.share.copied')
              : shareState === 'unavailable'
                ? t('hava81.share.unavailable')
                : ''}
          </span>
          <div className={`daily-plan__score daily-plan__score--${plan.band}`}>
            <strong>{plan.score}</strong>
            <span>/100</span>
            <small>
              {t('hava81.dailyPlan.scoreScope12h')} ·{' '}
              {t(`hava81.dailyPlan.bands.${bandKey[plan.band]}`)}
            </small>
          </div>
        </div>
      </header>

      <div className="daily-plan__decision">
        <span>{t('hava81.dailyPlan.nowOrLater.label')}</span>
        {/* The answer first, in a few words; the engine's full sentence follows it. */}
        <strong className="daily-plan__headline">
          {evenDay
            ? t('hava81.dailyPlan.headline.even')
            : bestWindowRange
              ? t('hava81.dailyPlan.headline.best', {
                  start: formatTime(bestWindowRange.start.time),
                  end: formatTime(bestWindowRange.endTime),
                })
              : nowOrLaterText}
        </strong>
        {evenDay || bestWindowRange ? (
          <p className="daily-plan__sentence">{nowOrLaterText}</p>
        ) : null}
        {nightOutscoresBest ? (
          <p className="daily-plan__night-note">
            {t('hava81.dailyPlan.nightNote', { range: nightRange })}
          </p>
        ) : null}
        {evenDay ? (
          weakSlots.length ? (
            <small>
              {t('hava81.dailyPlan.weakHours', {
                times: weakSlots.map(slot => formatTime(slot.time)).join(', '),
              })}
            </small>
          ) : null
        ) : bestWindowRange ? (
          <small className="sr-only">
            {t('hava81.dailyPlan.bestRange', {
              start: formatTime(bestWindowRange.start.time),
              end: formatTime(bestWindowRange.endTime),
            })}
          </small>
        ) : null}
        {evenDay ? (
          windowWhy(plan?.explanation, 'weak') ? (
            <small className="daily-plan__why">{windowWhy(plan?.explanation, 'weak')}</small>
          ) : null
        ) : bestWindowRange && windowWhy(plan?.explanation) ? (
          <small className="daily-plan__why">{windowWhy(plan?.explanation)}</small>
        ) : null}
        {plan?.scoreRange ? (
          <small className="daily-plan__range">
            {t('hava81.dailyPlan.scoreRange', {
              low: plan.scoreRange.low,
              high: plan.scoreRange.high,
            })}
          </small>
        ) : null}
      </div>

      <details className="daily-plan__explain">
        <summary className="daily-plan__explain-head">
          <div>
            <span>{t('hava81.dailyPlan.explain.eyebrow')}</span>
            <strong>{t('hava81.dailyPlan.explain.title')}</strong>
          </div>
          <small data-confidence={plan.confidence}>
            {t(`hava81.dailyPlan.confidence.${plan.confidence}`)}
          </small>
        </summary>
        {plan.impacts.length ? (
          <ul className="daily-plan__impacts">
            {plan.impacts.slice(0, 3).map(impact => (
              <li key={impact.factor}>
                <span>{t(`hava81.dailyPlan.factors.${factorKey[impact.factor]}`)}</span>
                <strong>≈−{Math.max(1, Math.round(impact.penalty))}</strong>
              </li>
            ))}
          </ul>
        ) : (
          <p className="daily-plan__stable">{t('hava81.dailyPlan.explain.stable')}</p>
        )}
        <p>{t('hava81.dailyPlan.explain.method')}</p>
      </details>

      <div className="daily-plan__quick" role="group" aria-label={t('hava81.dailyPlan.quickLabel')}>
        <div>
          <span>{t('hava81.dailyPlan.quick.umbrella.label')}</span>
          <strong>{t(`hava81.dailyPlan.quick.umbrella.${plan.umbrella}`)}</strong>
        </div>
        <div>
          <span>{t('hava81.dailyPlan.quick.wind.label')}</span>
          <strong>{t(`hava81.dailyPlan.quick.wind.${plan.wind}`)}</strong>
        </div>
        <div>
          <span>{t('hava81.dailyPlan.quick.air.label')}</span>
          <strong>
            {t(`hava81.dailyPlan.quick.air.${plan.airQuality}`)}
            {airAffectedTimes.length
              ? ` · ${t('hava81.dailyPlan.quick.airAround', { times: airAffectedTimes.join(', ') })}`
              : ''}
          </strong>
        </div>
      </div>

      <div className="daily-plan__chart-head">
        <p className="daily-plan__slots-caption">
          {t('hava81.scoreScope.hourly')} · {t('hava81.scoreScope.scale')}
        </p>
        <ul className="daily-plan__legend" aria-hidden="true">
          <li className="is-good">{t('hava81.dailyPlan.legend.good')}</li>
          <li className="is-caution">{t('hava81.dailyPlan.legend.caution')}</li>
          <li className="is-difficult">{t('hava81.dailyPlan.legend.difficult')}</li>
        </ul>
      </div>
      <div
        className="daily-plan__slots"
        role="list"
        tabIndex={0}
        aria-label={t('hava81.dailyPlan.timelineLabel')}
      >
        {timelineSlots.map((slot, index) => {
          const previous = timelineSlots[index - 1];
          const isDayBoundary = Boolean(
            previous && localDateKey(previous.time) !== localDateKey(slot.time)
          );
          // Highlight the actual recommendation interval; this only affects presentation.
          const isWeak = weakTimes.has(slot.time.getTime());
          // On an even day there is no best window to mark: the headline says so.
          const isBestWindow = Boolean(
            !evenDay &&
            bestWindowRange &&
            slot.time.getTime() >= bestWindowRange.start.time.getTime() &&
            slot.time.getTime() <= bestWindowRange.end.time.getTime()
          );
          const previousIsBest = Boolean(
            !evenDay &&
            previous &&
            bestWindowRange &&
            previous.time.getTime() >= bestWindowRange.start.time.getTime() &&
            previous.time.getTime() <= bestWindowRange.end.time.getTime()
          );
          const isBestStart = isBestWindow && !previousIsBest;
          // Night hours are scored but never recommended (07–23 rule); show that, so a high
          // night score next to an earlier "best time" does not read as a contradiction.
          const isNight = !isWithinActiveHours(slot.time, weather.meta.timezoneOffsetSeconds);
          const isNightStart =
            isNight &&
            !(previous && !isWithinActiveHours(previous.time, weather.meta.timezoneOffsetSeconds));
          const primaryReason = slot.reasons[0];
          const primaryReasonText = primaryReason
            ? t(`hava81.dailyPlan.reasons.${reasonKey[primaryReason]}`)
            : undefined;
          const precipitationDetail = formatSlotPrecipitation(
            slot.precipitationProbability,
            slot.precipitationMm
          );
          const slotAriaLabel = [
            formatTime(slot.time),
            `${t('hava81.scoreScope.hourly')} ${slot.score}/100`,
            t(`hava81.dailyPlan.bands.${bandKey[slot.band]}`),
            formatTemperature(slot.temperature),
            precipitationDetail || undefined,
            primaryReasonText,
          ]
            .filter(Boolean)
            .join(', ');
          return (
            <div
              className={`daily-plan__slot daily-plan__slot--${slot.band}${isDayBoundary ? ' is-day-boundary' : ''}${isBestWindow ? ' is-best-window' : ''}${isWeak ? ' is-weak' : ''}${isNight ? ' is-night' : ''}`}
              style={
                {
                  '--hour-score': `${Math.min(100, Math.max(0, slot.score))}%`,
                  '--slot-index': index,
                  // Full 0–100 scale: a 48 is visibly half a bar, never a stub.
                  '--bar-scale': Math.min(1, Math.max(0.04, slot.score / 100)).toFixed(2),
                } as CSSProperties
              }
              key={slot.time.toISOString()}
              role="listitem"
              aria-label={slotAriaLabel}
            >
              {isBestStart ? (
                <span className="daily-plan__slot-flag">{t('hava81.dailyPlan.bestFlag')}</span>
              ) : isNightStart ? (
                <span className="daily-plan__slot-flag is-night">
                  {t('hava81.dailyPlan.nightFlag')}
                </span>
              ) : null}
              <time dateTime={slot.time.toISOString()}>
                {isDayBoundary ? (
                  <span className="daily-plan__slot-day">{t('hava81.dailyPlan.tomorrow')}</span>
                ) : null}
                <span>{formatTime(slot.time)}</span>
              </time>
              <strong>{slot.score}</strong>
              {primaryReasonText ? <em>{primaryReasonText}</em> : null}
              <small>
                {formatTemperature(slot.temperature)}
                {precipitationDetail ? ` · ${precipitationDetail}` : ''}
              </small>
            </div>
          );
        })}
      </div>

      <footer className="daily-plan__notes">
        <p className="daily-plan__safety">{t('hava81.dailyPlan.safetyNote')}</p>
        {hasUnknownPrecipitation ? (
          <p className="daily-plan__safety">{t('hava81.dailyPlan.precipitationEvidenceNote')}</p>
        ) : null}
        {aqiEvidence.usesHourlyAqi && airQualityHourly ? (
          <p className="daily-plan__safety">
            {t('hava81.dailyPlan.hourlyAqiSource', {
              source: airQualityHourly.meta.attribution ?? airQualityHourly.meta.provider,
            })}
          </p>
        ) : null}
        <details className="daily-plan__method">
          <summary>{t('hava81.dailyPlan.methodDetails')}</summary>
          <p>{t('hava81.dailyPlan.note')}</p>
        </details>
      </footer>
    </section>
  );
}

export function DailyPlanPanel({
  weather,
  hourly,
  airQuality,
  airQualityHourly,
  forecastMeta,
}: DailyPlanPanelProps) {
  const { t } = useTranslation();
  const [freshnessRevision, setFreshnessRevision] = useState(0);
  const freshness = getForecastFreshness(forecastMeta);
  const currentWeatherFreshness = getCurrentWeatherFreshness(weather.meta);
  // The plan can use fresh hourly forecast alone. Only the no-hourly fallback reads current
  // temperature/wind as its scored slot, so that path must also expire with the observation.
  const needsCurrentObservationFallback = hourly.length === 0;
  const currentAqiFreshness = getOptionalEvidenceFreshness(airQuality?.meta);
  const hourlyAqiFreshness = getOptionalEvidenceFreshness(airQualityHourly?.meta);

  useEffect(() => {
    const resyncFreshness = () => setFreshnessRevision(value => value + 1);
    const expiries = [
      freshness.expiresInMs,
      ...(needsCurrentObservationFallback ? [currentWeatherFreshness.expiresInMs] : []),
      currentAqiFreshness.expiresInMs,
      hourlyAqiFreshness.expiresInMs,
    ].filter((value): value is number => value !== null);
    const nextExpiryMs = expiries.length ? Math.min(...expiries) : null;
    const timeout =
      nextExpiryMs === null ? undefined : window.setTimeout(resyncFreshness, nextExpiryMs);
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') resyncFreshness();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      if (timeout !== undefined) window.clearTimeout(timeout);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [
    airQuality?.meta?.fetchedAt,
    airQuality?.meta?.freshForSeconds,
    currentWeatherFreshness.expiresInMs,
    needsCurrentObservationFallback,
    weather.meta.fetchedAt,
    weather.meta.freshForSeconds,
    weather.meta.observedAt,
    airQualityHourly?.meta?.fetchedAt,
    airQualityHourly?.meta?.freshForSeconds,
    currentAqiFreshness.expiresInMs,
    forecastMeta,
    freshness.expiresInMs,
    hourlyAqiFreshness.expiresInMs,
  ]);

  if (!freshness.fresh || (needsCurrentObservationFallback && !currentWeatherFreshness.fresh)) {
    return (
      <section className="daily-plan" aria-labelledby="daily-plan-title">
        <header className="daily-plan__header">
          <div>
            <span className="atlas-kicker">{t('hava81.dailyPlan.eyebrow')}</span>
            <h2 id="daily-plan-title">{t('hava81.dailyPlan.title')}</h2>
          </div>
        </header>
        <p className="daily-plan__note" role="status">
          {t(freshness.fresh ? 'hava81.dailyPlan.currentStale' : 'hava81.dailyPlan.forecastStale')}
        </p>
      </section>
    );
  }

  return (
    <FreshDailyPlanPanel
      weather={weather}
      hourly={hourly}
      airQuality={airQuality}
      airQualityHourly={airQualityHourly}
      freshnessRevision={freshnessRevision}
    />
  );
}

export default DailyPlanPanel;
