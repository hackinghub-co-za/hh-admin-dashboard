import { describe, it, expect, beforeEach } from 'vitest';
import { unseenWins, highestWinId, readLastSeenWinId, writeLastSeenWinId, MAX_SHOWN } from './newWinsData';

const today = new Date(2026, 10, 6); // 6 Nov 2026, local time
const win = (id, achievedDate) => ({ id, member: `M${id}`, achievement: 'did a thing', achievedDate });

describe('unseenWins', () => {
  it('returns wins above the last seen id, newest first', () => {
    const wins = [win(18, '2026-11-01'), win(20, '2026-11-06'), win(19, '2026-11-01')];
    expect(unseenWins(wins, 18, today).map((w) => w.id)).toEqual([20, 19]);
  });

  it('returns nothing once everything has been seen', () => {
    expect(unseenWins([win(20, '2026-11-06')], 20, today)).toEqual([]);
  });

  it('skips wins older than 14 days, even if never seen', () => {
    const wins = [win(5, '2026-10-22'), win(6, '2026-10-23'), win(7, '2026-11-06')];
    expect(unseenWins(wins, 0, today).map((w) => w.id)).toEqual([7, 6]);
  });

  it('skips wins with no usable date', () => {
    expect(unseenWins([win(9, null), win(10, 'soon')], 0, today)).toEqual([]);
  });

  it('caps how many are shown at once', () => {
    const wins = Array.from({ length: 8 }, (_, i) => win(i + 1, '2026-11-05'));
    const shown = unseenWins(wins, 0, today);
    expect(shown).toHaveLength(MAX_SHOWN);
    expect(shown[0].id).toBe(8);
  });
});

describe('highestWinId', () => {
  it('finds the largest id, or 0 for none', () => {
    expect(highestWinId([win(3, '2026-11-01'), win(12, '2026-11-01')])).toBe(12);
    expect(highestWinId([])).toBe(0);
  });
});

describe('last seen storage', () => {
  beforeEach(() => localStorage.clear());

  it('is kept per member email, case-insensitively', () => {
    writeLastSeenWinId('A@Example.com', 20);
    expect(readLastSeenWinId('a@example.com')).toBe(20);
    expect(readLastSeenWinId('b@example.com')).toBe(0);
  });
});
