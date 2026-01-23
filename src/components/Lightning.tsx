/**
 * Lightning Effect Component
 * Animated background effect with performance optimizations
 */

import React, { memo, useMemo, type CSSProperties } from 'react';
import './Lightning.css';

interface LightningProps {
  hue?: number;
  intensity?: number;
  speed?: number;
  xOffset?: number;
}

const clamp = (value: number, min: number, max: number): number => 
  Math.min(Math.max(value, min), max);

export const Lightning: React.FC<LightningProps> = memo(({
  hue = 220,
  intensity = 1,
  speed = 1,
  xOffset = 0,
}) => {
  const style = useMemo<CSSProperties>(() => ({
    '--lightning-hue': hue,
    '--lightning-opacity': clamp(intensity * 0.2, 0.15, 0.6),
    '--lightning-speed': `${clamp(speed, 0.5, 3) * 6}s`,
    '--lightning-position': `${clamp(xOffset, -50, 50)}%`,
  } as CSSProperties), [hue, intensity, speed, xOffset]);

  return (
    <div 
      className="lightning" 
      style={style} 
      aria-hidden="true"
      role="presentation"
    />
  );
});

Lightning.displayName = 'Lightning';

export default Lightning;
