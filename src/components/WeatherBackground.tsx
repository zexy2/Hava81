/**
 * WeatherBackground Component
 * Animated background with particles based on weather conditions
 */

import React, { useEffect, useRef, useMemo } from 'react';
import type { ThemeConfig } from '../utils/weatherTheme';

interface WeatherBackgroundProps {
  config: ThemeConfig;
}

interface Particle {
  x: number;
  y: number;
  size: number;
  speed: number;
  opacity: number;
  angle?: number;
  drift?: number;
  twinkle?: number;
}

export function WeatherBackground({ config }: WeatherBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const particlesRef = useRef<Particle[]>([]);

  // Initialize particles based on type
  const initParticles = useMemo(() => {
    return (width: number, height: number): Particle[] => {
      const particles: Particle[] = [];
      const count = config.particleCount;

      for (let i = 0; i < count; i++) {
        switch (config.particleType) {
          case 'rain':
            particles.push({
              x: Math.random() * width,
              y: Math.random() * height,
              size: Math.random() * 2 + 1,
              speed: Math.random() * 15 + 10,
              opacity: Math.random() * 0.3 + 0.2,
              angle: Math.PI / 12, // Slight angle
            });
            break;
          case 'snow':
            particles.push({
              x: Math.random() * width,
              y: Math.random() * height,
              size: Math.random() * 4 + 2,
              speed: Math.random() * 2 + 0.5,
              opacity: Math.random() * 0.6 + 0.4,
              drift: Math.random() * 2 - 1,
            });
            break;
          case 'stars':
            particles.push({
              x: Math.random() * width,
              y: Math.random() * height,
              size: Math.random() * 2 + 0.5,
              speed: 0,
              opacity: Math.random() * 0.8 + 0.2,
              twinkle: Math.random() * Math.PI * 2,
            });
            break;
          case 'clouds':
            particles.push({
              x: Math.random() * width * 1.5 - width * 0.25,
              y: Math.random() * height * 0.6,
              size: Math.random() * 100 + 50,
              speed: Math.random() * 0.3 + 0.1,
              opacity: Math.random() * 0.15 + 0.05,
            });
            break;
          case 'sun':
            particles.push({
              x: width * 0.75 + (Math.random() - 0.5) * 100,
              y: height * 0.15 + (Math.random() - 0.5) * 50,
              size: Math.random() * 3 + 1,
              speed: Math.random() * 0.5 + 0.2,
              opacity: Math.random() * 0.6 + 0.2,
              angle: (i / count) * Math.PI * 2,
            });
            break;
        }
      }
      return particles;
    };
  }, [config.particleType, config.particleCount]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle resize
    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      particlesRef.current = initParticles(canvas.width, canvas.height);
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    // Animation loop
    let lastTime = 0;
    const animate = (currentTime: number) => {
      const deltaTime = (currentTime - lastTime) / 16.67; // Normalize to 60fps
      lastTime = currentTime;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particlesRef.current.forEach((particle) => {
        ctx.save();

        switch (config.particleType) {
          case 'rain':
            drawRain(ctx, particle, config.colors.particleColor, deltaTime, canvas.height);
            break;
          case 'snow':
            drawSnow(ctx, particle, config.colors.particleColor, deltaTime, canvas.width, canvas.height);
            break;
          case 'stars':
            drawStar(ctx, particle, config.colors.particleColor, currentTime);
            break;
          case 'clouds':
            drawCloud(ctx, particle, config.colors.particleColor, deltaTime, canvas.width);
            break;
          case 'sun':
            drawSunRay(ctx, particle, config.colors.particleColor, currentTime, canvas.width, canvas.height);
            break;
        }

        ctx.restore();
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [config, initParticles]);

  return (
    <canvas
      ref={canvasRef}
      className="weather-background-canvas"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}

// Draw functions
function drawRain(
  ctx: CanvasRenderingContext2D,
  particle: Particle,
  color: string,
  deltaTime: number,
  canvasHeight: number
) {
  ctx.strokeStyle = color;
  ctx.lineWidth = particle.size * 0.5;
  ctx.globalAlpha = particle.opacity;
  ctx.beginPath();
  ctx.moveTo(particle.x, particle.y);
  ctx.lineTo(
    particle.x + Math.sin(particle.angle || 0) * 15,
    particle.y + Math.cos(particle.angle || 0) * 15
  );
  ctx.stroke();

  // Update position
  particle.y += particle.speed * deltaTime;
  particle.x += Math.sin(particle.angle || 0) * particle.speed * 0.3 * deltaTime;

  if (particle.y > canvasHeight) {
    particle.y = -20;
    particle.x = Math.random() * ctx.canvas.width;
  }
}

function drawSnow(
  ctx: CanvasRenderingContext2D,
  particle: Particle,
  color: string,
  deltaTime: number,
  canvasWidth: number,
  canvasHeight: number
) {
  ctx.fillStyle = color;
  ctx.globalAlpha = particle.opacity;
  ctx.beginPath();
  ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
  ctx.fill();

  // Update position with drift
  particle.y += particle.speed * deltaTime;
  particle.x += Math.sin(particle.y * 0.01) * (particle.drift || 0) * deltaTime;

  if (particle.y > canvasHeight) {
    particle.y = -10;
    particle.x = Math.random() * canvasWidth;
  }
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  particle: Particle,
  color: string,
  time: number
) {
  const twinkle = Math.sin(time * 0.002 + (particle.twinkle || 0)) * 0.5 + 0.5;
  ctx.fillStyle = color;
  ctx.globalAlpha = particle.opacity * twinkle;
  ctx.beginPath();
  ctx.arc(particle.x, particle.y, particle.size * twinkle, 0, Math.PI * 2);
  ctx.fill();
}

function drawCloud(
  ctx: CanvasRenderingContext2D,
  particle: Particle,
  color: string,
  deltaTime: number,
  canvasWidth: number
) {
  ctx.fillStyle = color;
  ctx.globalAlpha = particle.opacity;
  
  // Draw cloud shape (multiple circles)
  const size = particle.size;
  ctx.beginPath();
  ctx.arc(particle.x, particle.y, size * 0.5, 0, Math.PI * 2);
  ctx.arc(particle.x + size * 0.4, particle.y - size * 0.1, size * 0.4, 0, Math.PI * 2);
  ctx.arc(particle.x + size * 0.8, particle.y, size * 0.35, 0, Math.PI * 2);
  ctx.arc(particle.x + size * 0.3, particle.y + size * 0.2, size * 0.35, 0, Math.PI * 2);
  ctx.fill();

  // Update position
  particle.x += particle.speed * deltaTime;
  if (particle.x > canvasWidth + particle.size) {
    particle.x = -particle.size * 2;
  }
}

function drawSunRay(
  ctx: CanvasRenderingContext2D,
  particle: Particle,
  color: string,
  time: number,
  canvasWidth: number,
  canvasHeight: number
) {
  const centerX = canvasWidth * 0.8;
  const centerY = canvasHeight * 0.12;
  const angle = (particle.angle || 0) + time * 0.0003;
  const distance = 80 + Math.sin(time * 0.001 + (particle.angle || 0)) * 20;

  const x = centerX + Math.cos(angle) * distance;
  const y = centerY + Math.sin(angle) * distance;

  ctx.fillStyle = color;
  ctx.globalAlpha = particle.opacity * (0.5 + Math.sin(time * 0.002) * 0.3);
  ctx.beginPath();
  ctx.arc(x, y, particle.size, 0, Math.PI * 2);
  ctx.fill();
}

export default WeatherBackground;
