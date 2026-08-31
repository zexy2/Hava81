import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useSettings,
  type TemperatureUnit,
  type WindSpeedUnit,
  type ThemeMode,
  type Language,
} from '../context';
import './SettingsPanel.css';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const AutoThemeIcon = () => (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
    <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7" />
    <path d="M15.5 15.8A6 6 0 0 1 8.2 8.5a5 5 0 1 0 7.3 7.3Z" />
  </svg>
);

const LightThemeIcon = () => (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" />
  </svg>
);

const DarkThemeIcon = () => (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
    <path d="M19.4 15.2A8 8 0 0 1 8.8 4.6 8 8 0 1 0 19.4 15.2Z" />
  </svg>
);

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
  const { t, i18n } = useTranslation();
  const { settings, updateSetting } = useSettings();
  const panelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const backgroundElements = Array.from(
      document.querySelectorAll<HTMLElement>('.app > :not(.settings-backdrop):not(.settings-panel)')
    );
    const previousInertState = backgroundElements.map(element => element.hasAttribute('inert'));
    backgroundElements.forEach(element => element.setAttribute('inert', ''));

    const focusFrame = window.requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusableElements = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter(element => element.getAttribute('aria-hidden') !== 'true');

      if (focusableElements.length === 0) {
        event.preventDefault();
        panelRef.current.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (
        event.shiftKey &&
        (activeElement === firstElement || !panelRef.current.contains(activeElement))
      ) {
        event.preventDefault();
        lastElement.focus();
      } else if (
        !event.shiftKey &&
        (activeElement === lastElement || !panelRef.current.contains(activeElement))
      ) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      backgroundElements.forEach((element, index) => {
        if (!previousInertState[index]) element.removeAttribute('inert');
      });
      previouslyFocusedRef.current?.focus();
    };
  }, [isOpen, onClose]);

  const handleLanguageChange = (lang: Language) => {
    updateSetting('language', lang);
    i18n.changeLanguage(lang);
  };

  return (
    <>
      {isOpen && (
        <>
          <div className="settings-backdrop" aria-hidden="true" onClick={onClose} />

          <aside
            ref={panelRef}
            className="settings-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-panel-title"
            tabIndex={-1}
          >
            <header className="settings-panel__header">
              <h2 id="settings-panel-title">{t('settings.title')}</h2>
              <button
                ref={closeButtonRef}
                type="button"
                className="settings-panel__close"
                onClick={onClose}
                aria-label={t('common.close')}
              >
                <svg
                  aria-hidden="true"
                  focusable="false"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
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
                    type="button"
                    className={`settings-option ${settings.language === 'tr' ? 'settings-option--active' : ''}`}
                    onClick={() => handleLanguageChange('tr')}
                    aria-pressed={settings.language === 'tr'}
                  >
                    <span className="settings-option__flag" aria-hidden="true">
                      TR
                    </span>
                    <span>Türkçe</span>
                  </button>
                  <button
                    type="button"
                    className={`settings-option ${settings.language === 'en' ? 'settings-option--active' : ''}`}
                    onClick={() => handleLanguageChange('en')}
                    aria-pressed={settings.language === 'en'}
                  >
                    <span className="settings-option__flag" aria-hidden="true">
                      EN
                    </span>
                    <span>English</span>
                  </button>
                </div>
              </section>

              {/* Temperature Unit */}
              <section className="settings-section">
                <h3 className="settings-section__title">{t('settings.units')}</h3>
                <div className="settings-option-group">
                  <button
                    type="button"
                    className={`settings-option ${settings.temperatureUnit === 'metric' ? 'settings-option--active' : ''}`}
                    onClick={() => updateSetting('temperatureUnit', 'metric' as TemperatureUnit)}
                    aria-pressed={settings.temperatureUnit === 'metric'}
                  >
                    <span className="settings-option__icon">°C</span>
                    <span>{t('settings.metric')}</span>
                  </button>
                  <button
                    type="button"
                    className={`settings-option ${settings.temperatureUnit === 'imperial' ? 'settings-option--active' : ''}`}
                    onClick={() => updateSetting('temperatureUnit', 'imperial' as TemperatureUnit)}
                    aria-pressed={settings.temperatureUnit === 'imperial'}
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
                    type="button"
                    className={`settings-option ${settings.windSpeedUnit === 'ms' ? 'settings-option--active' : ''}`}
                    onClick={() => updateSetting('windSpeedUnit', 'ms' as WindSpeedUnit)}
                    aria-pressed={settings.windSpeedUnit === 'ms'}
                  >
                    m/s
                  </button>
                  <button
                    type="button"
                    className={`settings-option ${settings.windSpeedUnit === 'kmh' ? 'settings-option--active' : ''}`}
                    onClick={() => updateSetting('windSpeedUnit', 'kmh' as WindSpeedUnit)}
                    aria-pressed={settings.windSpeedUnit === 'kmh'}
                  >
                    km/h
                  </button>
                  <button
                    type="button"
                    className={`settings-option ${settings.windSpeedUnit === 'mph' ? 'settings-option--active' : ''}`}
                    onClick={() => updateSetting('windSpeedUnit', 'mph' as WindSpeedUnit)}
                    aria-pressed={settings.windSpeedUnit === 'mph'}
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
                    type="button"
                    className={`settings-option ${settings.themeMode === 'auto' ? 'settings-option--active' : ''}`}
                    onClick={() => updateSetting('themeMode', 'auto' as ThemeMode)}
                    aria-pressed={settings.themeMode === 'auto'}
                  >
                    <span className="settings-option__icon" aria-hidden="true">
                      <AutoThemeIcon />
                    </span>
                    <span>{t('settings.auto')}</span>
                  </button>
                  <button
                    type="button"
                    className={`settings-option ${settings.themeMode === 'light' ? 'settings-option--active' : ''}`}
                    onClick={() => updateSetting('themeMode', 'light' as ThemeMode)}
                    aria-pressed={settings.themeMode === 'light'}
                  >
                    <span className="settings-option__icon" aria-hidden="true">
                      <LightThemeIcon />
                    </span>
                    <span>{t('settings.light')}</span>
                  </button>
                  <button
                    type="button"
                    className={`settings-option ${settings.themeMode === 'dark' ? 'settings-option--active' : ''}`}
                    onClick={() => updateSetting('themeMode', 'dark' as ThemeMode)}
                    aria-pressed={settings.themeMode === 'dark'}
                  >
                    <span className="settings-option__icon" aria-hidden="true">
                      <DarkThemeIcon />
                    </span>
                    <span>{t('settings.dark')}</span>
                  </button>
                </div>
              </section>
            </div>

            <footer className="settings-panel__footer">
              <p className="settings-panel__version">v2.1.0</p>
            </footer>
          </aside>
        </>
      )}
    </>
  );
};

export default SettingsPanel;
