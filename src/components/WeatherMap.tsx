import React, { useEffect, useId, useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useTranslation } from 'react-i18next';
import { TURKISH_CITIES, type TurkishCity } from '../constants/cities';
import { useSettings } from '../context/SettingsContext';
import type { NormalizedWeatherData } from '../types/weather.types';
import { getCurrentWeatherFreshness } from '../utils/currentWeatherFreshness';
import {
  MAX_FORECAST_FUTURE_SKEW_MS,
  MAX_PROVINCE_OBSERVATION_AGE_MS,
  weatherService,
  type ProvinceTemperature,
  type ProvinceTemperatures,
} from '../api/weatherService';
import './WeatherMap.css';

interface WeatherMapProps {
  weather: NormalizedWeatherData | null;
  onCitySelect: (city: TurkishCity) => void;
  className?: string;
}

const DEFAULT_CENTER: [number, number] = [39, 35];
const FEATURED_CITY_NAMES = new Set([
  'İstanbul',
  'Ankara',
  'İzmir',
  'Antalya',
  'Bursa',
  'Adana',
  'Trabzon',
  'Erzurum',
  'Diyarbakır',
  'Konya',
]);

/** Faz 2.5: the atlas reveals all 81 provinces once the user zooms in. */
const ATLAS_ZOOM = 7;
const PROVINCE_REFRESH_INTERVAL_MS = 30 * 60_000;
const PROVINCE_EXPIRY_CUSHION_MS = 100;

const isFreshProvinceObservation = (province: ProvinceTemperature, now = Date.now()): boolean => {
  const observedAtMs = province.observedAt instanceof Date ? province.observedAt.getTime() : NaN;
  if (!Number.isFinite(observedAtMs)) return false;
  const ageMs = now - observedAtMs;
  return ageMs <= MAX_PROVINCE_OBSERVATION_AGE_MS && ageMs >= -MAX_FORECAST_FUTURE_SKEW_MS;
};

const ZoomWatcher: React.FC<{ onZoom: (zoom: number) => void }> = ({ onZoom }) => {
  useMapEvents({ zoomend: event => onZoom(event.target.getZoom()) });
  return null;
};

const MapController: React.FC<{ center: [number, number] }> = ({ center }) => {
  const map = useMap();

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const targetZoom = map.getContainer().clientWidth < 768 ? 7 : 8;
    if (reduceMotion) {
      map.setView(center, targetZoom);
      return;
    }
    map.flyTo(center, targetZoom, { duration: 0.4 });
  }, [center, map]);

  return null;
};

const getTemperatureMarkerColors = (celsius: number) => {
  if (celsius >= 30) return { background: '#D6543D', foreground: '#FFFFFF' };
  if (celsius >= 20) return { background: '#E7A531', foreground: '#142524' };
  if (celsius >= 10) return { background: '#A8C9C5', foreground: '#142524' };
  if (celsius >= 0) return { background: '#146B73', foreground: '#FFFFFF' };
  return { background: '#0E2C32', foreground: '#FFFFFF' };
};

const createTemperatureIcon = (celsius: number, displayTemperature: number): L.DivIcon => {
  const colors = getTemperatureMarkerColors(celsius);
  return L.divIcon({
    className: 'weather-map__marker',
    html: `<div class="weather-map__marker-content" style="--marker-bg:${colors.background};--marker-fg:${colors.foreground}"><span>${Math.round(displayTemperature)}°</span></div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
};

const createUnavailableObservationIcon = (): L.DivIcon =>
  L.divIcon({
    className: 'weather-map__plate-marker',
    html: '<span>—</span>',
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });

const createPlateIcon = (
  plateCode: number,
  liveTemperature?: { celsius: number; display: number }
): L.DivIcon => {
  const plate = `<span><i aria-hidden="true">TR</i>${String(plateCode).padStart(2, '0')}</span>`;
  if (!liveTemperature) {
    return L.divIcon({
      className: 'weather-map__plate-marker',
      html: plate,
      iconSize: [60, 44],
      iconAnchor: [30, 22],
    });
  }
  // Faz 3.2 / 2.5: canlı il sıcaklığı plakanın yanında ayrı, yuvarlak bir rozet; plaka
  // numarasıyla karışmasın diye kendi renk ölçeğini (lejant) kullanır.
  const colors = getTemperatureMarkerColors(liveTemperature.celsius);
  return L.divIcon({
    className: 'weather-map__plate-marker weather-map__plate-marker--live',
    html: `${plate}<b class="weather-map__plate-temp" style="--marker-bg:${colors.background};--marker-fg:${colors.foreground}">${Math.round(liveTemperature.display)}°</b>`,
    iconSize: [92, 44],
    iconAnchor: [30, 22],
  });
};

/**
 * 81 ilin canlı sıcaklığı yalnız atlas yakınlaştırmasında (tüm iller görünürken) ve
 * ilk kez gerektiğinde istenir. API'de uç nokta yoksa/başarısızsa `null` kalır ve
 * harita bugünkü gibi yalnız plakaları gösterir. Unmount'ta istek iptal edilir.
 */
const useProvinceTemperatures = (enabled: boolean, language: string) => {
  const [data, setData] = useState<ProvinceTemperatures | null>(null);
  const [refreshRevision, setRefreshRevision] = useState(0);

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    Promise.resolve()
      .then(() => weatherService.getProvinceTemperatures(language, { signal: controller.signal }))
      .then(result => {
        if (!controller.signal.aborted) setData(result ?? null);
      })
      .catch(() => {
        // İsteğe bağlı katman: hata (ya da iptal) haritayı etkilemez.
      });
    return () => controller.abort();
  }, [enabled, language, refreshRevision]);

  useEffect(() => {
    if (!enabled) return undefined;
    const timeout = window.setTimeout(
      () => setRefreshRevision(revision => revision + 1),
      PROVINCE_REFRESH_INTERVAL_MS
    );
    return () => window.clearTimeout(timeout);
  }, [enabled, language, refreshRevision]);

  useEffect(() => {
    if (!enabled) return undefined;
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') {
        setRefreshRevision(revision => revision + 1);
      }
    };
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => document.removeEventListener('visibilitychange', refreshWhenVisible);
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !data) return undefined;
    const now = Date.now();
    const expiries = Array.from(data.byPlate.values())
      .map(province => {
        const observedAtMs = province.observedAt instanceof Date ? province.observedAt.getTime() : NaN;
        if (!Number.isFinite(observedAtMs)) return null;
        const remainingMs = observedAtMs + MAX_PROVINCE_OBSERVATION_AGE_MS - now;
        return remainingMs > 0 ? remainingMs + PROVINCE_EXPIRY_CUSHION_MS : null;
      })
      .filter((value): value is number => value !== null);
    if (!expiries.length) return undefined;
    const timeout = window.setTimeout(
      () => setRefreshRevision(revision => revision + 1),
      Math.min(...expiries)
    );
    return () => window.clearTimeout(timeout);
  }, [data, enabled, refreshRevision]);

  return data;
};

const labelMarker = (marker: L.Marker | null, accessibleName: string) => {
  marker?.getElement()?.setAttribute('aria-label', accessibleName);
};

export const WeatherMap: React.FC<WeatherMapProps> = ({
  weather,
  onCitySelect,
  className = '',
}) => {
  const { t } = useTranslation();
  const { settings, convertTemperature, getTemperatureSymbol } = useSettings();
  const mapTitleId = useId();
  const [fallbackTiles, setFallbackTiles] = useState(false);
  // Leaflet can display markers before the raster map loads. Keep an honest
  // loading state instead of showing an unexplained blank grey map.
  const [tilesLoading, setTilesLoading] = useState(true);
  const [tilesFailed, setTilesFailed] = useState(false);
  const [tileAttempt, setTileAttempt] = useState(0);

  const retryTiles = () => {
    setTilesFailed(false);
    setTilesLoading(true);
    setFallbackTiles(false);
    // A different key forces a fresh TileLayer even if it was on the primary.
    setTileAttempt(previous => previous + 1);
  };
  const [, setFreshnessRevision] = useState(0);
  const currentFreshness = getCurrentWeatherFreshness(weather?.meta ?? null);

  useEffect(() => {
    const resyncFreshness = () => setFreshnessRevision(revision => revision + 1);
    const timerId =
      currentFreshness.expiresInMs === null
        ? undefined
        : window.setTimeout(resyncFreshness, currentFreshness.expiresInMs);
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') resyncFreshness();
    };

    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      if (timerId !== undefined) window.clearTimeout(timerId);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [currentFreshness.expiresInMs, weather?.meta.fetchedAt, weather?.meta.freshForSeconds]);

  const center = useMemo<[number, number]>(() => {
    const lat = weather?.coordinates.lat;
    const lon = weather?.coordinates.lon;
    return lat !== undefined && lon !== undefined ? [lat, lon] : DEFAULT_CENTER;
  }, [weather?.coordinates.lat, weather?.coordinates.lon]);

  const [zoom, setZoom] = useState(6);
  const showAllProvinces = zoom >= ATLAS_ZOOM;
  const [atlasRequested, setAtlasRequested] = useState(false);
  useEffect(() => {
    if (showAllProvinces) setAtlasRequested(true);
  }, [showAllProvinces]);
  const provinceTemperatures = useProvinceTemperatures(atlasRequested, settings.language);
  const provinceNow = Date.now();
  const hasFreshProvinceTemperatures = Boolean(
    provinceTemperatures &&
      Array.from(provinceTemperatures.byPlate.values()).some(province =>
        isFreshProvinceObservation(province, provinceNow)
      )
  );
  const featuredCities = useMemo(
    () =>
      TURKISH_CITIES.filter(
        candidate =>
          (showAllProvinces || FEATURED_CITY_NAMES.has(candidate.name)) &&
          candidate.name !== weather?.cityName
      ),
    [showAllProvinces, weather?.cityName]
  );

  // CARTO's old anonymous raster endpoint now returns a successful HTTP response
  // containing 'API KEY REQUIRED' watermark tiles. Use usable OSM raster sources.
  // Both sources require OSM attribution; the fallback prevents a single host outage
  // from blanking the interactive map.
  const tileUrl = fallbackTiles
    ? 'https://a.tile.openstreetmap.de/tiles/osmde/{z}/{x}/{y}.png'
    : 'https://a.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png';
  const temperatureSymbol = getTemperatureSymbol();
  const currentMarkerName = weather
    ? currentFreshness.fresh
      ? `${weather.cityName}: ${Math.round(
          convertTemperature(weather.temperature)
        )}${temperatureSymbol}`
      : `${weather.cityName}: ${t('weather.staleCurrentData')}`
    : '';
  const legendThresholds = {
    zero: Math.round(convertTemperature(0)),
    ten: Math.round(convertTemperature(10)),
    twenty: Math.round(convertTemperature(20)),
    thirty: Math.round(convertTemperature(30)),
    unit: temperatureSymbol,
  };

  return (
    <div className={`weather-map ${className}`}>
      <h3 id={mapTitleId} className="weather-map__title">
        {t('weather.mapTitle')}
      </h3>

      <div className="weather-map__container" role="region" aria-labelledby={mapTitleId}>
        <MapContainer
          center={center}
          zoom={6}
          scrollWheelZoom
          attributionControl={false}
          className="weather-map__leaflet"
        >
          <MapController center={center} />
          <ZoomWatcher onZoom={setZoom} />

          <TileLayer
            key={`${fallbackTiles ? 'osmde' : 'osmfr'}-${tileAttempt}`}
            url={tileUrl}
            eventHandlers={{
              loading: () => {
                if (!tilesFailed) setTilesLoading(true);
              },
              load: () => setTilesLoading(false),
              tileerror: () => {
                if (fallbackTiles) {
                  // Both independent providers failed: do not keep showing a
                  // spinner indefinitely or claim the map is still loading.
                  setTilesFailed(true);
                  setTilesLoading(false);
                } else {
                  setTilesLoading(true);
                  setFallbackTiles(true);
                }
              },
            }}
            maxZoom={18}
          />

          {weather && (
            <Marker
              position={[weather.coordinates.lat, weather.coordinates.lon]}
              ref={marker => labelMarker(marker, currentMarkerName)}
              title={currentMarkerName}
              icon={
                currentFreshness.fresh
                  ? createTemperatureIcon(
                      weather.temperature,
                      convertTemperature(weather.temperature)
                    )
                  : createUnavailableObservationIcon()
              }
              eventHandlers={{
                add: event => labelMarker(event.target as L.Marker, currentMarkerName),
              }}
            >
              <Popup className="weather-map__popup">
                <div className="weather-map__popup-content">
                  <h4>{weather.cityName}</h4>
                  {currentFreshness.fresh ? (
                    <>
                      <p className="weather-map__popup-temp">
                        {convertTemperature(weather.temperature)} {getTemperatureSymbol()}
                      </p>
                      <p className="weather-map__popup-desc">{weather.description}</p>
                    </>
                  ) : (
                    <p className="weather-map__popup-desc">{t('weather.staleCurrentData')}</p>
                  )}
                </div>
              </Popup>
            </Marker>
          )}

          {featuredCities.map(featuredCity => {
            const candidate = showAllProvinces
              ? provinceTemperatures?.byPlate.get(featuredCity.plateCode)
              : undefined;
            const live =
              candidate && isFreshProvinceObservation(candidate, provinceNow) ? candidate : undefined;
            const liveDisplay = live ? Math.round(convertTemperature(live.temperature)) : null;
            const markerName = `${featuredCity.name}: ${t('hava81.decision.plateCodeLabel', {
              code: String(featuredCity.plateCode).padStart(2, '0'),
            })}${live ? `, ${liveDisplay}${temperatureSymbol}` : ''}`;

            return (
              <Marker
                key={featuredCity.plateCode}
                ref={marker => labelMarker(marker, markerName)}
                position={[featuredCity.coordinates.lat, featuredCity.coordinates.lon]}
                title={markerName}
                icon={createPlateIcon(
                  featuredCity.plateCode,
                  live && liveDisplay !== null
                    ? { celsius: live.temperature, display: liveDisplay }
                    : undefined
                )}
                eventHandlers={{
                  add: event => labelMarker(event.target as L.Marker, markerName),
                }}
              >
                <Popup className="weather-map__popup">
                  <div className="weather-map__popup-content">
                    <span className="weather-map__popup-plate">
                      {String(featuredCity.plateCode).padStart(2, '0')}
                    </span>
                    <h4>{featuredCity.name}</h4>
                    {live && (
                      <>
                        <p className="weather-map__popup-temp">
                          {liveDisplay} {temperatureSymbol}
                        </p>
                        <p className="weather-map__popup-desc">{live.description}</p>
                      </>
                    )}
                    <p className="weather-map__popup-region">{featuredCity.region}</p>
                    <button
                      type="button"
                      className="weather-map__popup-btn"
                      onClick={() => onCitySelect(featuredCity)}
                    >
                      {t('weather.viewCityWeather')}
                    </button>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
        {(tilesLoading || tilesFailed) && (
          <div
            className={`weather-map__tile-status${tilesFailed ? ' weather-map__tile-status--failed' : ''}`}
            role={tilesFailed ? 'alert' : 'status'}
            aria-live={tilesFailed ? 'assertive' : 'polite'}
          >
            {tilesFailed ? (
              <>
                <span>{t('weather.mapTilesUnavailable')}</span>
                <button type="button" onClick={retryTiles}>
                  {t('weather.mapTilesRetry')}
                </button>
              </>
            ) : (
              <>
                <span className="weather-map__tile-spinner" aria-hidden="true" />
                {t('weather.mapTilesLoading')}
              </>
            )}
          </div>
        )}
      </div>

      <p className="weather-map__attribution">
        {showAllProvinces && provinceTemperatures && hasFreshProvinceTemperatures && (
          <>
            <span>
              {t('weather.mapLiveProvinces', {
                provider: provinceTemperatures.attribution ?? provinceTemperatures.provider,
              })}
            </span>
            <span>·</span>
          </>
        )}
        <span>©</span>
        <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
          OpenStreetMap contributors
        </a>
        <span>·</span>
        {fallbackTiles ? (
          <a href="https://www.openstreetmap.de/" target="_blank" rel="noreferrer">
            OpenStreetMap Deutschland
          </a>
        ) : (
          <a href="https://www.openstreetmap.fr/" target="_blank" rel="noreferrer">
            Humanitarian style · OpenStreetMap France
          </a>
        )}
      </p>

      <div className="weather-map__legend" role="list" aria-label={t('weather.temperatureLegend')}>
        <span className="weather-map__legend-item weather-map__legend-item--cold" role="listitem">
          {t('weather.temperatureCold', legendThresholds)}
        </span>
        <span className="weather-map__legend-item weather-map__legend-item--cool" role="listitem">
          {t('weather.temperatureCool', legendThresholds)}
        </span>
        <span className="weather-map__legend-item weather-map__legend-item--mild" role="listitem">
          {t('weather.temperatureMild', legendThresholds)}
        </span>
        <span className="weather-map__legend-item weather-map__legend-item--warm" role="listitem">
          {t('weather.temperatureWarm', legendThresholds)}
        </span>
        <span className="weather-map__legend-item weather-map__legend-item--hot" role="listitem">
          {t('weather.temperatureHot', legendThresholds)}
        </span>
      </div>
    </div>
  );
};

export default WeatherMap;
