// Translation tables live in per-language data modules (translations.en.js /
// .uz.js / .ru.js — auto-split 2026-08-12) so each ships as its own lazy
// chunk. The old single module put all three languages (1.6MB) into the main
// bundle and dominated its parse time.
//
// Loading model:
//  - Top-level await below blocks module evaluation until the persisted
//    language's table is in memory, so every existing `t()` call site stays
//    fully synchronous — no flash of raw keys anywhere.
//  - English is the fallback table for missing keys; when the active language
//    isn't English it loads in the background and announces itself with a
//    'translations:loaded' window event (LanguageContext listens and bumps its
//    context value so mounted components re-run their lookups).
//  - Switching languages must go through LanguageContext.setLanguage, which
//    awaits loadTranslations(lang) BEFORE flipping the language — so `t` never
//    sees a language whose table is absent.

const tables = {};
const pending = {};

const loaders = {
  en: () => import('./translations.en.js'),
  uz: () => import('./translations.uz.js'),
  ru: () => import('./translations.ru.js'),
};

export function loadTranslations(language) {
  const lang = loaders[language] ? language : 'uz';
  if (tables[lang]) return Promise.resolve(tables[lang]);
  if (!pending[lang]) {
    pending[lang] = loaders[lang]().then((m) => {
      tables[lang] = m.default;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('translations:loaded'));
      }
      return m.default;
    });
  }
  return pending[lang];
}

const initialLanguage = (() => {
  try {
    return localStorage.getItem('erp_language') || 'uz';
  } catch {
    return 'uz';
  }
})();

// Hold the module graph until the boot language is available (see note above).
await loadTranslations(initialLanguage);
if (initialLanguage !== 'en') loadTranslations('en');

export function useTranslation(language) {
  const t = (key) => {
    const langTranslations = tables[language] || tables.en || tables[initialLanguage] || {};
    return langTranslations[key] || (tables.en || {})[key] || key;
  };

  return { t };
}
