/**
 * Weather Theme System
 * Determines colors, gradients, and effects based on weather conditions
 */

export type WeatherTheme = 
  | 'clear-day'
  | 'clear-night'
  | 'cloudy'
  | 'overcast'
  | 'rain'
  | 'thunderstorm'
  | 'snow'
  | 'mist'
  | 'default';

export interface ThemeColors {
  gradient: string;
  gradientOverlay: string;
  accent: string;
  accentLight: string;
  cardBg: string;
  textPrimary: string;
  textSecondary: string;
  particleColor: string;
}

export interface ThemeConfig {
  theme: WeatherTheme;
  colors: ThemeColors;
  particleType: 'none' | 'rain' | 'snow' | 'stars' | 'clouds' | 'sun';
  particleCount: number;
  isNight: boolean;
}

// Weather icon to theme mapping
const iconToTheme: Record<string, WeatherTheme> = {
  '01d': 'clear-day',
  '01n': 'clear-night',
  '02d': 'cloudy',
  '02n': 'cloudy',
  '03d': 'cloudy',
  '03n': 'cloudy',
  '04d': 'overcast',
  '04n': 'overcast',
  '09d': 'rain',
  '09n': 'rain',
  '10d': 'rain',
  '10n': 'rain',
  '11d': 'thunderstorm',
  '11n': 'thunderstorm',
  '13d': 'snow',
  '13n': 'snow',
  '50d': 'mist',
  '50n': 'mist',
};

// Theme color configurations
const themeColors: Record<WeatherTheme, ThemeColors> = {
  'clear-day': {
    gradient: 'linear-gradient(180deg, #4facfe 0%, #00f2fe 50%, #87ceeb 100%)',
    gradientOverlay: 'radial-gradient(circle at 30% 20%, rgba(255, 236, 179, 0.4) 0%, transparent 50%)',
    accent: '#fbbf24',
    accentLight: '#fcd34d',
    cardBg: 'rgba(255, 255, 255, 0.15)',
    textPrimary: '#1e293b',
    textSecondary: 'rgba(30, 41, 59, 0.7)',
    particleColor: 'rgba(255, 236, 179, 0.8)',
  },
  'clear-night': {
    gradient: 'linear-gradient(180deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
    gradientOverlay: 'radial-gradient(circle at 70% 30%, rgba(147, 197, 253, 0.1) 0%, transparent 50%)',
    accent: '#818cf8',
    accentLight: '#a5b4fc',
    cardBg: 'rgba(255, 255, 255, 0.05)',
    textPrimary: '#f8fafc',
    textSecondary: 'rgba(248, 250, 252, 0.6)',
    particleColor: 'rgba(255, 255, 255, 0.8)',
  },
  'cloudy': {
    gradient: 'linear-gradient(180deg, #536976 0%, #292e49 100%)',
    gradientOverlay: 'radial-gradient(circle at 50% 30%, rgba(148, 163, 184, 0.2) 0%, transparent 60%)',
    accent: '#94a3b8',
    accentLight: '#cbd5e1',
    cardBg: 'rgba(255, 255, 255, 0.08)',
    textPrimary: '#f1f5f9',
    textSecondary: 'rgba(241, 245, 249, 0.6)',
    particleColor: 'rgba(203, 213, 225, 0.6)',
  },
  'overcast': {
    gradient: 'linear-gradient(180deg, #373b44 0%, #4286f4 100%)',
    gradientOverlay: 'radial-gradient(circle at 40% 40%, rgba(100, 116, 139, 0.3) 0%, transparent 50%)',
    accent: '#64748b',
    accentLight: '#94a3b8',
    cardBg: 'rgba(255, 255, 255, 0.06)',
    textPrimary: '#e2e8f0',
    textSecondary: 'rgba(226, 232, 240, 0.6)',
    particleColor: 'rgba(148, 163, 184, 0.5)',
  },
  'rain': {
    gradient: 'linear-gradient(180deg, #1e3a5f 0%, #0d253f 50%, #051225 100%)',
    gradientOverlay: 'radial-gradient(circle at 60% 50%, rgba(59, 130, 246, 0.15) 0%, transparent 50%)',
    accent: '#3b82f6',
    accentLight: '#60a5fa',
    cardBg: 'rgba(255, 255, 255, 0.05)',
    textPrimary: '#e0f2fe',
    textSecondary: 'rgba(224, 242, 254, 0.6)',
    particleColor: 'rgba(147, 197, 253, 0.6)',
  },
  'thunderstorm': {
    gradient: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)',
    gradientOverlay: 'radial-gradient(circle at 50% 50%, rgba(139, 92, 246, 0.1) 0%, transparent 60%)',
    accent: '#8b5cf6',
    accentLight: '#a78bfa',
    cardBg: 'rgba(255, 255, 255, 0.04)',
    textPrimary: '#e9d5ff',
    textSecondary: 'rgba(233, 213, 255, 0.6)',
    particleColor: 'rgba(167, 139, 250, 0.7)',
  },
  'snow': {
    gradient: 'linear-gradient(180deg, #e6e9f0 0%, #c4d4e8 50%, #a8c0d8 100%)',
    gradientOverlay: 'radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.5) 0%, transparent 50%)',
    accent: '#6366f1',
    accentLight: '#818cf8',
    cardBg: 'rgba(255, 255, 255, 0.25)',
    textPrimary: '#1e293b',
    textSecondary: 'rgba(30, 41, 59, 0.7)',
    particleColor: 'rgba(255, 255, 255, 0.9)',
  },
  'mist': {
    gradient: 'linear-gradient(180deg, #606c88 0%, #3f4c6b 100%)',
    gradientOverlay: 'radial-gradient(circle at 50% 50%, rgba(148, 163, 184, 0.3) 0%, transparent 70%)',
    accent: '#94a3b8',
    accentLight: '#cbd5e1',
    cardBg: 'rgba(255, 255, 255, 0.1)',
    textPrimary: '#f1f5f9',
    textSecondary: 'rgba(241, 245, 249, 0.6)',
    particleColor: 'rgba(203, 213, 225, 0.4)',
  },
  'default': {
    gradient: 'linear-gradient(180deg, #1e1e3f 0%, #0f0f1a 100%)',
    gradientOverlay: 'radial-gradient(circle at 30% 20%, rgba(99, 102, 241, 0.08) 0%, transparent 50%)',
    accent: '#6366f1',
    accentLight: '#818cf8',
    cardBg: 'rgba(255, 255, 255, 0.03)',
    textPrimary: '#ffffff',
    textSecondary: 'rgba(255, 255, 255, 0.6)',
    particleColor: 'rgba(99, 102, 241, 0.5)',
  },
};

// Particle configuration per theme
const particleConfig: Record<WeatherTheme, { type: ThemeConfig['particleType']; count: number }> = {
  'clear-day': { type: 'sun', count: 12 },
  'clear-night': { type: 'stars', count: 80 },
  'cloudy': { type: 'clouds', count: 5 },
  'overcast': { type: 'clouds', count: 8 },
  'rain': { type: 'rain', count: 100 },
  'thunderstorm': { type: 'rain', count: 150 },
  'snow': { type: 'snow', count: 60 },
  'mist': { type: 'clouds', count: 10 },
  'default': { type: 'none', count: 0 },
};

/**
 * Get theme configuration based on weather icon code
 */
export function getWeatherTheme(iconCode?: string): ThemeConfig {
  const theme = iconCode ? (iconToTheme[iconCode] || 'default') : 'default';
  const isNight = iconCode?.endsWith('n') || false;
  const colors = themeColors[theme];
  const particles = particleConfig[theme];

  return {
    theme,
    colors,
    particleType: particles.type,
    particleCount: particles.count,
    isNight,
  };
}

/**
 * Apply theme colors to CSS custom properties
 */
export function applyThemeToDOM(config: ThemeConfig): void {
  const root = document.documentElement;
  const { colors } = config;

  root.style.setProperty('--theme-gradient', colors.gradient);
  root.style.setProperty('--theme-gradient-overlay', colors.gradientOverlay);
  root.style.setProperty('--theme-accent', colors.accent);
  root.style.setProperty('--theme-accent-light', colors.accentLight);
  root.style.setProperty('--theme-card-bg', colors.cardBg);
  root.style.setProperty('--theme-text-primary', colors.textPrimary);
  root.style.setProperty('--theme-text-secondary', colors.textSecondary);
  root.style.setProperty('--theme-particle-color', colors.particleColor);
}

export default getWeatherTheme;
