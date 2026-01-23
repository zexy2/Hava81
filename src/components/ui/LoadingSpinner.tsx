/**
 * Loading Spinner Component
 */

import React, { memo } from 'react';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  text?: string;
  className?: string;
}

const sizeMap = {
  small: '1rem',
  medium: '2rem',
  large: '3rem',
};

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = memo(({
  size = 'medium',
  text,
  className = '',
}) => {
  const spinnerSize = sizeMap[size];

  return (
    <div 
      className={`loading-spinner ${className}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div 
        className="loading-spinner__circle"
        style={{ 
          width: spinnerSize, 
          height: spinnerSize,
          borderWidth: size === 'small' ? '2px' : '3px',
        }}
      />
      {text && <span className="loading-spinner__text">{text}</span>}
      <span className="visually-hidden">Yükleniyor...</span>
    </div>
  );
});

LoadingSpinner.displayName = 'LoadingSpinner';

export default LoadingSpinner;
