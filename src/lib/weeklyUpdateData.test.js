import { describe, it, expect } from 'vitest';
import { weekLabel, shiftWeek } from './weeklyUpdateData';

describe('weekLabel', () => {
  it('labels a week inside one month', () => {
    expect(weekLabel('2026-11-08')).toBe('Week of 2 – 8 Nov');
  });

  it('names both months when the week crosses one', () => {
    expect(weekLabel('2026-11-01')).toBe('Week of 26 Oct – 1 Nov');
  });

  it('returns nothing for a bad date', () => {
    expect(weekLabel(null)).toBe('');
    expect(weekLabel('soon')).toBe('');
  });
});

describe('shiftWeek', () => {
  it('moves by whole weeks, across months', () => {
    expect(shiftWeek('2026-11-08', -1)).toBe('2026-11-01');
    expect(shiftWeek('2026-11-29', 1)).toBe('2026-12-06');
  });
});
