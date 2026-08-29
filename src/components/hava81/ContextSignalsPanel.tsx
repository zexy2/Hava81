import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ContextSignals } from '../../types';
import './ContextSignalsPanel.css';

interface Props {
  signals: ContextSignals;
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

export function ContextSignalsPanel({ signals }: Props) {
  const { t, i18n } = useTranslation();
  const fetchedTime = Number.isNaN(signals.fetchedAt.getTime())
    ? null
    : signals.fetchedAt.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' });
  const uv = uvLevel(signals.uvIndexMax);
  const pollen = useMemo(
    () => Math.max(signals.grassPollenMax ?? 0, signals.olivePollenMax ?? 0),
    [signals.grassPollenMax, signals.olivePollenMax]
  );
  const hasPollen = signals.grassPollenMax !== undefined || signals.olivePollenMax !== undefined;
  const hasMarine = Boolean(
    signals.marine &&
    (signals.marine.waveHeight !== undefined || signals.marine.seaSurfaceTemperature !== undefined)
  );

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
              {uv && uv !== 'low'
                ? t('hava81.context.uvProtection')
                : t('hava81.context.uvNormal')}
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
              {pollen.toFixed(1)}{' '}
              <small>
                {normalizeMicroUnit(signals.units.grassPollen ?? signals.units.olivePollen)}
              </small>
            </strong>
            <p>{t('hava81.context.pollenNote')}</p>
          </article>
        ) : null}
        {hasMarine ? (
          <article className="context-signal context-signal--marine">
            <span>{t('hava81.context.sea')}</span>
            <strong>
              {signals.marine?.seaSurfaceTemperature !== undefined
                ? `${signals.marine.seaSurfaceTemperature.toFixed(1)}${signals.units.seaSurfaceTemperature ?? '°C'}`
                : '—'}
            </strong>
            <p>
              {signals.marine?.waveHeight !== undefined
                ? t('hava81.context.waveDetails', {
                    height: signals.marine.waveHeight.toFixed(2),
                    unit: signals.units.waveHeight ?? 'm',
                    period: signals.marine.wavePeriod?.toFixed(1) ?? '—',
                    periodUnit: signals.units.wavePeriod ?? 's',
                    direction:
                      signals.marine.waveDirection !== undefined
                        ? Math.round(signals.marine.waveDirection)
                        : '—',
                    directionUnit: signals.units.waveDirection ?? '°',
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
