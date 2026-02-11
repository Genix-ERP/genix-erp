export const CURRENCY_SYMBOLS = {
  UZS: "so'm",
  USD: '$',
  EUR: '€',
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
      ? (overrideCurrencyCode === 'USD' || overrideCurrencyCode === 'EUR' ? 'before' : 'after')
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
