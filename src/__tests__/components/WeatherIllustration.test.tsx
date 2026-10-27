import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WeatherIllustration } from '../../components/hava81/WeatherIllustration';

describe('WeatherIllustration', () => {
  it('uses unique SVG gradient and shadow IDs across multiple weather cards', () => {
    const { container } = render(
      <>
        <WeatherIllustration code="02d" label="Parçalı bulutlu" />
        <WeatherIllustration code="02n" label="Parçalı bulutlu gece" />
      </>
    );
    const ids = Array.from(container.querySelectorAll('defs [id]'), el => el.id);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
    const referenced = Array.from(container.querySelectorAll('[fill^="url("], [filter^="url("]'));
    for (const element of referenced) {
      const reference = element.getAttribute('fill') || element.getAttribute('filter');
      const id = reference?.match(/^url\(#(.+)\)$/)?.[1];
      expect(id).toBeDefined();
      expect(ids).toContain(id);
    }
    expect(screen.getByRole('img', { name: 'Parçalı bulutlu' })).toHaveAttribute(
      'data-weather-code',
      '02d'
    );
    expect(screen.getByRole('img', { name: 'Parçalı bulutlu gece' })).toHaveAttribute(
      'data-weather-code',
      '02n'
    );
  });

  it('renders precipitation and mist only for relevant conditions', () => {
    // Rain is three separately animated drops; they appear only for rain.
    const { container, rerender } = render(<WeatherIllustration code="09d" label="Yağmur" />);
    expect(container.querySelectorAll('.wx-rain .wx-drop')).toHaveLength(3);

    rerender(<WeatherIllustration code="13d" label="Kar" />);
    expect(container.querySelector('circle[cx="57"][cy="119"]')).not.toBeNull();
    expect(container.querySelectorAll('.wx-drop')).toHaveLength(0);

    rerender(<WeatherIllustration code="50d" label="Sis" />);
    expect(container.querySelector('path[d="M25 45h100 M38 69h108 M14 94h110"]')).not.toBeNull();
    expect(container.querySelectorAll('.wx-drop')).toHaveLength(0);
  });
});
