import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useSettings, type TemperatureUnit, type WindSpeedUnit, type ThemeMode, type Language } from '../context';
import './SettingsPanel.css';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const backdropVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
} as const;

const panelVariants = {
  hidden: { x: '100%', opacity: 0 },
  visible: { 
    x: 0, 
    opacity: 1,
    transition: {
      type: 'spring' as const,
      damping: 25,
      stiffness: 300,
    }
  },
  exit: { 
    x: '100%', 
    opacity: 0,
    transition: {
      type: 'spring' as const,
      damping: 30,
      stiffness: 400,
    }
  },
} as const;

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
  const { t, i18n } = useTranslation();
  const { settings, updateSetting } = useSettings();

  const handleLanguageChange = (lang: Language) => {
    updateSetting('language', lang);
    i18n.changeLanguage(lang);
    localStorage.setItem('app-language', lang);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div 
            className="settings-backdrop"
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            onClick={onClose}
          />
          
          {/* Panel */}
          <motion.aside 
            className="settings-panel"
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            role="dialog"
            aria-label={t('settings.title')}
          >
            <header className="settings-panel__header">
              <h2>{t('settings.title')}</h2>
              <button 
                className="settings-panel__close"
                onClick={onClose}
                aria-label={t('common.close')}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </header>

            <div className="settings-panel__content">
              {/* Language Setting */}
              <section className="settings-section">
                <h3 className="settings-section__title">{t('settings.language')}</h3>
                <div className="settings-option-group">
                  <button 
                    className={`settings-option ${settings.language === 'tr' ? 'settings-option--active' : ''}`}
                    onClick={() => handleLanguageChange('tr')}
                  >
                    <span className="settings-option__flag">🇹🇷</span>
                    <span>Türkçe</span>
                  </button>
                  <button 
                    className={`settings-option ${settings.language === 'en' ? 'settings-option--active' : ''}`}
                    onClick={() => handleLanguageChange('en')}
                  >
                    <span className="settings-option__flag">🇬🇧</span>
                    <span>English</span>
                  </button>
                </div>
              </section>

              {/* Temperature Unit */}
              <section className="settings-section">
                <h3 className="settings-section__title">{t('settings.units')}</h3>
                <div className="settings-option-group">
                  <button 
                    className={`settings-option ${settings.temperatureUnit === 'metric' ? 'settings-option--active' : ''}`}
                    onClick={() => updateSetting('temperatureUnit', 'metric' as TemperatureUnit)}
                  >
                    <span className="settings-option__icon">°C</span>
                    <span>{t('settings.metric')}</span>
                  </button>
                  <button 
                    className={`settings-option ${settings.temperatureUnit === 'imperial' ? 'settings-option--active' : ''}`}
                    onClick={() => updateSetting('temperatureUnit', 'imperial' as TemperatureUnit)}
                  >
                    <span className="settings-option__icon">°F</span>
                    <span>{t('settings.imperial')}</span>
                  </button>
                </div>
              </section>

              {/* Wind Speed Unit */}
              <section className="settings-section">
                <h3 className="settings-section__title">{t('weather.windSpeed')}</h3>
                <div className="settings-option-group settings-option-group--three">
                  <button 
                    className={`settings-option ${settings.windSpeedUnit === 'ms' ? 'settings-option--active' : ''}`}
                    onClick={() => updateSetting('windSpeedUnit', 'ms' as WindSpeedUnit)}
                  >
                    m/s
                  </button>
                  <button 
                    className={`settings-option ${settings.windSpeedUnit === 'kmh' ? 'settings-option--active' : ''}`}
                    onClick={() => updateSetting('windSpeedUnit', 'kmh' as WindSpeedUnit)}
                  >
                    km/h
                  </button>
                  <button 
                    className={`settings-option ${settings.windSpeedUnit === 'mph' ? 'settings-option--active' : ''}`}
                    onClick={() => updateSetting('windSpeedUnit', 'mph' as WindSpeedUnit)}
                  >
                    mph
                  </button>
                </div>
              </section>

              {/* Theme Mode */}
              <section className="settings-section">
                <h3 className="settings-section__title">{t('settings.theme')}</h3>
                <div className="settings-option-group settings-option-group--three">
                  <button 
                    className={`settings-option ${settings.themeMode === 'auto' ? 'settings-option--active' : ''}`}
                    onClick={() => updateSetting('themeMode', 'auto' as ThemeMode)}
                  >
                    <span className="settings-option__icon">🌤</span>
                    <span>{t('settings.auto')}</span>
                  </button>
                  <button 
                    className={`settings-option ${settings.themeMode === 'light' ? 'settings-option--active' : ''}`}
                    onClick={() => updateSetting('themeMode', 'light' as ThemeMode)}
                  >
                    <span className="settings-option__icon">☀️</span>
                    <span>{t('settings.light')}</span>
                  </button>
                  <button 
                    className={`settings-option ${settings.themeMode === 'dark' ? 'settings-option--active' : ''}`}
                    onClick={() => updateSetting('themeMode', 'dark' as ThemeMode)}
                  >
                    <span className="settings-option__icon">🌙</span>
                    <span>{t('settings.dark')}</span>
                  </button>
                </div>
              </section>

              {/* Notifications Toggle */}
              <section className="settings-section">
                <h3 className="settings-section__title">{t('settings.notifications')}</h3>
                <label className="settings-toggle">
                  <span className="settings-toggle__text">
                    {t('settings.enableNotifications')}
                    <small>{t('settings.notificationDesc')}</small>
                  </span>
                  <input 
                    type="checkbox" 
                    checked={settings.notificationsEnabled}
                    onChange={(e) => updateSetting('notificationsEnabled', e.target.checked)}
                  />
                  <span className="settings-toggle__slider" />
                </label>
              </section>
            </div>

            <footer className="settings-panel__footer">
              <p className="settings-panel__version">v2.0.0</p>
            </footer>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};

export default SettingsPanel;
