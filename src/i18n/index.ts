import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { tr } from './locales/tr';
import { en } from './locales/en';
import { detectBrowserLanguage } from './detectLanguage';

// Stored language first, then the browser's preferred language, then Turkish
const getStoredLanguage = (): string => {
  try {
    const userSettings = localStorage.getItem('user-settings');
    if (userSettings) {
      const parsed = JSON.parse(userSettings) as { language?: unknown };
      if (parsed.language === 'tr' || parsed.language === 'en') return parsed.language;
    }

    const legacyLanguage = localStorage.getItem('app-language');
    if (legacyLanguage === 'en' || legacyLanguage === 'tr') return legacyLanguage;
    return detectBrowserLanguage();
  } catch {
    return detectBrowserLanguage();
  }
};

i18n.use(initReactI18next).init({
  resources: {
    tr: { translation: tr },
    en: { translation: en },
  },
  lng: getStoredLanguage(),
  fallbackLng: 'tr',
  debug: false,
  showSupportNotice: false,
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
});

export default i18n;
