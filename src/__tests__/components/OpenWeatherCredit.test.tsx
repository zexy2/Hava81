/**
 * #1711: OpenWeather's free plan asks for the visible text, a link and the logo together.
 *
 * FROZEN: written before the implementation and not edited afterwards. If a check is wrong,
 * raise it with the owner instead of changing it.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OpenWeatherCredit } from '../../components/app/DataCredits';

describe('OpenWeatherCredit', () => {
  it('#1711 shows the required phrase as visible text inside the logo link', () => {
    render(<OpenWeatherCredit />);
    const text = screen.getByText('Weather data provided by OpenWeather');
    const link = text.closest('a');
    expect(link).toHaveAttribute('href', expect.stringMatching(/openweathermap\.org/));
    expect(link?.querySelector('img[alt="OpenWeather"]')).not.toBeNull();
    expect(text).not.toHaveClass('visually-hidden');
    expect(text).not.toHaveClass('sr-only');
  });
});
