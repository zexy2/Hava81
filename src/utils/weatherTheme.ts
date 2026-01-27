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
  cardBorder: string;
  cardShadow: string;
  textPrimary: string;
  textSecondary: string;
  skeleton: string;
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
    gradient: 'linear-gradient(135deg, #7dd3fc 0%, #38bdf8 50%, #0ea5e9 100%)',
    gradientOverlay: 'radial-gradient(circle at 20% 20%, rgba(255, 253, 230, 0.4) 0%, transparent 40%)',
    accent: '#f59e0b',
    accentLight: '#fbbf24',
    cardBg: 'rgba(255, 255, 255, 0.5)',
    cardBorder: 'rgba(255, 255, 255, 0.4)',
    cardShadow: '0 20px 40px rgba(0, 0, 0, 0.05)',
    textPrimary: '#0f172a',
    textSecondary: 'rgba(15, 23, 42, 0.7)',
    skeleton: 'rgba(0, 0, 0, 0.05)',
    particleColor: 'rgba(255, 251, 235, 0.9)',
  },
  'clear-night': {
    gradient: 'linear-gradient(135deg, #020617 0%, #0f172a 100%)',
    gradientOverlay: 'radial-gradient(circle at 80% 20%, rgba(99, 102, 241, 0.1) 0%, transparent 40%)',
    accent: '#818cf8',
    accentLight: '#a5b4fc',
    cardBg: 'rgba(15, 23, 42, 0.6)',
    cardBorder: 'rgba(255, 255, 255, 0.05)',
    cardShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
    textPrimary: '#f8fafc',
    textSecondary: 'rgba(248, 250, 252, 0.6)',
    skeleton: 'rgba(255, 255, 255, 0.05)',
    particleColor: 'rgba(255, 255, 255, 0.8)',
  },
  'cloudy': {
    gradient: 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)',
    gradientOverlay: 'linear-gradient(180deg, rgba(255,255,255,0.1) 0%, transparent 100%)',
    accent: '#475569',
    accentLight: '#64748b',
    cardBg: 'rgba(255, 255, 255, 0.4)',
    cardBorder: 'rgba(255, 255, 255, 0.2)',
    cardShadow: '0 15px 30px rgba(0, 0, 0, 0.1)',
    textPrimary: '#1e293b',
    textSecondary: 'rgba(30, 41, 59, 0.7)',
    skeleton: 'rgba(0, 0, 0, 0.05)',
    particleColor: 'rgba(241, 245, 249, 0.6)',
  },
  'overcast': {
    gradient: 'linear-gradient(135deg, #334155 0%, #1e293b 100%)',
    gradientOverlay: 'none',
    accent: '#94a3b8',
    accentLight: '#cbd5e1',
    cardBg: 'rgba(30, 41, 59, 0.5)',
    cardBorder: 'rgba(255, 255, 255, 0.05)',
    cardShadow: '0 15px 30px rgba(0, 0, 0, 0.3)',
    textPrimary: '#f1f5f9',
    textSecondary: 'rgba(241, 245, 249, 0.6)',
    skeleton: 'rgba(255, 255, 255, 0.05)',
    particleColor: 'rgba(148, 163, 184, 0.5)',
  },
  'rain': {
    gradient: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
    gradientOverlay: 'radial-gradient(circle at 50% 0%, rgba(59, 130, 246, 0.1) 0%, transparent 100%)',
    accent: '#3b82f6',
    accentLight: '#60a5fa',
    cardBg: 'rgba(15, 23, 42, 0.7)',
    cardBorder: 'rgba(59, 130, 246, 0.1)',
    cardShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
    textPrimary: '#f0f9ff',
    textSecondary: 'rgba(240, 249, 255, 0.6)',
    skeleton: 'rgba(255, 255, 255, 0.05)',
    particleColor: 'rgba(186, 230, 253, 0.6)',
  },
  'thunderstorm': {
    gradient: 'linear-gradient(135deg, #020617 0%, #2e1065 100%)',
    gradientOverlay: 'none',
    accent: '#a855f7',
    accentLight: '#c084fc',
    cardBg: 'rgba(30, 41, 59, 0.7)',
    cardBorder: 'rgba(168, 85, 247, 0.1)',
    cardShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
    textPrimary: '#faf5ff',
    textSecondary: 'rgba(250, 245, 255, 0.6)',
    skeleton: 'rgba(255, 255, 255, 0.05)',
    particleColor: 'rgba(216, 180, 254, 0.7)',
  },
  'snow': {
    gradient: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
    gradientOverlay: 'radial-gradient(circle at 50% 0%, rgba(255, 255, 255, 1) 0%, transparent 60%)',
    accent: '#475569',
    accentLight: '#64748b',
    cardBg: 'rgba(255, 255, 255, 0.8)',
    cardBorder: 'rgba(255, 255, 255, 0.5)',
    cardShadow: '0 15px 30px rgba(0, 0, 0, 0.05)',
    textPrimary: '#0f172a',
    textSecondary: 'rgba(15, 23, 42, 0.7)',
    skeleton: 'rgba(0, 0, 0, 0.05)',
    particleColor: 'rgba(255, 255, 255, 1)',
  },
  'mist': {
    gradient: 'linear-gradient(135deg, #cbd5e1 0%, #94a3b8 100%)',
    gradientOverlay: 'none',
    accent: '#475569',
    accentLight: '#64748b',
    cardBg: 'rgba(255, 255, 255, 0.5)',
    cardBorder: 'rgba(255, 255, 255, 0.3)',
    cardShadow: '0 15px 30px rgba(0, 0, 0, 0.1)',
    textPrimary: '#0f172a',
    textSecondary: 'rgba(15, 23, 42, 0.7)',
    skeleton: 'rgba(0, 0, 0, 0.05)',
    particleColor: 'rgba(255, 255, 255, 0.8)',
  },
  'default': {
    gradient: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
    gradientOverlay: 'none',
    accent: '#6366f1',
    accentLight: '#818cf8',
    cardBg: 'rgba(255, 255, 255, 0.05)',
    cardBorder: 'rgba(255, 255, 255, 0.1)',
    cardShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
    textPrimary: '#ffffff',
    textSecondary: 'rgba(255, 255, 255, 0.6)',
    skeleton: 'rgba(255, 255, 255, 0.05)',
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
  root.style.setProperty('--theme-card-border', colors.cardBorder);
  root.style.setProperty('--theme-card-shadow', colors.cardShadow);
  root.style.setProperty('--theme-text-primary', colors.textPrimary);
  root.style.setProperty('--theme-text-secondary', colors.textSecondary);
  root.style.setProperty('--theme-skeleton', colors.skeleton);
  root.style.setProperty('--theme-particle-color', colors.particleColor);
}

export default getWeatherTheme;
