import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../context';
import './WindCompass.css';

interface WindCompassProps {
  speed: number;
  direction: number;
  gust?: number;
  className?: string;
}

const DIRECTION_KEYS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

export const WindCompass: React.FC<WindCompassProps> = ({
  speed,
  direction,
  gust,
  className = '',
}) => {
  const { t } = useTranslation();
  const { convertWindSpeed, getWindSpeedSymbol } = useSettings();
  
  const directionLabels = DIRECTION_KEYS.map(key => t(`wind.directions.${key}`));
  
  const { directionLabel, beaufortLabel } = useMemo(() => {
    // Direction label
    const index = Math.round(direction / 45) % 8;
    const label = directionLabels[index];
    
    // Beaufort scale
    let scaleKey = 'calm';
    
    if (speed < 0.5) { scaleKey = 'calm'; }
    else if (speed < 1.6) { scaleKey = 'lightAir'; }
    else if (speed < 3.4) { scaleKey = 'lightBreeze'; }
    else if (speed < 5.5) { scaleKey = 'gentleBreeze'; }
    else if (speed < 8.0) { scaleKey = 'moderateBreeze'; }
    else if (speed < 10.8) { scaleKey = 'freshBreeze'; }
    else if (speed < 13.9) { scaleKey = 'strongBreeze'; }
    else if (speed < 17.2) { scaleKey = 'nearGale'; }
    else if (speed < 20.8) { scaleKey = 'gale'; }
    else if (speed < 24.5) { scaleKey = 'strongGale'; }
    else if (speed < 28.5) { scaleKey = 'storm'; }
    else if (speed < 32.7) { scaleKey = 'violentStorm'; }
    else { scaleKey = 'hurricane'; }
    
    return { directionLabel: label, beaufortLabel: t(`wind.beaufort.${scaleKey}`) };
  }, [speed, direction, directionLabels, t]);

  return (
    <div className={`wind-compass ${className}`}>
      <h4 className="wind-compass__title">Rüzgar</h4>
      
      <div className="wind-compass__container">
        <svg viewBox="0 0 120 120" className="wind-compass__svg">
          <defs>
            <linearGradient id="compassGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.1)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
            </linearGradient>
            <filter id="arrowShadow" x="-50%" y="-50%" width="200%" height="200%">
              <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="rgba(0,0,0,0.3)" />
            </filter>
          </defs>
          
          {/* Outer circle */}
          <circle 
            cx="60" cy="60" r="55" 
            fill="url(#compassGradient)"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth="1"
          />
          
          {/* Inner circles */}
          <circle cx="60" cy="60" r="40" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          <circle cx="60" cy="60" r="25" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
          
          {/* Direction markers */}
          {directionLabels.map((label, i) => {
            const angle = (i * 45 - 90) * (Math.PI / 180);
            const x = 60 + 48 * Math.cos(angle);
            const y = 60 + 48 * Math.sin(angle);
            const isCardinal = i % 2 === 0;
            
            return (
              <text
                key={label}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={isCardinal ? 'var(--theme-text-primary)' : 'var(--theme-text-secondary)'}
                fontSize={isCardinal ? '10' : '8'}
                fontWeight={isCardinal ? '600' : '400'}
              >
                {label}
              </text>
            );
          })}
          
          {/* Tick marks */}
          {Array.from({ length: 36 }).map((_, i) => {
            const angle = (i * 10 - 90) * (Math.PI / 180);
            const isMajor = i % 9 === 0;
            const r1 = isMajor ? 35 : 37;
            const r2 = 40;
            
            return (
              <line
                key={i}
                x1={60 + r1 * Math.cos(angle)}
                y1={60 + r1 * Math.sin(angle)}
                x2={60 + r2 * Math.cos(angle)}
                y2={60 + r2 * Math.sin(angle)}
                stroke={isMajor ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'}
                strokeWidth={isMajor ? '2' : '1'}
              />
            );
          })}
          
          {/* Wind direction arrow */}
          <g 
            transform={`rotate(${direction}, 60, 60)`}
            filter="url(#arrowShadow)"
            className="wind-compass__arrow"
          >
            <polygon
              points="60,20 54,45 60,40 66,45"
              fill="var(--theme-accent)"
            />
            <line
              x1="60" y1="40" x2="60" y2="85"
              stroke="var(--theme-accent)"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </g>
          
          {/* Center dot */}
          <circle cx="60" cy="60" r="4" fill="var(--theme-accent)" />
        </svg>
        
        {/* Speed display */}
        <div className="wind-compass__speed">
          <span className="wind-compass__speed-value">{convertWindSpeed(speed)}</span>
          <span className="wind-compass__speed-unit">{getWindSpeedSymbol()}</span>
        </div>
      </div>
      
      <div className="wind-compass__info">
        <div className="wind-compass__direction">
          <span className="wind-compass__info-label">{t('wind.direction')}</span>
          <span className="wind-compass__info-value">{directionLabel} ({direction}°)</span>
        </div>
        
        <div className="wind-compass__scale">
          <span className="wind-compass__info-label">{t('wind.intensity')}</span>
          <span className="wind-compass__info-value">{beaufortLabel}</span>
        </div>
        
        {gust && gust > speed && (
          <div className="wind-compass__gust">
            <span className="wind-compass__info-label">{t('wind.gust')}</span>
            <span className="wind-compass__info-value wind-compass__info-value--gust">
              {convertWindSpeed(gust)} {getWindSpeedSymbol()}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default WindCompass;
