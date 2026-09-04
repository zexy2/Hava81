import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WeatherSymbol } from '../../components/hava81/WeatherSymbol';

describe('WeatherSymbol', () => {
  it('uses a neutral unknown glyph instead of inventing cloudy conditions for unsupported codes', () => {
    const { container } = render(<WeatherSymbol code="99x" label="Bilinmeyen hava durumu" />);

    expect(screen.getByRole('img', { name: 'Bilinmeyen hava durumu' })).toBeInTheDocument();
    expect(container.querySelector('circle[cx="24"][cy="24"][r="15"]')).toBeInTheDocument();
    expect(
      container.querySelector('path[d^="M13 33h22a7 7 0 0 0"]')
    ).not.toBeInTheDocument();
  });
});
