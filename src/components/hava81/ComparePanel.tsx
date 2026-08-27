import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { weatherService } from '../../api/weatherService';
import { useSettings } from '../../context';
import type { FavoriteCity, NormalizedWeatherData } from '../../types';
import './ComparePanel.css';

interface ComparePanelProps {
  cities: FavoriteCity[];
  language: 'tr' | 'en';
}

export function ComparePanel({ cities, language }: ComparePanelProps) {
  const { t } = useTranslation();
  const { convertTemperature, convertWindSpeed, getTemperatureSymbol, getWindSpeedSymbol } =
    useSettings();
  const selected = useMemo(() => cities.slice(0, 3), [cities]);
  const [rows, setRows] = useState<NormalizedWeatherData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    if (selected.length < 2) {
      setRows([]);
      return () => {
        active = false;
      };
    }
    setLoading(true);
    Promise.allSettled(
      selected.map(city => weatherService.getCurrentWeather({ city: city.name, lang: language }))
    )
      .then(results => {
        if (!active) return;
        setRows(results.flatMap(result => (result.status === 'fulfilled' ? [result.value] : [])));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [language, selected]);

  return (
    <section className="hava81-compare" aria-labelledby="hava81-compare-title">
      <header>
        <span className="atlas-kicker">{t('weather.favoriteCities')}</span>
        <h2 id="hava81-compare-title">
          {t('hava81.compare.title', { defaultValue: 'Şehir karşılaştırması' })}
        </h2>
      </header>
      {selected.length < 2 ? (
        <p>
          {t('hava81.compare.needTwo', {
            defaultValue: 'Karşılaştırmak için en az iki şehri favorilere ekle.',
          })}
        </p>
      ) : loading && rows.length === 0 ? (
        <p role="status">{t('common.loading')}</p>
      ) : (
        <div
          className="hava81-compare__table"
          role="table"
          aria-label={t('hava81.compare.title', { defaultValue: 'Şehir karşılaştırması' })}
        >
          {rows.map(row => (
            <article className="hava81-compare__city" role="row" key={row.cityName}>
              <h3>{row.cityName}</h3>
              <strong>
                {Math.round(convertTemperature(row.temperature))}
                {getTemperatureSymbol()}
              </strong>
              <span>
                {t('weather.feelsLike')}: {Math.round(convertTemperature(row.feelsLike))}
                {getTemperatureSymbol()}
              </span>
              <span>
                {t('weather.humidity')}: {row.humidity}%
              </span>
              <span>
                {t('weather.wind')}: {convertWindSpeed(row.windSpeed)} {getWindSpeedSymbol()}
              </span>
              <small>{row.description}</small>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default ComparePanel;
