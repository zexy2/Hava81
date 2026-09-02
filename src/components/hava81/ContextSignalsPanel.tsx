import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../../context';
import type { ContextSignals } from '../../types';
import { getOptionalEvidenceFreshness } from '../../utils/optionalEvidenceFreshness';
import './ContextSignalsPanel.css';

interface Props {
  signals: ContextSignals;
  timezoneOffsetSeconds: number;
}

type Level = 'low' | 'moderate' | 'high' | 'veryHigh' | 'extreme';
const normalizeMicroUnit = (unit?: string) => unit?.replace(/μ/g, 'µ') ?? '';
const uvLevel = (uv?: number): Level | undefined =>
  uv === undefined
    ? undefined
    : uv >= 11
      ? 'extreme'
      : uv >= 8
        ? 'veryHigh'
        : uv >= 6
          ? 'high'
          : uv >= 3
            ? 'moderate'
            : 'low';

export function ContextSignalsPanel({ signals, timezoneOffsetSeconds }: Props) {
  const { t, i18n } = useTranslation();
  const { settings, convertTemperature, getTemperatureSymbol } = useSettings();
  const fetchedAtMs = signals.fetchedAt.getTime();
  const freshness = getOptionalEvidenceFreshness(signals);
  const fetchedTime =
    freshness.status === 'unknown'
      ? null
      : new Date(fetchedAtMs + timezoneOffsetSeconds * 1000).toLocaleTimeString(i18n.language, {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'UTC',
        });
  const uv = uvLevel(signals.uvIndexMax);
  const pollen = useMemo(() => {
    const grass = signals.grassPollenMax;
    const olive = signals.olivePollenMax;
    if (grass === undefined && olive === undefined) return undefined;
    if (grass !== undefined && (olive === undefined || grass >= olive)) {
      return { value: grass, unit: signals.units.grassPollen };
    }
    if (olive !== undefined) return { value: olive, unit: signals.units.olivePollen };
    return undefined;
  }, [
    signals.grassPollenMax,
    signals.olivePollenMax,
    signals.units.grassPollen,
    signals.units.olivePollen,
  ]);
  const hasPollen = pollen !== undefined;
  const hasMarine = Boolean(
    signals.marine &&
    (signals.marine.waveHeight !== undefined || signals.marine.seaSurfaceTemperature !== undefined)
  );
  const seaSurfaceTemperature = signals.marine?.seaSurfaceTemperature;
  const formattedSeaSurfaceTemperature =
    seaSurfaceTemperature === undefined
      ? '—'
      : settings.temperatureUnit === 'imperial'
        ? `${Math.round(convertTemperature(seaSurfaceTemperature))}${getTemperatureSymbol()}`
        : `${seaSurfaceTemperature.toFixed(1)}${getTemperatureSymbol()}`;

  return (
    <section className="context-signals" aria-labelledby="context-signals-title">
      <header>
        <div>
          <span className="atlas-kicker">{t('hava81.context.eyebrow')}</span>
          <h2 id="context-signals-title">{t('hava81.context.title')}</h2>
        </div>
        <small className="context-signals__source">
          {signals.provider === 'Open-Meteo' ? (
            <>
              <a href="https://open-meteo.com/">Open-Meteo</a>
              {' · '}
              <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>
              {' · '}
              {t('hava81.context.sourceModified')}
            </>
          ) : (
            signals.attribution
          )}
          {fetchedTime ? ` · ${t('hava81.context.fetchedAt', { time: fetchedTime })}` : ''}
        </small>
      </header>
      <div className="context-signals__grid">
        {signals.uvIndexMax !== undefined ? (
          <article className={`context-signal context-signal--${uv}`}>
            <span>{t('hava81.context.uv')}</span>
            <strong>{signals.uvIndexMax.toFixed(1)}</strong>
            <small>{uv ? t(`hava81.context.uvLevels.${uv}`) : '—'}</small>
            <p>
              {uv && uv !== 'low' ? t('hava81.context.uvProtection') : t('hava81.context.uvNormal')}
            </p>
          </article>
        ) : null}
        {signals.dustMax !== undefined ? (
          <article className="context-signal">
            <span>{t('hava81.context.dust')}</span>
            <strong>
              {Math.round(signals.dustMax)} <small>{normalizeMicroUnit(signals.units.dust)}</small>
            </strong>
            <p>{t('hava81.context.next24h')}</p>
          </article>
        ) : null}
        {hasPollen ? (
          <article className="context-signal">
            <span>{t('hava81.context.pollen')}</span>
            <strong>
              {pollen?.value.toFixed(1)} <small>{normalizeMicroUnit(pollen?.unit)}</small>
            </strong>
            <p>{t('hava81.context.pollenNote')}</p>
          </article>
        ) : null}
        {hasMarine ? (
          <article className="context-signal context-signal--marine">
            <span>{t('hava81.context.sea')}</span>
            <strong>{formattedSeaSurfaceTemperature}</strong>
            <p>
              {signals.marine?.waveHeight !== undefined
                ? t('hava81.context.waveDetails', {
                    height: signals.marine.waveHeight.toFixed(2),
                    unit: signals.units.waveHeight ?? '',
                    period: signals.marine.wavePeriod?.toFixed(1) ?? '—',
                    periodUnit: signals.units.wavePeriod ?? '',
                    direction:
                      signals.marine.waveDirection !== undefined
                        ? Math.round(signals.marine.waveDirection)
                        : '—',
                    directionUnit: signals.units.waveDirection ?? '',
                  })
                : t('hava81.context.waveUnavailable')}
            </p>
          </article>
        ) : null}
      </div>
      <p className="context-signals__note">{t('hava81.context.note')}</p>
    </section>
  );
}

export default ContextSignalsPanel;
