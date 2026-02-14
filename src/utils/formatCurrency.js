export const CURRENCY_SYMBOLS = {
  UZS: "so'm",
  USD: '$',
  RUB: '₽',
};

export function formatAmount(amount, options = {}) {
  const {
    symbol = "so'm",
    position = 'after',
    decimalSeparator = ',',
    thousandsSeparator = ' ',
    decimals = 0,
  } = options;

  const num = Number(amount) || 0;
  const isNegative = num < 0;
  const absNum = Math.abs(num);

  const fixed = absNum.toFixed(decimals);
  const [intPart, decPart] = fixed.split('.');

  const withThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSeparator);

  let formatted = withThousands;
  if (decimals > 0 && decPart) {
    formatted += decimalSeparator + decPart;
  }

  if (isNegative) {
    formatted = '-' + formatted;
  }

  if (position === 'before') {
    return symbol + formatted;
  }
  return formatted + ' ' + symbol;
}

// Compact format for large numbers (e.g., 5.2 mlrd, 10 mln)
export function formatCompactNumber(amount, options = {}) {
  const {
    symbol = "so'm",
    position = 'after',
    locale = 'uz', // 'uz' for Uzbek, 'en' for English
  } = options;

  const num = Number(amount) || 0;
  const isNegative = num < 0;
  const absNum = Math.abs(num);

  // Define thresholds and suffixes
  const suffixes = locale === 'uz'
    ? { billion: 'mlrd', million: 'mln', thousand: 'ming' }
    : { billion: 'B', million: 'M', thousand: 'K' };

  let formatted;
  let suffix = '';

  if (absNum >= 1_000_000_000) {
    // Billions (mlrd)
    const value = absNum / 1_000_000_000;
    formatted = value >= 10 ? Math.round(value).toString() : value.toFixed(1).replace(/\.0$/, '');
    suffix = ' ' + suffixes.billion;
  } else if (absNum >= 1_000_000) {
    // Millions (mln)
    const value = absNum / 1_000_000;
    formatted = value >= 10 ? Math.round(value).toString() : value.toFixed(1).replace(/\.0$/, '');
    suffix = ' ' + suffixes.million;
  } else if (absNum >= 10_000) {
    // Thousands (ming) - only for very large thousands
    const value = absNum / 1_000;
    formatted = Math.round(value).toString();
    suffix = ' ' + suffixes.thousand;
  } else {
    // Regular formatting with thousands separator
    formatted = Math.round(absNum).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  }

  if (isNegative) {
    formatted = '-' + formatted;
  }

  // Add suffix and symbol
  const valueWithSuffix = formatted + suffix;

  if (position === 'before') {
    return symbol + valueWithSuffix;
  }
  return valueWithSuffix + ' ' + symbol;
}

export function createCurrencyFormatter(settings = {}) {
  const {
    currency = 'UZS',
    currency_symbol = "so'm",
    currency_position = 'after',
    decimal_separator = ',',
    thousands_separator = ' ',
  } = settings;

  return function formatCurrency(amount, overrideCurrencyCode = null) {
    const code = overrideCurrencyCode || currency;
    const sym = overrideCurrencyCode
      ? (CURRENCY_SYMBOLS[overrideCurrencyCode] || overrideCurrencyCode)
      : currency_symbol;

    const pos = overrideCurrencyCode && overrideCurrencyCode !== currency
      ? (overrideCurrencyCode === 'USD' ? 'before' : 'after')
      : currency_position;

    const decimals = (code === 'UZS' || code === 'RUB') ? 0 : 2;

    return formatAmount(amount, {
      symbol: sym,
      position: pos,
      decimalSeparator: decimal_separator,
      thousandsSeparator: thousands_separator,
      decimals,
    });
  };
}

// Create a compact currency formatter
export function createCompactCurrencyFormatter(settings = {}) {
  const {
    currency = 'UZS',
    currency_symbol = "so'm",
    currency_position = 'after',
    locale = 'uz',
  } = settings;

  return function formatCurrencyCompact(amount, overrideCurrencyCode = null) {
    const sym = overrideCurrencyCode
      ? (CURRENCY_SYMBOLS[overrideCurrencyCode] || overrideCurrencyCode)
      : currency_symbol;

    const pos = overrideCurrencyCode && overrideCurrencyCode !== currency
      ? (overrideCurrencyCode === 'USD' ? 'before' : 'after')
      : currency_position;

    return formatCompactNumber(amount, {
      symbol: sym,
      position: pos,
      locale,
    });
  };
}
