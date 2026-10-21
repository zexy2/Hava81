export type SupportedLanguage = 'tr' | 'en';

/**
 * Tarayıcı dil tercihlerinden ilk desteklenen dili seçer (Faz 0.7).
 * Desteklenen dil yoksa Türkçe döner.
 */
export const detectBrowserLanguage = (
  languages: readonly string[] | undefined = typeof navigator === 'undefined'
    ? undefined
    : navigator.languages?.length
      ? navigator.languages
      : [navigator.language]
): SupportedLanguage => {
  for (const raw of languages ?? []) {
    const code = String(raw ?? '').toLowerCase();
    if (code.startsWith('tr')) return 'tr';
    if (code.startsWith('en')) return 'en';
  }
  return 'tr';
};
