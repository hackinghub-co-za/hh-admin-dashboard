import { describe, it, expect } from 'vitest';
import { normalizeSteps, parseStepLines, applyProgress } from './resourceHelpers';

const res = { id: 1, steps: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] };

describe('parseStepLines', () => {
  it('splits lines into steps with optional links and stable ids', () => {
    expect(parseStepLines('Read the guide | https://x.test/g\n\n  Do the lab  ')).toEqual([
      { id: 's1', title: 'Read the guide', link: 'https://x.test/g' },
      { id: 's2', title: 'Do the lab', link: null },
    ]);
  });
  it('caps at 20 steps and drops empty titles', () => {
    expect(parseStepLines(Array.from({ length: 30 }, (_, i) => `Step ${i}`).join('\n'))).toHaveLength(20);
    expect(parseStepLines('| https://x.test')).toEqual([]);
  });
});

describe('normalizeSteps', () => {
  it('keeps well-formed steps only', () => {
    expect(normalizeSteps([{ id: 'a', title: 'A', link: null }, { title: 'no id' }, null])).toEqual([{ id: 'a', title: 'A', link: '' }]);
    expect(normalizeSteps(null)).toEqual([]);
  });
});

describe('applyProgress', () => {
  it('ticking the last step completes the resource', () => {
    let p = applyProgress(undefined, res, 'a', true);
    p = applyProgress(p, res, 'b', true);
    expect(p.completed).toBe(false);
    p = applyProgress(p, res, 'c', true);
    expect(p).toEqual({ completed: true, steps: ['a', 'b', 'c'] });
  });
  it('un-ticking a step un-completes the resource', () => {
    const p = applyProgress({ completed: true, steps: ['a', 'b', 'c'] }, res, 'b', false);
    expect(p).toEqual({ completed: false, steps: ['a', 'c'] });
  });
  it('completing the resource ticks every step; un-completing keeps them', () => {
    let p = applyProgress(undefined, res, null, true);
    expect(p).toEqual({ completed: true, steps: ['a', 'b', 'c'] });
    p = applyProgress(p, res, null, false);
    expect(p).toEqual({ completed: false, steps: ['a', 'b', 'c'] });
  });
  it('works for a resource with no steps', () => {
    expect(applyProgress(undefined, { id: 2, steps: [] }, null, true)).toEqual({ completed: true, steps: [] });
  });
});
