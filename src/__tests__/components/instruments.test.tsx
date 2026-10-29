import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  AqiScale,
  SunArc,
  WindCompass,
} from '../../components/hava81/instruments/EnvironmentInstruments';
import { ScoreGauge } from '../../components/hava81/instruments/ScoreGauge';
import { TurkeyLocator } from '../../components/hava81/instruments/TurkeyLocator';
import { projectTurkey } from '../../components/hava81/instruments/turkeyOutline';

describe('environment instruments', () => {
  it('places cities across Türkiye by longitude and latitude', () => {
    expect(projectTurkey(26, 42.15)).toEqual({ x: 0, y: 0 });
    const istanbul = projectTurkey(28.97, 41.01);
    const van = projectTurkey(43.38, 38.5);
    expect(istanbul.x).toBeCloseTo(0.156, 2);
    expect(van.x).toBeGreaterThan(0.85);
    expect(van.y).toBeGreaterThan(istanbul.y);
  });

  it('clamps the city dot inside the outline', () => {
    const { container } = render(<TurkeyLocator lat={50} lon={10} />);
    const dot = container.querySelector('[data-city-dot]');
    expect(dot).toHaveAttribute('data-x', '0.000');
    expect(dot).toHaveAttribute('data-y', '0.000');
  });

  it('puts the sun at the elapsed share of daylight', () => {
    const { container, rerender } = render(<SunArc progress={0.5} night={false} />);
    expect(container.querySelector('[data-sun-position]')).toHaveAttribute(
      'data-sun-position',
      '0.500'
    );
    rerender(<SunArc progress={1.7} night />);
    const sun = container.querySelector('[data-sun-position]');
    expect(sun).toHaveAttribute('data-sun-position', '1.000');
    expect(sun).toHaveAttribute('data-night', 'true');
  });

  it('rotates the wind needle to the reported direction and hides it without data', () => {
    const { container, rerender } = render(<WindCompass direction={-90} active />);
    expect(container.querySelector('[data-wind-arrow]')).toHaveAttribute('data-rotation', '270');
    rerender(<WindCompass direction={0} active={false} />);
    expect(container.querySelector('[data-wind-arrow]')).toBeNull();
  });

  it('lights exactly the current air-quality step', () => {
    const { container, rerender } = render(<AqiScale aqi={3} />);
    expect(container.querySelectorAll('[data-active="true"]')).toHaveLength(1);
    expect(container.querySelector('[data-active="true"]')).toHaveAttribute(
      'data-aqi-segment',
      '3'
    );
    expect(container.querySelectorAll('[data-passed="true"]')).toHaveLength(2);
    rerender(<AqiScale aqi={null} />);
    expect(container.querySelectorAll('[data-active="true"]')).toHaveLength(0);
  });
});

describe('ScoreGauge', () => {
  it('draws a labelled 21-tick scale and lights ticks up to the score', () => {
    const { container } = render(<ScoreGauge score={50} band="good" label="Skor 50" />);
    const svg = container.querySelector('svg[role="img"]');
    expect(svg).toHaveAttribute('aria-label', 'Skor 50');
    expect(container.querySelectorAll('[data-gauge-tick]')).toHaveLength(21);
    expect(container.querySelectorAll('[data-gauge-tick][data-lit="true"]')).toHaveLength(11);
  });

  it('clamps out-of-range scores', () => {
    const { container } = render(<ScoreGauge score={140} band="good" label="x" />);
    expect(container.querySelectorAll('[data-gauge-tick][data-lit="true"]')).toHaveLength(21);
  });
});
