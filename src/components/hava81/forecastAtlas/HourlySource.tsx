import { useTranslation } from 'react-i18next';
import type { ForecastMeta } from '../../../types';
import { OPEN_METEO_LICENSE_URL } from './constants';

/** Hourly data provider, licence and attribution line. */
export function HourlySource({ meta }: { meta: ForecastMeta }) {
  const { t } = useTranslation();
  return (
    <p className="hava81-forecast-atlas__source">
      <span className="hava81-forecast-atlas__source-label">
        {t('hava81.forecastAtlas.hourlySource')}
      </span>{' '}
      {meta.sourceUrl ? <a href={meta.sourceUrl}>{meta.provider}</a> : <span>{meta.provider}</span>}
      {meta.provider === 'Open-Meteo' ? (
        <>
          {' · '}
          <a href={OPEN_METEO_LICENSE_URL}>CC BY 4.0</a>
          {' · '}
          {t('hava81.forecastAtlas.formattedByHava81')}
        </>
      ) : meta.attribution && meta.attribution !== meta.provider ? (
        <> · {meta.attribution}</>
      ) : null}
    </p>
  );
}
