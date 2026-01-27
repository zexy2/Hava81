import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { tr } from './locales/tr';
import { en } from './locales/en';

// Get stored language or default to Turkish
const getStoredLanguage = (): string => {
  try {
    const stored = localStorage.getItem('app-language');
    return stored || 'tr';
  } catch {
    return 'tr';
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources: {
      tr: { translation: tr },
      en: { translation: en },
    },
    lng: getStoredLanguage(),
    fallbackLng: 'tr',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
  });

export default i18n;
