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

// Format number for chart axis ticks (no currency symbol, just abbreviated number)
export function formatAxisTick(value) {
  const num = Number(value) || 0;
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return sign + (abs / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + ' mlrd';
  if (abs >= 1_000_000) return sign + (abs / 1_000_000).toFixed(1).replace(/\.0$/, '') + ' mln';
  if (abs >= 1_000) return sign + (abs / 1_000).toFixed(1).replace(/\.0$/, '') + ' ming';
  return num.toString();
}

// Format large numbers compactly with abbreviations (mln, mlrd, ming)
export function formatCompactNumber(amount, options = {}) {
  const {
    symbol = "so'm",
    position = 'after',
  } = options;

  const num = Number(amount) || 0;
  const isNegative = num < 0;
  const absNum = Math.abs(num);

  let formatted;
  if (absNum >= 1_000_000_000) {
    const val = absNum / 1_000_000_000;
    formatted = (val % 1 === 0 ? val.toFixed(0) : val.toFixed(1).replace(/\.0$/, '')) + ' mlrd';
  } else if (absNum >= 1_000_000) {
    const val = absNum / 1_000_000;
    formatted = (val % 1 === 0 ? val.toFixed(0) : val.toFixed(1).replace(/\.0$/, '')) + ' mln';
  } else if (absNum >= 1_000) {
    const val = absNum / 1_000;
    formatted = (val % 1 === 0 ? val.toFixed(0) : val.toFixed(1).replace(/\.0$/, '')) + ' ming';
  } else {
    formatted = Math.round(absNum).toString();
  }

  if (isNegative) {
    formatted = '-' + formatted;
  }

  if (position === 'before') {
    return symbol + formatted;
  }
  return formatted + ' ' + symbol;
}

// Format a raw number string for display in price inputs (adds thousands separators)
export function formatPriceInput(value) {
  if (value === '' || value === null || value === undefined) return '';
  const str = String(value);
  const parts = str.split('.');
  const intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  if (parts.length > 1) return intPart + '.' + parts[1];
  return intPart;
}

// Parse a formatted price input back to a raw number string (strips formatting)
export function parsePriceInput(rawValue) {
  const cleaned = rawValue.replace(/[^\d.]/g, '');
  const dotIndex = cleaned.indexOf('.');
  return dotIndex >= 0
    ? cleaned.slice(0, dotIndex + 1) + cleaned.slice(dotIndex + 1).replace(/\./g, '')
    : cleaned;
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

// Create a compact currency formatter (uses full numbers with thousands separators)
export function createCompactCurrencyFormatter(settings = {}) {
  const {
    currency = 'UZS',
    currency_symbol = "so'm",
    currency_position = 'after',
  } = settings;

  // Use full formatter instead of abbreviated (mln/mlrd) format
  const fullFormatter = createCurrencyFormatter({
    currency,
    currency_symbol,
    currency_position,
  });

  return function formatCurrencyCompact(amount, overrideCurrencyCode = null) {
    return fullFormatter(amount, overrideCurrencyCode);
  };
}
