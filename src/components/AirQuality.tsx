import React from 'react';
import type { AirQuality as AirQualityType } from '../types';

interface AirQualityProps {
  data: AirQualityType;
}

function getAqiColor(aqi: number): string {
  const colors = ['#10b981', '#22c55e', '#eab308', '#f97316', '#ef4444'];
  return colors[aqi - 1] || colors[4];
}

function getAqiWidth(aqi: number): string {
  return `${(aqi / 5) * 100}%`;
}

export function AirQuality({ data }: AirQualityProps) {
  return (
    <div className="air-quality-card">
      <h3 className="aq-title">Hava Kalitesi</h3>
      
      <div className="aq-main">
        <div 
          className="aq-badge"
          style={{ backgroundColor: getAqiColor(data.aqi) }}
        >
          {data.aqiLabel}
        </div>
        
        <div className="aq-bar-container">
          <div 
            className="aq-bar"
            style={{ 
              width: getAqiWidth(data.aqi),
              backgroundColor: getAqiColor(data.aqi)
            }}
          />
        </div>
      </div>

      <div className="aq-details">
        <div className="aq-item">
          <span className="aq-label">PM2.5</span>
          <span className="aq-value">{data.pm25.toFixed(1)}</span>
          <span className="aq-unit">μg/m³</span>
        </div>
        <div className="aq-item">
          <span className="aq-label">PM10</span>
          <span className="aq-value">{data.pm10.toFixed(1)}</span>
          <span className="aq-unit">μg/m³</span>
        </div>
        <div className="aq-item">
          <span className="aq-label">Ozon</span>
          <span className="aq-value">{data.o3.toFixed(1)}</span>
          <span className="aq-unit">μg/m³</span>
        </div>
      </div>
    </div>
  );
}

export default AirQuality;
