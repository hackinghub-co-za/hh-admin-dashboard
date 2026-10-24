import { describe, it, expect } from 'vitest';
import { previousMonth, matchKey, sameCost, expectedRecurringCosts, forecastExpenses } from './financeForecast';

const x = (id, date, category, description, amount, isOneOff = false) => ({ id, date, category, description, amount, isOneOff });

describe('previousMonth', () => {
  it('steps back a month, across a year boundary too', () => {
    expect(previousMonth('2026-10')).toBe('2026-09');
    expect(previousMonth('2026-01')).toBe('2025-12');
  });
});

describe('matchKey', () => {
  it('uses the first word, ignoring case and punctuation', () => {
    expect(matchKey('Google workspace')).toBe('google');
    expect(matchKey('  claude sub')).toBe('claude');
    expect(matchKey('Diamatrix ( domain hosting )')).toBe('diamatrix');
    expect(matchKey('')).toBe('');
  });
});

describe('sameCost', () => {
  it('matches when the first word of either appears in the other', () => {
    expect(sameCost('claude sub', 'Claude subscription')).toBe(true);
    expect(sameCost('Domain', 'Diamatrix ( domain hosting )')).toBe(true);
    expect(sameCost('blessing video editor', 'blessing editor')).toBe(true);
    expect(sameCost('bank charges', 'HH Merch - tshirts')).toBe(false);
    expect(sameCost('', 'anything')).toBe(false);
  });
});

describe('expectedRecurringCosts', () => {
  const expenses = [
    x(1, '2026-09-01', 'Tools & Software', 'Google Workspace', 604.98),
    x(2, '2026-09-08', 'Tools & Software', 'claude sub', 381.8),
    x(3, '2026-09-29', 'Tools & Software', 'apple developer account', 1674.11, true),
    x(4, '2026-09-30', 'Other', 'monthly account fee', 102),
    x(5, '2026-09-26', 'Events', 'event food', 1200, true),
    x(6, '2026-09-28', 'Other', 'bank charges', 8.5),
    x(10, '2026-10-01', 'Tools & Software', 'Google workspace', 642.86),
    x(11, '2026-10-08', 'Tools & Software', 'Claude subscription', 396.27),
    x(12, '2026-10-13', 'Tools & Software', 'claude bank charges', 9.91),
    x(7, '2026-09-01', 'Hosting / Infrastructure', 'Domain', 109),
    x(14, '2026-10-01', 'Hosting / Infrastructure', 'Diamatrix ( domain hosting )', 109),
  ];
  it('expects last month\'s recurring costs that have not been logged this month', () => {
    const ids = expectedRecurringCosts(expenses, '2026-10').map((e) => e.id).sort();
    expect(ids).toEqual([4, 6]);
  });
  it('never expects a one-off again', () => {
    const ids = expectedRecurringCosts(expenses, '2026-10').map((e) => e.id);
    expect(ids).not.toContain(3);
    expect(ids).not.toContain(5);
  });
  it('matches within the same category only', () => {
    // "bank charges" logged under Tools & Software does not count for Other.
    const withBank = [...expenses, x(13, '2026-10-13', 'Tools & Software', 'bank charges', 9)];
    expect(expectedRecurringCosts(withBank, '2026-10').map((e) => e.id)).toContain(6);
  });
  it('adds the expected costs to what is logged', () => {
    const f = forecastExpenses(expenses, '2026-10');
    expect(f.logged).toBeCloseTo(1158.04, 2);
    expect(f.expectedTotal).toBeCloseTo(110.5, 2);
    expect(f.total).toBeCloseTo(1268.54, 2);
  });
});
