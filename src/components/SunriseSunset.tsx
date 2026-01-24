import React, { useMemo } from 'react';
import './SunriseSunset.css';

interface SunriseSunsetProps {
  sunrise: Date;
  sunset: Date;
  className?: string;
}

export const SunriseSunset: React.FC<SunriseSunsetProps> = ({
  sunrise,
  sunset,
  className = '',
}) => {
  const { progress, dayLength, sunPosition } = useMemo(() => {
    const now = new Date();
    const sunriseMs = sunrise.getTime();
    const sunsetMs = sunset.getTime();
    const nowMs = now.getTime();
    
    const dayLengthMs = sunsetMs - sunriseMs;
    const dayHours = Math.floor(dayLengthMs / (1000 * 60 * 60));
    const dayMinutes = Math.floor((dayLengthMs % (1000 * 60 * 60)) / (1000 * 60));
    
    let progressPercent = 0;
    let isDaytime = false;
    
    if (nowMs < sunriseMs) {
      progressPercent = 0;
    } else if (nowMs > sunsetMs) {
      progressPercent = 100;
    } else {
      progressPercent = ((nowMs - sunriseMs) / dayLengthMs) * 100;
      isDaytime = true;
    }
    
    // Calculate sun position on arc (0-180 degrees)
    const angle = (progressPercent / 100) * 180;
    const radians = (angle * Math.PI) / 180;
    const arcRadius = 70;
    const centerX = 80;
    const centerY = 75;
    
    const x = centerX - arcRadius * Math.cos(radians);
    const y = centerY - arcRadius * Math.sin(radians);
    
    return {
      progress: progressPercent,
      currentTime: now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      dayLength: `${dayHours}s ${dayMinutes}dk`,
      sunPosition: { x, y, isDaytime },
    };
  }, [sunrise, sunset]);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`sunrise-sunset ${className}`}>
      <h4 className="sunrise-sunset__title">Gün Işığı</h4>
      
      <div className="sunrise-sunset__chart">
        <svg viewBox="0 0 160 90" className="sunrise-sunset__svg">
          <defs>
            <linearGradient id="arcGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f97316" stopOpacity="0.3" />
              <stop offset="50%" stopColor="#facc15" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#f97316" stopOpacity="0.3" />
            </linearGradient>
            <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#f97316" />
              <stop offset="50%" stopColor="#facc15" />
              <stop offset="100%" stopColor="#f97316" />
            </linearGradient>
            <filter id="sunGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          
          {/* Horizon line */}
          <line 
            x1="5" y1="75" x2="155" y2="75" 
            stroke="rgba(255,255,255,0.1)" 
            strokeWidth="1"
            strokeDasharray="4 4"
          />
          
          {/* Background arc */}
          <path
            d="M 10 75 A 70 70 0 0 1 150 75"
            fill="none"
            stroke="url(#arcGradient)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          
          {/* Progress arc */}
          <path
            d="M 10 75 A 70 70 0 0 1 150 75"
            fill="none"
            stroke="url(#progressGradient)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${(progress / 100) * 220} 220`}
            className="sunrise-sunset__progress"
          />
          
          {/* Sun icon */}
          {sunPosition.isDaytime && (
            <g filter="url(#sunGlow)" className="sunrise-sunset__sun">
              <circle 
                cx={sunPosition.x} 
                cy={sunPosition.y} 
                r="8" 
                fill="#facc15"
              />
              {/* Sun rays */}
              {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
                <line
                  key={angle}
                  x1={sunPosition.x + 10 * Math.cos((angle * Math.PI) / 180)}
                  y1={sunPosition.y + 10 * Math.sin((angle * Math.PI) / 180)}
                  x2={sunPosition.x + 13 * Math.cos((angle * Math.PI) / 180)}
                  y2={sunPosition.y + 13 * Math.sin((angle * Math.PI) / 180)}
                  stroke="#facc15"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              ))}
            </g>
          )}
          
          {/* Moon for night */}
          {!sunPosition.isDaytime && progress > 0 && (
            <circle 
              cx={progress === 100 ? 150 : 10} 
              cy="75" 
              r="6" 
              fill="#94a3b8"
              className="sunrise-sunset__moon"
            />
          )}
        </svg>
      </div>
      
      <div className="sunrise-sunset__times">
        <div className="sunrise-sunset__time">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            <circle cx="12" cy="12" r="4"/>
          </svg>
          <span className="sunrise-sunset__label">Doğuş</span>
          <span className="sunrise-sunset__value">{formatTime(sunrise)}</span>
        </div>
        
        <div className="sunrise-sunset__day-length">
          <span className="sunrise-sunset__length-label">Gün Uzunluğu</span>
          <span className="sunrise-sunset__length-value">{dayLength}</span>
        </div>
        
        <div className="sunrise-sunset__time">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2">
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            <circle cx="12" cy="12" r="4"/>
          </svg>
          <span className="sunrise-sunset__label">Batış</span>
          <span className="sunrise-sunset__value">{formatTime(sunset)}</span>
        </div>
      </div>
    </div>
  );
};

export default SunriseSunset;
