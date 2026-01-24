import React, { useMemo } from 'react';
import type { HourlyForecast } from '../types';
import './TemperatureChart.css';

interface TemperatureChartProps {
  data: HourlyForecast[];
  className?: string;
}

export const TemperatureChart: React.FC<TemperatureChartProps> = ({
  data,
  className = '',
}) => {
  const chartData = useMemo(() => {
    if (data.length === 0) return null;

    const temps = data.map(d => d.temp);
    const minTemp = Math.min(...temps);
    const maxTemp = Math.max(...temps);
    const range = maxTemp - minTemp || 1;
    
    const padding = { top: 40, right: 20, bottom: 50, left: 20 };
    const width = 100;
    const height = 100;
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    const points = data.map((d, i) => {
      const x = padding.left + (i / (data.length - 1)) * chartWidth;
      const y = padding.top + chartHeight - ((d.temp - minTemp) / range) * chartHeight;
      return { x, y, temp: d.temp, time: d.time, icon: d.icon, pop: d.pop };
    });

    // Create smooth curve path
    const linePath = points.reduce((path, point, i) => {
      if (i === 0) return `M ${point.x} ${point.y}`;
      
      const prev = points[i - 1];
      const cpx1 = prev.x + (point.x - prev.x) / 3;
      const cpx2 = point.x - (point.x - prev.x) / 3;
      
      return `${path} C ${cpx1} ${prev.y}, ${cpx2} ${point.y}, ${point.x} ${point.y}`;
    }, '');

    // Create gradient fill path
    const fillPath = `${linePath} L ${points[points.length - 1].x} ${padding.top + chartHeight} L ${points[0].x} ${padding.top + chartHeight} Z`;

    return { points, linePath, fillPath, minTemp, maxTemp };
  }, [data]);

  if (!chartData || data.length < 2) {
    return null;
  }

  const formatHour = (date: Date) => {
    return date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`temperature-chart ${className}`}>
      <h4 className="temperature-chart__title">Saatlik Sıcaklık</h4>
      
      <div className="temperature-chart__container">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="temperature-chart__svg"
        >
          <defs>
            <linearGradient id="tempGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="var(--theme-accent)" stopOpacity="0.4" />
              <stop offset="100%" stopColor="var(--theme-accent)" stopOpacity="0" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="0.5" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Grid lines */}
          <g className="temperature-chart__grid">
            {[0, 25, 50, 75, 100].map(pct => (
              <line
                key={pct}
                x1="20"
                y1={40 + (pct / 100) * 50}
                x2="80"
                y2={40 + (pct / 100) * 50}
                stroke="rgba(255,255,255,0.05)"
                strokeWidth="0.2"
              />
            ))}
          </g>

          {/* Gradient fill */}
          <path
            d={chartData.fillPath}
            fill="url(#tempGradient)"
            className="temperature-chart__fill"
          />

          {/* Line */}
          <path
            d={chartData.linePath}
            fill="none"
            stroke="var(--theme-accent)"
            strokeWidth="0.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter="url(#glow)"
            className="temperature-chart__line"
          />

          {/* Data points */}
          {chartData.points.map((point, i) => (
            <g key={i} className="temperature-chart__point-group">
              <circle
                cx={point.x}
                cy={point.y}
                r="1.2"
                fill="var(--theme-accent)"
                className="temperature-chart__point"
              />
            </g>
          ))}
        </svg>

        {/* Labels */}
        <div className="temperature-chart__labels">
          {chartData.points.filter((_, i) => i % Math.ceil(data.length / 6) === 0 || i === data.length - 1).map((point, i) => (
            <div
              key={i}
              className="temperature-chart__label"
              style={{
                left: `${(point.x / 100) * 100}%`,
              }}
            >
              <span className="temperature-chart__temp">{Math.round(point.temp)}°</span>
              <span className="temperature-chart__time">{formatHour(point.time)}</span>
              {point.pop > 0.1 && (
                <span className="temperature-chart__pop">{Math.round(point.pop * 100)}%</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Min/Max indicator */}
      <div className="temperature-chart__range">
        <span className="temperature-chart__min">Min: {Math.round(chartData.minTemp)}°</span>
        <span className="temperature-chart__max">Max: {Math.round(chartData.maxTemp)}°</span>
      </div>
    </div>
  );
};

export default TemperatureChart;
