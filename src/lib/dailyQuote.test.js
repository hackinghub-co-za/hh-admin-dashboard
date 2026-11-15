import { describe, it, expect } from 'vitest';
import { QUOTES, quoteForDate, sastDateKey } from './dailyQuote';

describe('sastDateKey', () => {
  it('uses South African time, so 23:30 UTC is already the next day', () => {
    expect(sastDateKey(new Date('2026-11-15T21:59:00Z'))).toBe('2026-11-15');
    expect(sastDateKey(new Date('2026-11-15T22:00:00Z'))).toBe('2026-11-16');
  });
});

describe('quoteForDate', () => {
  it('gives the same quote all day', () => {
    expect(quoteForDate(new Date('2026-11-15T06:00:00+02:00'))).toBe(quoteForDate(new Date('2026-11-15T23:59:00+02:00')));
  });

  it('changes at midnight South African time', () => {
    expect(quoteForDate(new Date('2026-11-15T23:59:00+02:00'))).not.toBe(quoteForDate(new Date('2026-11-16T00:00:00+02:00')));
  });

  it('shows every quote once before any repeats', () => {
    const seen = new Set();
    for (let i = 0; i < QUOTES.length; i++) {
      seen.add(quoteForDate(new Date(Date.UTC(2026, 10, 15 + i, 10))));
    }
    expect(seen.size).toBe(QUOTES.length);
  });

  it('has no empty or duplicate quotes', () => {
    const texts = QUOTES.map((q) => q.text.trim());
    expect(texts.every(Boolean)).toBe(true);
    expect(new Set(texts).size).toBe(texts.length);
  });
});
