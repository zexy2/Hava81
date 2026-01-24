import React from 'react';
import './Skeleton.css';

interface SkeletonProps {
  variant?: 'text' | 'circular' | 'rectangular';
  width?: string | number;
  height?: string | number;
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = 'rectangular',
  width,
  height,
  className = '',
}) => {
  const style: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
  };

  return (
    <div
      className={`skeleton skeleton--${variant} ${className}`}
      style={style}
      aria-hidden="true"
    />
  );
};

export const WeatherCardSkeleton: React.FC = () => (
  <div className="weather-card weather-card--skeleton">
    <div className="weather-card__heading">
      <Skeleton variant="circular" width={80} height={80} />
      <div className="weather-card__info">
        <Skeleton variant="text" width="60%" height={28} />
        <Skeleton variant="text" width="40%" height={20} />
      </div>
      <Skeleton variant="text" width={100} height={64} />
    </div>
    <div className="weather-card__grid">
      {Array.from({ length: 6 }).map((_, i) => (
        <div className="weather-card__tile" key={i}>
          <Skeleton variant="text" width="70%" height={24} />
          <Skeleton variant="text" width="50%" height={16} />
        </div>
      ))}
    </div>
  </div>
);

export const ForecastSkeleton: React.FC = () => (
  <div className="forecast forecast--skeleton">
    <Skeleton variant="text" width={150} height={24} className="forecast__title-skeleton" />
    <div className="forecast__chart-skeleton">
      <Skeleton variant="rectangular" width="100%" height={200} />
    </div>
    <div className="forecast__daily-skeleton">
      {Array.from({ length: 5 }).map((_, i) => (
        <div className="forecast__day-skeleton" key={i}>
          <Skeleton variant="text" width={40} height={16} />
          <Skeleton variant="circular" width={40} height={40} />
          <Skeleton variant="text" width={60} height={20} />
        </div>
      ))}
    </div>
  </div>
);

export const AirQualitySkeleton: React.FC = () => (
  <div className="air-quality air-quality--skeleton">
    <Skeleton variant="text" width={120} height={24} />
    <div className="air-quality__content-skeleton">
      <Skeleton variant="circular" width={80} height={80} />
      <div className="air-quality__details-skeleton">
        <Skeleton variant="text" width="100%" height={16} />
        <Skeleton variant="text" width="80%" height={16} />
        <Skeleton variant="text" width="60%" height={16} />
      </div>
    </div>
  </div>
);

export default Skeleton;
