// dd.mm.yyyy is the app-wide date display convention (all languages).
import { describe, it, expect } from 'vitest';
import { formatDate, formatDateTime } from '../formatDate';

describe('formatDate', () => {
  it('formats ISO date strings as dd.mm.yyyy', () => {
    expect(formatDate('2026-08-01')).toBe('01.08.2026');
    expect(formatDate('2026-12-31T10:30:00Z')).toMatch(/^31\.12\.2026$|^01\.01\.2027$/); // TZ-safe
  });

  it('formats Date objects', () => {
    expect(formatDate(new Date(2026, 0, 5))).toBe('05.01.2026');
  });

  it('returns empty string for empty/invalid input', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate(undefined)).toBe('');
    expect(formatDate('')).toBe('');
    expect(formatDate('not-a-date')).toBe('');
  });
});

describe('formatDateTime', () => {
  it('appends zero-padded time', () => {
    expect(formatDateTime(new Date(2026, 7, 1, 9, 5))).toBe('01.08.2026 09:05');
  });

  it('returns empty string for empty input', () => {
    expect(formatDateTime(null)).toBe('');
  });
});
