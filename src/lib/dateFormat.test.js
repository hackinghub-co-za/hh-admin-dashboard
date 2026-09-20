import { describe, it, expect } from 'vitest';
import { formatDate } from './dateFormat';

describe('formatDate', () => {
  it('formats a bare YYYY-MM-DD Postgres date string as "day - month - year"', () => {
    expect(formatDate('2026-08-11')).toBe('11 - August - 2026');
  });

  it('does not shift the day backward for a bare date (the UTC-midnight timezone bug this guards against)', () => {
    // Without the local-midnight fix, `new Date('2026-01-01')` parses as UTC
    // midnight, which renders as 31 December in any timezone behind UTC -
    // exactly the class of bug a member west of UTC would have hit.
    expect(formatDate('2026-01-01')).toBe('1 - January - 2026');
    expect(formatDate('2026-12-31')).toBe('31 - December - 2026');
  });

  it('accepts a real Date object directly', () => {
    expect(formatDate(new Date(2026, 7, 11))).toBe('11 - August - 2026'); // month is 0-indexed
  });

  it('accepts a full ISO timestamp string', () => {
    expect(formatDate('2026-08-11T14:30:00Z')).toBe('11 - August - 2026');
  });

  it('returns an empty string for empty/nullish input rather than "Invalid Date"', () => {
    expect(formatDate('')).toBe('');
    expect(formatDate(null)).toBe('');
    expect(formatDate(undefined)).toBe('');
  });

  it('returns an empty string for unparseable input rather than throwing', () => {
    expect(formatDate('not a date')).toBe('');
    expect(() => formatDate('not a date')).not.toThrow();
  });
});
