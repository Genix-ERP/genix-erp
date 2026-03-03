import { useMemo } from 'react';
import { useAdminSettings } from '@/components/contexts/AdminSettingsContext';
import { useLanguage } from '@/components/contexts/LanguageContext';
import { createCurrencyFormatter, createCompactCurrencyFormatter } from '@/utils/formatCurrency';

export function useCurrencyFormatter() {
  const { getSetting } = useAdminSettings();
  const { language } = useLanguage();

  const currency = getSetting('general.localization.currency', 'UZS');
  const currency_symbol = getSetting('general.localization.currency_symbol', "so'm");
  const currency_position = getSetting('general.localization.currency_position', 'after');
  const decimal_separator = getSetting('general.localization.decimal_separator', ',');
  const thousands_separator = getSetting('general.localization.thousands_separator', ' ');

  const formatCurrency = useMemo(
    () => createCurrencyFormatter({
      currency,
      currency_symbol,
      currency_position,
      decimal_separator,
      thousands_separator,
    }),
    [currency, currency_symbol, currency_position, decimal_separator, thousands_separator]
  );

  // Compact formatter for large numbers (e.g., 5.2 mlrd, 10 mln)
  const formatCurrencyCompact = useMemo(
    () => createCompactCurrencyFormatter({
      currency,
      currency_symbol,
      currency_position,
      locale: language === 'en' ? 'en' : 'uz',
    }),
    [currency, currency_symbol, currency_position, language]
  );

  return { formatCurrency, formatCurrencyCompact };
}
