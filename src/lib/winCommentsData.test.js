import { describe, it, expect } from 'vitest';
import { groupByWin } from './winCommentsData';

describe('groupByWin', () => {
  it('groups comments by win id and keeps their order', () => {
    const comments = [
      { id: 1, winId: 20, body: 'a' },
      { id: 2, winId: 19, body: 'b' },
      { id: 3, winId: 20, body: 'c' },
    ];
    const byWin = groupByWin(comments);
    expect(byWin[20].map((c) => c.id)).toEqual([1, 3]);
    expect(byWin[19].map((c) => c.id)).toEqual([2]);
  });

  it('returns an empty object for no comments', () => {
    expect(groupByWin([])).toEqual({});
  });
});
