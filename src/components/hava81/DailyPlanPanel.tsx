import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../context';
import { buildDailyPlan } from '../../domain/decision/buildDailyPlan';
import { trackProductEvent } from '../../analytics/productEvents';
import { formatPrecipitationAmount } from '../../utils/precipitation';
import { buildDecisionShare } from '../../utils/shareDecision';
import type {
  DecisionReasonCode,
  Hava81ScoreBand,
  Hava81ScoreFactor,
} from '../../domain/decision/types';
import type { AirQuality, HourlyForecast, NormalizedWeatherData } from '../../types';
import './DailyPlanPanel.css';

interface DailyPlanPanelProps {
  weather: NormalizedWeatherData;
  hourly: HourlyForecast[];
  airQuality?: AirQuality;
}

const bandKey: Record<Hava81ScoreBand, string> = {
  excellent: 'excellent',
  good: 'good',
  caution: 'caution',
  difficult: 'difficult',
};

const bandRange: Record<Hava81ScoreBand, string> = {
  excellent: '97–100',
  good: '75–96',
  caution: '55–74',
  difficult: '0–54',
};

const reasonKey: Record<DecisionReasonCode, string> = {
  'extreme-heat': 'extremeHeat',
  heat: 'heat',
  freezing: 'freezing',
  cold: 'cold',
  'heavy-rain': 'heavyRain',
  'rain-risk': 'rainRisk',
  'strong-wind': 'strongWind',
  windy: 'windy',
  'gusty-wind': 'gustyWind',
  'poor-air-quality': 'poorAirQuality',
  'sensitive-air-quality': 'sensitiveAirQuality',
  'high-uv': 'highUv',
  'low-visibility': 'lowVisibility',
  'severe-weather': 'severeWeather',
};

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

export function DailyPlanPanel({ weather, hourly, airQuality }: DailyPlanPanelProps) {
  const { t, i18n } = useTranslation();
  const { convertTemperature, getTemperatureSymbol } = useSettings();
  const [shareState, setShareState] = useState<'idle' | 'copied' | 'unavailable'>('idle');
  const shareFeedbackTimerRef = useRef<number | null>(null);
  const trackedPlanRef = useRef<string | null>(null);
  const plan = useMemo(
    () => buildDailyPlan({ weather, hourly, airQuality }),
    [airQuality, hourly, weather]
  );
  const timezoneOffsetMs = (weather.meta.timezoneOffsetSeconds ?? 0) * 1000;
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
  const formatSlotPrecipitation = (probability: number, amount?: number) => {
    const probabilityPercent = Math.round(probability * 100);
    const parts: string[] = [];
    if (probabilityPercent > 0) {
      parts.push(i18n.language.startsWith('en') ? `${probabilityPercent}%` : `%${probabilityPercent}`);
    }
    const amountText = formatPrecipitationAmount(amount, i18n.language);
    if (amountText) parts.push(amountText);
    return parts.join(' · ');
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

  const nowOrLaterText =
    plan.nowOrLater.kind === 'later'
      ? t('hava81.dailyPlan.nowOrLater.later', { time: formatTime(plan.nowOrLater.targetTime) })
      : plan.nowOrLater.kind === 'now'
        ? t('hava81.dailyPlan.nowOrLater.now')
        : t('hava81.dailyPlan.nowOrLater.similar');

  const bestWindowShareText = plan.bestWindowRange
    ? plan.bestWindowRange.start.time.getTime() === plan.bestWindowRange.end.time.getTime()
      ? formatTime(plan.bestWindowRange.peak.time)
      : `${formatTime(plan.bestWindowRange.start.time)}–${formatTime(plan.bestWindowRange.end.time)}`
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
    const payload = buildDecisionShare({
      cityName: weather.cityName,
      score: plan.score,
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
    }
  };

  return (
    <section className="daily-plan" aria-labelledby="daily-plan-title">
      <header className="daily-plan__header">
        <div>
          <span className="atlas-kicker">{t('hava81.dailyPlan.eyebrow')}</span>
          <h2 id="daily-plan-title">{t('hava81.dailyPlan.title')}</h2>
        </div>
        <div className="daily-plan__header-actions">
          <button type="button" className="daily-plan__share" onClick={() => void shareDecision()}>
            {shareState === 'copied'
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
              {t(`hava81.dailyPlan.bands.${bandKey[plan.band]}`)} · {bandRange[plan.band]}
            </small>
          </div>
        </div>
      </header>

      <div className="daily-plan__decision">
        <span>{t('hava81.dailyPlan.nowOrLater.label')}</span>
        <strong>{nowOrLaterText}</strong>
        {plan.bestWindowRange ? (
          <small>
            {plan.bestWindowRange.start.time.getTime() === plan.bestWindowRange.end.time.getTime()
              ? t('hava81.dailyPlan.bestWindow', { time: formatTime(plan.bestWindowRange.peak.time) })
              : t('hava81.dailyPlan.bestRange', {
                  start: formatTime(plan.bestWindowRange.start.time),
                  end: formatTime(plan.bestWindowRange.end.time),
                })}
          </small>
        ) : null}
      </div>

      <div
        className="daily-plan__explain"
        role="group"
        aria-label={t('hava81.dailyPlan.explain.label')}
      >
        <div className="daily-plan__explain-head">
          <div>
            <span>{t('hava81.dailyPlan.explain.eyebrow')}</span>
            <strong>{t('hava81.dailyPlan.explain.title')}</strong>
          </div>
          <small data-confidence={plan.confidence}>
            {t(`hava81.dailyPlan.confidence.${plan.confidence}`)}
          </small>
        </div>
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
      </div>

      <div
        className="daily-plan__quick"
        role="group"
        aria-label={t('hava81.dailyPlan.quickLabel')}
      >
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
          <strong>{t(`hava81.dailyPlan.quick.air.${plan.airQuality}`)}</strong>
        </div>
      </div>

      <div
        className="daily-plan__slots"
        role="list"
        aria-label={t('hava81.dailyPlan.timelineLabel')}
      >
        {timelineSlots.map((slot, index) => {
          const previous = timelineSlots[index - 1];
          const isDayBoundary = Boolean(
            previous && localDateKey(previous.time) !== localDateKey(slot.time)
          );
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
            `${slot.score}/100`,
            t(`hava81.dailyPlan.bands.${bandKey[slot.band]}`),
            formatTemperature(slot.temperature),
            precipitationDetail || undefined,
            primaryReasonText,
          ]
            .filter(Boolean)
            .join(', ');
          return (
            <div
              className={`daily-plan__slot daily-plan__slot--${slot.band}${isDayBoundary ? ' is-day-boundary' : ''}`}
              key={slot.time.toISOString()}
              role="listitem"
              aria-label={slotAriaLabel}
            >
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

      <p className="daily-plan__note">{t('hava81.dailyPlan.note')}</p>
    </section>
  );
}

export default DailyPlanPanel;
