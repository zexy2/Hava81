import React, { useEffect, useId, useMemo, useState } from 'react';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useTranslation } from 'react-i18next';
import { TURKISH_CITIES, type TurkishCity } from '../constants/cities';
import { useSettings } from '../context/SettingsContext';
import type { NormalizedWeatherData } from '../types/weather.types';
import { getCurrentWeatherFreshness } from '../utils/currentWeatherFreshness';
import './WeatherMap.css';
import './WeatherMapAtmosphere.css';

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

const createPlateIcon = (plateCode: number): L.DivIcon =>
  L.divIcon({
    className: 'weather-map__plate-marker',
    html: `<span>${String(plateCode).padStart(2, '0')}</span>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });

const labelMarker = (marker: L.Marker | null, accessibleName: string) => {
  marker?.getElement()?.setAttribute('aria-label', accessibleName);
};

export const WeatherMap: React.FC<WeatherMapProps> = ({
  weather,
  onCitySelect,
  className = '',
}) => {
  const { t } = useTranslation();
  const { convertTemperature, getTemperatureSymbol } = useSettings();
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

  const featuredCities = useMemo(
    () =>
      TURKISH_CITIES.filter(
        candidate => FEATURED_CITY_NAMES.has(candidate.name) && candidate.name !== weather?.cityName
      ),
    [weather?.cityName]
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
            const markerName = `${featuredCity.name}: ${t('hava81.decision.plateCodeLabel', {
              code: String(featuredCity.plateCode).padStart(2, '0'),
            })}`;

            return (
              <Marker
                key={featuredCity.plateCode}
                ref={marker => labelMarker(marker, markerName)}
                position={[featuredCity.coordinates.lat, featuredCity.coordinates.lon]}
                title={markerName}
                icon={createPlateIcon(featuredCity.plateCode)}
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
            aria-live="polite"
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
