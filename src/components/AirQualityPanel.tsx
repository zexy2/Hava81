import React from 'react';
import type { AirQuality as AirQualityType } from '../types';
import './AirQualityPanel.css';

interface AirQualityPanelProps {
  data: AirQualityType;
  className?: string;
}

interface Pollutant {
  key: keyof Pick<AirQualityType, 'pm25' | 'pm10' | 'o3'>;
  label: string;
  unit: string;
  thresholds: number[];
}

const POLLUTANTS: Pollutant[] = [
  { key: 'pm25', label: 'PM2.5', unit: 'μg/m³', thresholds: [12, 35, 55, 150, 250] },
  { key: 'pm10', label: 'PM10', unit: 'μg/m³', thresholds: [54, 154, 254, 354, 424] },
  { key: 'o3', label: 'Ozon', unit: 'μg/m³', thresholds: [54, 70, 85, 105, 200] },
];

const AQI_INFO = [
  { label: 'İyi', color: '#22c55e', range: '0-50' },
  { label: 'Orta', color: '#eab308', range: '51-100' },
  { label: 'Hassas', color: '#f97316', range: '101-150' },
  { label: 'Sağlıksız', color: '#ef4444', range: '151-200' },
  { label: 'Çok Sağlıksız', color: '#7c3aed', range: '201-300' },
];

function getAqiColor(aqi: number): string {
  const colors = ['#22c55e', '#eab308', '#f97316', '#ef4444', '#7c3aed'];
  return colors[Math.min(aqi - 1, 4)] || colors[0];
}

function getPollutantLevel(value: number, thresholds: number[]): number {
  for (let i = 0; i < thresholds.length; i++) {
    if (value <= thresholds[i]) return i;
  }
  return thresholds.length;
}

export function AirQualityPanel({ data, className = '' }: AirQualityPanelProps) {
  const aqiColor = getAqiColor(data.aqi);
  const aqiPercent = (data.aqi / 5) * 100;

  return (
    <div className={`aq-panel ${className}`}>
      <h4 className="aq-panel__title">Hava Kalitesi</h4>
      
      {/* Main AQI Display */}
      <div className="aq-panel__main">
        <div className="aq-panel__gauge">
          <svg viewBox="0 0 120 120" className="aq-panel__svg">
            <defs>
              <linearGradient id="aqiRingGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={aqiColor} stopOpacity="0.2" />
                <stop offset="100%" stopColor={aqiColor} stopOpacity="0.4" />
              </linearGradient>
            </defs>
            
            {/* Background ring */}
            <circle
              cx="60" cy="60" r="50"
              fill="none"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="10"
            />
            
            {/* Progress ring */}
            <circle
              cx="60" cy="60" r="50"
              fill="none"
              stroke={aqiColor}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${(aqiPercent / 100) * 314} 314`}
              transform="rotate(-90 60 60)"
              className="aq-panel__progress"
            />
            
            {/* Inner circle */}
            <circle
              cx="60" cy="60" r="40"
              fill="url(#aqiRingGrad)"
            />
          </svg>
          
          <div className="aq-panel__value">
            <span className="aq-panel__aqi" style={{ color: aqiColor }}>{data.aqi}</span>
            <span className="aq-panel__label">{data.aqiLabel}</span>
          </div>
        </div>
        
        {/* Legend */}
        <div className="aq-panel__legend">
          {AQI_INFO.map((info, i) => (
            <div 
              key={i} 
              className={`aq-panel__legend-item ${data.aqi === i + 1 ? 'active' : ''}`}
            >
              <span 
                className="aq-panel__legend-dot"
                style={{ backgroundColor: info.color }}
              />
              <span className="aq-panel__legend-label">{info.label}</span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Pollutants */}
      <div className="aq-panel__pollutants">
        {POLLUTANTS.map((pollutant) => {
          const value = data[pollutant.key];
          const level = getPollutantLevel(value, pollutant.thresholds);
          const percent = Math.min((value / pollutant.thresholds[pollutant.thresholds.length - 1]) * 100, 100);
          const levelColor = AQI_INFO[Math.min(level, 4)].color;
          
          return (
            <div key={pollutant.key} className="aq-panel__pollutant">
              <div className="aq-panel__pollutant-header">
                <span className="aq-panel__pollutant-name">{pollutant.label}</span>
                <span className="aq-panel__pollutant-value">
                  {value.toFixed(1)} <small>{pollutant.unit}</small>
                </span>
              </div>
              <div className="aq-panel__pollutant-bar">
                <div 
                  className="aq-panel__pollutant-fill"
                  style={{ 
                    width: `${percent}%`,
                    backgroundColor: levelColor,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AirQualityPanel;
