import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import './UVIndex.css';

interface UVIndexProps {
  value: number;
  className?: string;
}

interface UVLevel {
  labelKey: string;
  color: string;
  adviceKey: string;
}

const UV_LEVELS: UVLevel[] = [
  { labelKey: 'uv.low', color: '#22c55e', adviceKey: 'uv.noProtection' },
  { labelKey: 'uv.moderate', color: '#eab308', adviceKey: 'uv.someProtection' },
  { labelKey: 'uv.high', color: '#f97316', adviceKey: 'uv.protection' },
  { labelKey: 'uv.veryHigh', color: '#ef4444', adviceKey: 'uv.extraProtection' },
  { labelKey: 'uv.extreme', color: '#7c3aed', adviceKey: 'uv.danger' },
];

export const UVIndex: React.FC<UVIndexProps> = ({
  value,
  className = '',
}) => {
  const { t } = useTranslation();
  const { level, rotation, segments } = useMemo(() => {
    let levelIndex = 0;
    if (value < 3) levelIndex = 0;
    else if (value < 6) levelIndex = 1;
    else if (value < 8) levelIndex = 2;
    else if (value < 11) levelIndex = 3;
    else levelIndex = 4;
    
    // Gauge rotation: map 0-12+ to 0-180 degrees
    const rot = Math.min((value / 12) * 180, 180);
    
    // Segments for the gauge
    const segs = UV_LEVELS.map((uv, i) => ({
      ...uv,
      startAngle: (i / 5) * 180,
      endAngle: ((i + 1) / 5) * 180,
    }));
    
    return { level: UV_LEVELS[levelIndex], rotation: rot, segments: segs };
  }, [value]);

  const createArcPath = (startAngle: number, endAngle: number, radius: number) => {
    const startRad = ((startAngle - 180) * Math.PI) / 180;
    const endRad = ((endAngle - 180) * Math.PI) / 180;
    
    const x1 = 60 + radius * Math.cos(startRad);
    const y1 = 60 + radius * Math.sin(startRad);
    const x2 = 60 + radius * Math.cos(endRad);
    const y2 = 60 + radius * Math.sin(endRad);
    
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

  return (
    <div className={`uv-index ${className}`}>
      <h4 className="uv-index__title">{t('weather.uvIndex')}</h4>
      
      <div className="uv-index__gauge">
        <svg viewBox="0 0 120 70" className="uv-index__svg">
          <defs>
            {segments.map((seg, i) => (
              <linearGradient key={i} id={`uvGrad${i}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={seg.color} stopOpacity="0.3" />
                <stop offset="100%" stopColor={seg.color} stopOpacity="0.6" />
              </linearGradient>
            ))}
          </defs>
          
          {/* Background segments */}
          {segments.map((seg, i) => (
            <path
              key={i}
              d={createArcPath(seg.startAngle, seg.endAngle, 50)}
              fill="none"
              stroke={`url(#uvGrad${i})`}
              strokeWidth="8"
              strokeLinecap="round"
            />
          ))}
          
          {/* Tick marks */}
          {[0, 3, 6, 8, 11].map((uv, i) => {
            const angle = ((uv / 12) * 180 - 180) * (Math.PI / 180);
            const x1 = 60 + 42 * Math.cos(angle);
            const y1 = 60 + 42 * Math.sin(angle);
            const x2 = 60 + 48 * Math.cos(angle);
            const y2 = 60 + 48 * Math.sin(angle);
            
            return (
              <g key={i}>
                <line
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke="rgba(255,255,255,0.3)"
                  strokeWidth="2"
                />
                <text
                  x={60 + 35 * Math.cos(angle)}
                  y={60 + 35 * Math.sin(angle)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="var(--theme-text-secondary)"
                  fontSize="7"
                >
                  {uv}
                </text>
              </g>
            );
          })}
          
          {/* Needle */}
          <g 
            transform={`rotate(${rotation - 180}, 60, 60)`}
            className="uv-index__needle"
          >
            <polygon
              points="60,15 57,55 60,58 63,55"
              fill={level.color}
            />
            <circle cx="60" cy="60" r="5" fill={level.color} />
          </g>
        </svg>
        
        {/* Value display */}
        <div className="uv-index__value" style={{ color: level.color }}>
          {value.toFixed(1)}
        </div>
      </div>
      
      <div className="uv-index__info">
        <span 
          className="uv-index__level"
          style={{ backgroundColor: `${level.color}20`, color: level.color }}
        >
          {t(level.labelKey)}
        </span>
        <span className="uv-index__advice">{t(level.adviceKey)}</span>
      </div>
    </div>
  );
};

export default UVIndex;
