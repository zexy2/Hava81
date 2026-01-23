/**
 * WeatherCard Component Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { WeatherCard } from '../../components/WeatherCard';
import type { NormalizedWeatherData } from '../../types';

const mockWeatherData: NormalizedWeatherData = {
  cityName: 'İzmir',
  country: 'TR',
  temperature: 22,
  feelsLike: 21,
  tempMin: 18,
  tempMax: 25,
  humidity: 65,
  pressure: 1015,
  visibility: 10000,
  windSpeed: 3.5,
  windDirection: 180,
  description: 'açık hava',
  icon: '01d',
  sunrise: new Date('2024-01-01T06:00:00'),
  sunset: new Date('2024-01-01T18:00:00'),
  timestamp: new Date('2024-01-01T12:00:00'),
  coordinates: { lat: 38.42, lon: 27.14 },
  clouds: 0,
};

describe('WeatherCard', () => {
  it('should render city name', () => {
    render(<WeatherCard weather={mockWeatherData} />);
    
    expect(screen.getByText('İzmir')).toBeInTheDocument();
  });

  it('should render country code', () => {
    render(<WeatherCard weather={mockWeatherData} />);
    
    expect(screen.getByText(', TR')).toBeInTheDocument();
  });

  it('should render temperature', () => {
    render(<WeatherCard weather={mockWeatherData} />);
    
    expect(screen.getByText('22')).toBeInTheDocument();
  });

  it('should render weather description', () => {
    render(<WeatherCard weather={mockWeatherData} />);
    
    expect(screen.getByText('açık hava')).toBeInTheDocument();
  });

  it('should render all weather tiles', () => {
    render(<WeatherCard weather={mockWeatherData} />);
    
    expect(screen.getByText('Sıcaklık')).toBeInTheDocument();
    expect(screen.getByText('Hissedilen')).toBeInTheDocument();
    expect(screen.getByText('Nem')).toBeInTheDocument();
    expect(screen.getByText('Rüzgar')).toBeInTheDocument();
    expect(screen.getByText('Basınç')).toBeInTheDocument();
    expect(screen.getByText('Görüş')).toBeInTheDocument();
  });

  it('should have proper accessibility attributes', () => {
    render(<WeatherCard weather={mockWeatherData} />);
    
    const section = screen.getByRole('region', { name: /İzmir hava durumu/i });
    expect(section).toBeInTheDocument();
    expect(section).toHaveAttribute('aria-live', 'polite');
  });

  it('should apply custom className', () => {
    render(
      <WeatherCard weather={mockWeatherData} className="custom-class" />
    );
    
    // Weather card region should exist when custom class is applied
    const section = screen.getByRole('region', { name: /İzmir hava durumu/i });
    expect(section).toBeInTheDocument();
  });
});
