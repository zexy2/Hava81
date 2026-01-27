import React, { useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { TURKISH_CITIES, type TurkishCity } from '../constants/cities';
import type { NormalizedWeatherData } from '../types';
import './WeatherMap.css';

// Fix for default marker icon in React-Leaflet
// Using CDN URLs instead of imports to avoid TypeScript issues
const DefaultIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface WeatherMapProps {
  weather: NormalizedWeatherData | null;
  onCitySelect: (city: TurkishCity) => void;
  className?: string;
}

// Component to recenter map when weather changes
const MapController: React.FC<{ center: [number, number] }> = ({ center }) => {
  const map = useMap();
  
  useEffect(() => {
    map.flyTo(center, 8, {
      duration: 1.5,
    });
  }, [center, map]);
  
  return null;
};

// Custom marker icon based on temperature
const createTemperatureIcon = (temp: number): L.DivIcon => {
  let bgColor = '#3b82f6'; // blue - cold
  if (temp >= 30) bgColor = '#ef4444'; // red - hot
  else if (temp >= 20) bgColor = '#f97316'; // orange - warm
  else if (temp >= 10) bgColor = '#22c55e'; // green - mild
  else if (temp >= 0) bgColor = '#06b6d4'; // cyan - cool
  
  return L.divIcon({
    className: 'weather-map__marker',
    html: `
      <div class="weather-map__marker-content" style="background: ${bgColor}">
        <span>${temp}°</span>
      </div>
    `,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
  });
};

// Default center: Turkey (defined outside component to prevent re-renders)
const DEFAULT_CENTER: [number, number] = [39.0, 35.0];

export const WeatherMap: React.FC<WeatherMapProps> = ({
  weather,
  onCitySelect,
  className = '',
}) => {
  const { t } = useTranslation();
  
  const center = useMemo((): [number, number] => {
    if (weather?.coordinates) {
      return [weather.coordinates.lat, weather.coordinates.lon];
    }
    return DEFAULT_CENTER;
  }, [weather?.coordinates]);

  // OpenWeather tile layer URL
  const weatherLayerUrl = `https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${process.env.REACT_APP_OPENWEATHER_KEY}`;

  return (
    <motion.div 
      className={`weather-map ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.2 }}
    >
      <h3 className="weather-map__title">{t('weather.title')} Haritası</h3>
      
      <div className="weather-map__container">
        <MapContainer
          center={center}
          zoom={6}
          scrollWheelZoom={true}
          className="weather-map__leaflet"
        >
          <MapController center={center} />
          
          {/* Base map layer */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          />
          
          {/* Weather temperature layer */}
          <TileLayer
            url={weatherLayerUrl}
            opacity={0.5}
          />
          
          {/* Current city marker */}
          {weather && (
            <Marker 
              position={[weather.coordinates.lat, weather.coordinates.lon]}
              icon={createTemperatureIcon(weather.temperature)}
            >
              <Popup className="weather-map__popup">
                <div className="weather-map__popup-content">
                  <h4>{weather.cityName}</h4>
                  <p className="weather-map__popup-temp">{weather.temperature}°C</p>
                  <p className="weather-map__popup-desc">{weather.description}</p>
                </div>
              </Popup>
            </Marker>
          )}
          
          {/* Major cities markers */}
          {TURKISH_CITIES.filter(city => 
            ['İstanbul', 'Ankara', 'İzmir', 'Antalya', 'Bursa', 'Adana', 'Trabzon', 'Erzurum', 'Diyarbakır', 'Konya']
            .includes(city.name) && city.name !== weather?.cityName
          ).map(city => (
            <Marker
              key={city.plateCode}
              position={[city.coordinates.lat, city.coordinates.lon]}
              eventHandlers={{
                click: () => onCitySelect(city),
              }}
            >
              <Popup>
                <div className="weather-map__popup-content">
                  <h4>{city.name}</h4>
                  <p className="weather-map__popup-region">{city.region}</p>
                  <button 
                    className="weather-map__popup-btn"
                    onClick={() => onCitySelect(city)}
                  >
                    Hava Durumunu Gör
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      
      {/* Legend */}
      <div className="weather-map__legend">
        <span className="weather-map__legend-item" style={{ '--color': '#3b82f6' } as React.CSSProperties}>
          Soğuk (&lt;0°C)
        </span>
        <span className="weather-map__legend-item" style={{ '--color': '#06b6d4' } as React.CSSProperties}>
          Serin (0-10°C)
        </span>
        <span className="weather-map__legend-item" style={{ '--color': '#22c55e' } as React.CSSProperties}>
          Ilık (10-20°C)
        </span>
        <span className="weather-map__legend-item" style={{ '--color': '#f97316' } as React.CSSProperties}>
          Sıcak (20-30°C)
        </span>
        <span className="weather-map__legend-item" style={{ '--color': '#ef4444' } as React.CSSProperties}>
          Çok Sıcak (&gt;30°C)
        </span>
      </div>
    </motion.div>
  );
};

export default WeatherMap;
