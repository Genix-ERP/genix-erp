import { describe, it, expect } from 'vitest';
import {
  CURRENCY_SYMBOLS,
  formatAmount,
  formatAxisTick,
  formatCompactNumber,
  formatPriceInput,
  parsePriceInput,
  createCurrencyFormatter,
  createCompactCurrencyFormatter,
} from '../formatCurrency';

// ─── CURRENCY_SYMBOLS ────────────────────────────────────────────

describe('CURRENCY_SYMBOLS', () => {
  it('contains expected currency symbols', () => {
    expect(CURRENCY_SYMBOLS.UZS).toBe("so'm");
    expect(CURRENCY_SYMBOLS.USD).toBe('$');
    expect(CURRENCY_SYMBOLS.RUB).toBe('₽');
  });
});

// ─── formatAmount ────────────────────────────────────────────────

describe('formatAmount', () => {
  describe('basic formatting with defaults', () => {
    it('formats zero', () => {
      expect(formatAmount(0)).toBe("0 so'm");
    });

    it('formats a small integer', () => {
      expect(formatAmount(500)).toBe("500 so'm");
    });

    it('formats with thousands separators', () => {
      expect(formatAmount(1000)).toBe("1 000 so'm");
      expect(formatAmount(12345)).toBe("12 345 so'm");
      expect(formatAmount(1234567)).toBe("1 234 567 so'm");
    });

    it('formats large numbers', () => {
      expect(formatAmount(1000000000)).toBe("1 000 000 000 so'm");
    });
  });

  describe('negative numbers', () => {
    it('formats negative amounts with a leading minus', () => {
      expect(formatAmount(-500)).toBe("-500 so'm");
      expect(formatAmount(-12345)).toBe("-12 345 so'm");
    });
  });

  describe('decimal handling', () => {
    it('rounds to 0 decimals by default', () => {
      expect(formatAmount(1234.567)).toBe("1 235 so'm");
    });

    it('respects custom decimals option', () => {
      expect(formatAmount(1234.5, { decimals: 2 })).toBe("1 234,50 so'm");
    });

    it('shows trailing zeros when decimals specified', () => {
      expect(formatAmount(100, { decimals: 2 })).toBe("100,00 so'm");
    });

    it('uses custom decimal separator', () => {
      expect(formatAmount(1234.5, { decimals: 2, decimalSeparator: '.' })).toBe("1 234.50 so'm");
    });
  });

  describe('symbol position', () => {
    it('places symbol after amount by default', () => {
      const result = formatAmount(1000);
      expect(result).toBe("1 000 so'm");
    });

    it('places symbol before amount when position is "before"', () => {
      expect(formatAmount(1000, { position: 'before' })).toBe("so'm1 000");
    });

    it('uses custom symbol', () => {
      expect(formatAmount(1000, { symbol: '$' })).toBe('1 000 $');
    });

    it('places custom symbol before amount', () => {
      expect(formatAmount(1000, { symbol: '$', position: 'before' })).toBe('$1 000');
    });
  });

  describe('custom thousands separator', () => {
    it('uses comma as thousands separator', () => {
      expect(formatAmount(1234567, { thousandsSeparator: ',' })).toBe("1,234,567 so'm");
    });

    it('uses dot as thousands separator', () => {
      expect(formatAmount(1234567, { thousandsSeparator: '.' })).toBe("1.234.567 so'm");
    });
  });

  describe('edge cases', () => {
    it('handles null input', () => {
      expect(formatAmount(null)).toBe("0 so'm");
    });

    it('handles undefined input', () => {
      expect(formatAmount(undefined)).toBe("0 so'm");
    });

    it('handles string numbers', () => {
      expect(formatAmount('1000')).toBe("1 000 so'm");
    });

    it('handles non-numeric strings', () => {
      expect(formatAmount('abc')).toBe("0 so'm");
    });

    it('handles NaN', () => {
      expect(formatAmount(NaN)).toBe("0 so'm");
    });

    it('handles very small decimals with 0 decimal places', () => {
      expect(formatAmount(0.4)).toBe("0 so'm");
      expect(formatAmount(0.5)).toBe("1 so'm");
    });
  });
});

// ─── formatCompactNumber ─────────────────────────────────────────

describe('formatCompactNumber', () => {
  describe('thousands (ming)', () => {
    it('formats exact thousands', () => {
      expect(formatCompactNumber(1000)).toBe("1 ming so'm");
      expect(formatCompactNumber(5000)).toBe("5 ming so'm");
    });

    it('formats thousands with decimal', () => {
      expect(formatCompactNumber(1500)).toBe("1.5 ming so'm");
      expect(formatCompactNumber(12500)).toBe("12.5 ming so'm");
    });

    it('drops trailing .0 for round thousands', () => {
      expect(formatCompactNumber(10000)).toBe("10 ming so'm");
    });
  });

  describe('millions (mln)', () => {
    it('formats exact millions', () => {
      expect(formatCompactNumber(1000000)).toBe("1 mln so'm");
      expect(formatCompactNumber(5000000)).toBe("5 mln so'm");
    });

    it('formats millions with decimal', () => {
      expect(formatCompactNumber(1500000)).toBe("1.5 mln so'm");
    });

    it('drops trailing .0 for round millions', () => {
      expect(formatCompactNumber(10000000)).toBe("10 mln so'm");
    });
  });

  describe('billions (mlrd)', () => {
    it('formats exact billions', () => {
      expect(formatCompactNumber(1000000000)).toBe("1 mlrd so'm");
    });

    it('formats billions with decimal', () => {
      expect(formatCompactNumber(1500000000)).toBe("1.5 mlrd so'm");
    });

    it('drops trailing .0 for round billions', () => {
      expect(formatCompactNumber(2000000000)).toBe("2 mlrd so'm");
    });
  });

  describe('small numbers (no abbreviation)', () => {
    it('formats numbers below 1000 as-is', () => {
      expect(formatCompactNumber(500)).toBe("500 so'm");
      expect(formatCompactNumber(0)).toBe("0 so'm");
      expect(formatCompactNumber(999)).toBe("999 so'm");
    });

    it('rounds small decimal numbers', () => {
      expect(formatCompactNumber(99.7)).toBe("100 so'm");
    });
  });

  describe('negative numbers', () => {
    it('handles negative thousands', () => {
      expect(formatCompactNumber(-5000)).toBe("-5 ming so'm");
    });

    it('handles negative millions', () => {
      expect(formatCompactNumber(-2500000)).toBe("-2.5 mln so'm");
    });

    it('handles negative small numbers', () => {
      expect(formatCompactNumber(-500)).toBe("-500 so'm");
    });
  });

  describe('symbol positioning', () => {
    it('places symbol after by default', () => {
      expect(formatCompactNumber(1000000)).toBe("1 mln so'm");
    });

    it('places symbol before when specified', () => {
      expect(formatCompactNumber(1000000, { symbol: '$', position: 'before' })).toBe('$1 mln');
    });
  });

  describe('edge cases', () => {
    it('handles zero', () => {
      expect(formatCompactNumber(0)).toBe("0 so'm");
    });

    it('handles null', () => {
      expect(formatCompactNumber(null)).toBe("0 so'm");
    });

    it('handles undefined', () => {
      expect(formatCompactNumber(undefined)).toBe("0 so'm");
    });

    it('handles string numbers', () => {
      expect(formatCompactNumber('5000000')).toBe("5 mln so'm");
    });

    it('handles non-numeric strings', () => {
      expect(formatCompactNumber('abc')).toBe("0 so'm");
    });
  });
});

// ─── formatAxisTick ──────────────────────────────────────────────

describe('formatAxisTick', () => {
  describe('thousands (ming)', () => {
    it('formats exact thousands', () => {
      expect(formatAxisTick(1000)).toBe('1 ming');
      expect(formatAxisTick(5000)).toBe('5 ming');
    });

    it('formats thousands with decimal', () => {
      expect(formatAxisTick(1500)).toBe('1.5 ming');
    });

    it('drops trailing .0', () => {
      expect(formatAxisTick(10000)).toBe('10 ming');
    });
  });

  describe('millions (mln)', () => {
    it('formats exact millions', () => {
      expect(formatAxisTick(1000000)).toBe('1 mln');
    });

    it('formats millions with decimal', () => {
      expect(formatAxisTick(2500000)).toBe('2.5 mln');
    });
  });

  describe('billions (mlrd)', () => {
    it('formats exact billions', () => {
      expect(formatAxisTick(1000000000)).toBe('1 mlrd');
    });

    it('formats billions with decimal', () => {
      expect(formatAxisTick(1500000000)).toBe('1.5 mlrd');
    });
  });

  describe('small numbers', () => {
    it('returns number as string for values below 1000', () => {
      expect(formatAxisTick(0)).toBe('0');
      expect(formatAxisTick(500)).toBe('500');
      expect(formatAxisTick(999)).toBe('999');
    });
  });

  describe('negative numbers', () => {
    it('handles negative thousands', () => {
      expect(formatAxisTick(-5000)).toBe('-5 ming');
    });

    it('handles negative millions', () => {
      expect(formatAxisTick(-2000000)).toBe('-2 mln');
    });

    it('handles negative billions', () => {
      expect(formatAxisTick(-1500000000)).toBe('-1.5 mlrd');
    });

    it('handles negative small numbers', () => {
      expect(formatAxisTick(-500)).toBe('-500');
    });
  });

  describe('edge cases', () => {
    it('handles zero', () => {
      expect(formatAxisTick(0)).toBe('0');
    });

    it('handles null', () => {
      expect(formatAxisTick(null)).toBe('0');
    });

    it('handles undefined', () => {
      expect(formatAxisTick(undefined)).toBe('0');
    });

    it('handles string numbers', () => {
      expect(formatAxisTick('5000')).toBe('5 ming');
    });
  });
});

// ─── formatPriceInput ────────────────────────────────────────────

describe('formatPriceInput', () => {
  it('formats integers with thousands separators', () => {
    expect(formatPriceInput('1000')).toBe('1 000');
    expect(formatPriceInput('1234567')).toBe('1 234 567');
  });

  it('preserves decimal part', () => {
    expect(formatPriceInput('1234.56')).toBe('1 234.56');
  });

  it('handles small numbers without separators', () => {
    expect(formatPriceInput('500')).toBe('500');
  });

  it('handles numbers as number type', () => {
    expect(formatPriceInput(12345)).toBe('12 345');
  });

  describe('empty/null/undefined inputs', () => {
    it('returns empty string for empty string', () => {
      expect(formatPriceInput('')).toBe('');
    });

    it('returns empty string for null', () => {
      expect(formatPriceInput(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(formatPriceInput(undefined)).toBe('');
    });
  });

  it('handles zero', () => {
    expect(formatPriceInput('0')).toBe('0');
    expect(formatPriceInput(0)).toBe('0');
  });
});

// ─── parsePriceInput ─────────────────────────────────────────────

describe('parsePriceInput', () => {
  it('strips spaces (thousands separators)', () => {
    expect(parsePriceInput('1 234 567')).toBe('1234567');
  });

  it('preserves a single decimal point', () => {
    expect(parsePriceInput('1 234.56')).toBe('1234.56');
  });

  it('strips non-numeric characters except dots', () => {
    expect(parsePriceInput('$1,234.56')).toBe('1234.56');
  });

  it('handles multiple dots by keeping only the first', () => {
    expect(parsePriceInput('1.234.567')).toBe('1.234567');
  });

  it('returns empty string for empty input', () => {
    expect(parsePriceInput('')).toBe('');
  });

  it('handles currency symbols', () => {
    expect(parsePriceInput("1 000 so'm")).toBe('1000');
  });

  it('handles plain numbers', () => {
    expect(parsePriceInput('12345')).toBe('12345');
  });

  it('handles input with only non-numeric characters', () => {
    expect(parsePriceInput('abc')).toBe('');
  });
});

// ─── createCurrencyFormatter ─────────────────────────────────────

describe('createCurrencyFormatter', () => {
  describe('default (UZS) settings', () => {
    const format = createCurrencyFormatter();

    it('formats with default UZS symbol after amount, 0 decimals', () => {
      expect(format(1000)).toBe("1 000 so'm");
    });

    it('formats large amounts', () => {
      expect(format(1234567)).toBe("1 234 567 so'm");
    });

    it('formats zero', () => {
      expect(format(0)).toBe("0 so'm");
    });

    it('rounds UZS to 0 decimals', () => {
      expect(format(1234.56)).toBe("1 235 so'm");
    });
  });

  describe('overriding currency to USD', () => {
    const format = createCurrencyFormatter();

    it('formats USD with $ before, 2 decimals', () => {
      expect(format(1000, 'USD')).toBe('$1 000,00');
    });

    it('formats USD with correct decimal places', () => {
      expect(format(1234.5, 'USD')).toBe('$1 234,50');
    });
  });

  describe('overriding currency to RUB', () => {
    const format = createCurrencyFormatter();

    it('formats RUB with symbol after, 0 decimals', () => {
      expect(format(1000, 'RUB')).toBe('1 000 ₽');
    });
  });

  describe('custom base settings', () => {
    const format = createCurrencyFormatter({
      currency: 'USD',
      currency_symbol: '$',
      currency_position: 'before',
      decimal_separator: '.',
      thousands_separator: ',',
    });

    it('formats with custom settings', () => {
      expect(format(1234.56)).toBe('$1,234.56');
    });

    it('overriding from USD to UZS uses UZS conventions', () => {
      const result = format(1000, 'UZS');
      expect(result).toBe("1,000 so'm");
    });
  });

  describe('unknown override currency', () => {
    const format = createCurrencyFormatter();

    it('uses the currency code itself as symbol for unknown currencies', () => {
      const result = format(1000, 'EUR');
      // EUR is not in CURRENCY_SYMBOLS, so it falls back to the code
      expect(result).toContain('EUR');
    });
  });
});

// ─── createCompactCurrencyFormatter ──────────────────────────────

describe('createCompactCurrencyFormatter', () => {
  describe('default (UZS) settings', () => {
    const format = createCompactCurrencyFormatter();

    it('formats thousands compactly', () => {
      expect(format(5000)).toBe("5 ming so'm");
    });

    it('formats millions compactly', () => {
      expect(format(1500000)).toBe("1.5 mln so'm");
    });

    it('formats billions compactly', () => {
      expect(format(2000000000)).toBe("2 mlrd so'm");
    });

    it('formats small numbers as-is', () => {
      expect(format(500)).toBe("500 so'm");
    });
  });

  describe('overriding currency to USD', () => {
    const format = createCompactCurrencyFormatter();

    it('formats USD compact with $ before', () => {
      expect(format(5000000, 'USD')).toBe('$5 mln');
    });
  });

  describe('overriding currency to RUB', () => {
    const format = createCompactCurrencyFormatter();

    it('formats RUB compact with symbol after', () => {
      expect(format(5000000, 'RUB')).toBe('5 mln ₽');
    });
  });

  describe('custom base settings', () => {
    const format = createCompactCurrencyFormatter({
      currency: 'USD',
      currency_symbol: '$',
      currency_position: 'before',
    });

    it('formats with custom settings', () => {
      expect(format(2500000)).toBe('$2.5 mln');
    });

    it('overriding to UZS places symbol after', () => {
      expect(format(2500000, 'UZS')).toBe("2.5 mln so'm");
    });
  });

  describe('edge cases', () => {
    const format = createCompactCurrencyFormatter();

    it('handles zero', () => {
      expect(format(0)).toBe("0 so'm");
    });

    it('handles null', () => {
      expect(format(null)).toBe("0 so'm");
    });

    it('handles negative compact numbers', () => {
      expect(format(-5000000)).toBe("-5 mln so'm");
    });
  });
});
