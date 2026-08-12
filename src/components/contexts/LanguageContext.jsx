import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { loadTranslations } from '@/components/utils/translations';

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('erp_language') || 'uz';
    }
    return 'uz';
  });
  // Bumped when a translation table arrives after mount (the background
  // English fallback, mainly) so consumers re-run their t() lookups.
  const [tablesVersion, setTablesVersion] = useState(0);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('erp_language', language);
    }
  }, [language]);

  useEffect(() => {
    const bump = () => setTablesVersion((v) => v + 1);
    window.addEventListener('translations:loaded', bump);
    return () => window.removeEventListener('translations:loaded', bump);
  }, []);

  // The table must be in memory BEFORE the language flips, so every t() call
  // stays synchronous and there is never a flash of raw keys.
  const setLanguage = useCallback((lang) => {
    loadTranslations(lang).then(() => setLanguageState(lang));
  }, []);

  const value = useMemo(
    () => ({ language, setLanguage }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [language, setLanguage, tablesVersion]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
