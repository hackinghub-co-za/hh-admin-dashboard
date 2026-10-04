import { describe, it, expect } from 'vitest';
import {
  buildPathway, checkCertMove, pathwayAdvice, pathwayWeek, itemFraction, splitHours,
  activeCheckpoint, checkpointReachedDates, LAB_ITEMS, CERT_ITEMS,
} from './pathway';
import { CORE_FOUNDATIONS_CATALOG } from './memberOptions';

const blank = () => Object.fromEntries(CORE_FOUNDATIONS_CATALOG.map((c) => [c.title, { completed: false, fraction: 0 }]));
const prefs = (extra = {}) => ({ labOrder: [], certStarts: {}, weeklyHours: 6, ...extra });
const ends = (plan) => Object.fromEntries([...plan.labs, ...plan.certs].map((b) => [b.title, b.end]));

describe('pathwayWeek', () => {
  it('counts whole weeks from the start, 1-based', () => {
    expect(pathwayWeek('2026-10-01', '2026-10-01')).toBe(1);
    expect(pathwayWeek('2026-10-01', '2026-10-07')).toBe(1);
    expect(pathwayWeek('2026-10-01', '2026-10-08')).toBe(2);
    expect(pathwayWeek('2026-10-08', '2026-10-01')).toBe(1);
  });
});

describe('itemFraction', () => {
  it('weights Immersive Labs by collections and treats completed items as whole', () => {
    expect(itemFraction('Immersive Labs', false, new Set(['immersive-fundamentals']))).toBeCloseTo(6 / 20);
    expect(itemFraction('AZ-900', false, new Set(['az900-1']))).toBeCloseTo(1 / 3);
    expect(itemFraction('AZ-900', true, new Set())).toBe(1);
    expect(itemFraction('AZ-900', false, undefined)).toBe(0);
  });
});

describe('splitHours', () => {
  it('gives 5h labs, 3.5h certificate and 2h labs in a sprint at six hours', () => {
    expect(splitHours(6)).toEqual({ total: 6, labsNormal: 5, cert: 3.5, labsInSprint: 2 });
    expect(splitHours(7).total).toBe(6);
  });
});

describe('buildPathway for a brand new member', () => {
  const plan = buildPathway(blank(), prefs(), 1);
  it('runs labs in the recommended order with no gaps and two-week sprints', () => {
    expect(plan.labs.map((b) => b.title)).toEqual(LAB_ITEMS);
    for (let i = 1; i < plan.labs.length; i++) expect(plan.labs[i].start).toBe(plan.labs[i - 1].end + 1);
    expect(plan.certs.map((c) => [c.title, c.start, c.end])).toEqual([['AZ-900', 3, 4], ['SC-900', 9, 10]]);
  });
  it('lands the first certificate in week 4 and the unlock around week 19', () => {
    expect(ends(plan)['AZ-900']).toBe(4);
    expect(plan.minMetWeek).toBe(13);
    expect(plan.unlockWeek).toBe(19);
    expect(plan.afterUnlock).toEqual(['CISCO Junior Cyber Pathway', 'AI-901', 'CompTIA Security+']);
  });
  it('stretches sprints at lower paces', () => {
    const slow = buildPathway(blank(), prefs({ weeklyHours: 3 }), 1);
    expect(slow.certs[0].len).toBe(4);
    expect(slow.unlockWeek).toBeGreaterThan(plan.unlockWeek);
  });
});

describe('buildPathway for a member with backlog progress', () => {
  it('leaves completed items out of the lanes and counts them toward the unlock', () => {
    const s = blank();
    s['TryHackMe Pre-Security'] = { completed: true, fraction: 1 };
    s['AZ-900'] = { completed: true, fraction: 1 };
    s['CISCO Junior Cyber Pathway'] = { completed: true, fraction: 1 };
    const plan = buildPathway(s, prefs(), 1);
    expect(plan.labs.map((b) => b.title)).toEqual(['Immersive Labs', 'TryHackMe Cyber 101']);
    expect(plan.certs.map((c) => c.title)).toEqual(['SC-900']);
    expect(plan.doneCount).toBe(3);
    // Two more items reach the unlock: SC-900 and the first lab item.
    expect(plan.unlockWeek).toBe(Math.max(ends(plan)['SC-900'], ends(plan)['Immersive Labs']));
    expect(plan.afterUnlock).toEqual(['AI-901', 'CompTIA Security+']);
  });
  it('shortens items already part-done', () => {
    const s = blank();
    s['Immersive Labs'] = { completed: false, fraction: 0.95 };
    const plan = buildPathway(s, prefs(), 1);
    expect(plan.labs[0]).toMatchObject({ title: 'Immersive Labs', start: 1, end: 1 });
  });
  it('reports nothing left to reach once five are done', () => {
    const s = blank();
    ['Immersive Labs', 'AZ-900', 'SC-900', 'TryHackMe Pre-Security', 'CompTIA Security+'].forEach((t) => { s[t] = { completed: true, fraction: 1 }; });
    const plan = buildPathway(s, prefs(), 10);
    expect(plan.minMetWeek).toBeNull();
    expect(plan.unlockWeek).toBeNull();
  });
  it('never schedules a sprint in the past for a member mid-way', () => {
    const plan = buildPathway(blank(), prefs(), 12);
    plan.certs.forEach((c) => expect(c.start).toBeGreaterThanOrEqual(12));
    expect(plan.labs[0].start).toBe(12);
  });
});

describe('items missing from a roadmap', () => {
  it('schedules only what the member actually has', () => {
    const s = blank();
    delete s['SC-900'];
    delete s['TryHackMe Cyber 101'];
    delete s['AI-901'];
    const plan = buildPathway(s, prefs(), 1);
    expect(plan.labs.map((b) => b.title)).toEqual(['Immersive Labs', 'TryHackMe Pre-Security']);
    expect(plan.certs.map((c) => c.title)).toEqual(['AZ-900']);
    expect(plan.afterUnlock).not.toContain('AI-901');
  });
});

describe('rearranging', () => {
  it('honours a custom lab order and certificate weeks', () => {
    const plan = buildPathway(blank(), prefs({ labOrder: ['TryHackMe Pre-Security'], certStarts: { 'SC-900': 5, 'AZ-900': 12 } }), 1);
    expect(plan.labs.map((b) => b.title)).toEqual(['TryHackMe Pre-Security', 'Immersive Labs', 'TryHackMe Cyber 101']);
    expect(plan.certs.map((c) => [c.title, c.start])).toEqual([['SC-900', 5], ['AZ-900', 12]]);
    expect(pathwayAdvice(plan).join(' ')).toMatch(/AZ-900 first/);
    expect(pathwayAdvice(plan).join(' ')).toMatch(/recommended opener/);
  });
  it('pushes a clashing saved sprint later instead of overlapping', () => {
    const plan = buildPathway(blank(), prefs({ certStarts: { 'AZ-900': 5, 'SC-900': 6 } }), 1);
    expect(plan.certs.map((c) => [c.title, c.start, c.end])).toEqual([['AZ-900', 5, 6], ['SC-900', 7, 8]]);
  });
  it('blocks overlapping, past and far-future moves', () => {
    const plan = buildPathway(blank(), prefs(), 3);
    expect(checkCertMove(plan, 'SC-900', 4)).toMatch(/one certificate sprint/);
    expect(checkCertMove(plan, 'SC-900', 2)).toMatch(/already passed/);
    expect(checkCertMove(plan, 'SC-900', 80)).toMatch(/within the next year/);
    expect(checkCertMove(plan, 'SC-900', 12)).toBeNull();
  });
  it('keeps the labs lane contiguous for any order', () => {
    const orders = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
    orders.forEach((o) => {
      const plan = buildPathway(blank(), prefs({ labOrder: o.map((i) => LAB_ITEMS[i]), certStarts: { 'AZ-900': 6, 'SC-900': 15 } }), 1);
      expect(plan.labs.map((b) => b.title)).toEqual(o.map((i) => LAB_ITEMS[i]));
      for (let i = 1; i < plan.labs.length; i++) expect(plan.labs[i].start).toBe(plan.labs[i - 1].end + 1);
      expect(plan.certs.map((c) => c.title).sort()).toEqual([...CERT_ITEMS].sort());
    });
  });
});

describe('checkpoints', () => {
  const items = [
    { completed: true, completedAt: '2026-11-01T10:00:00Z' },
    { completed: true, completedAt: '2026-11-20T10:00:00Z' },
    { completed: false, completedAt: null },
  ];
  const reached = checkpointReachedDates(items);
  it('dates each completion count', () => {
    expect(reached).toEqual({ 1: '2026-11-01', 2: '2026-11-20' });
  });
  it('stops a member at two items until they book or meet', () => {
    expect(activeCheckpoint({ doneCount: 1, cleared: {}, reachedDates: reached, meetingDates: [] })).toBeNull();
    expect(activeCheckpoint({ doneCount: 2, cleared: {}, reachedDates: reached, meetingDates: ['2026-11-10'] })?.at).toBe(2);
    expect(activeCheckpoint({ doneCount: 2, cleared: {}, reachedDates: reached, meetingDates: ['2026-11-24'] })).toBeNull();
    expect(activeCheckpoint({ doneCount: 2, cleared: { 2: { how: 'booked' } }, reachedDates: reached, meetingDates: [] })).toBeNull();
  });
  it('moves on to the next uncleared checkpoint', () => {
    const cp = activeCheckpoint({ doneCount: 5, cleared: { 2: { how: 'prior' }, 4: { how: 'prior' } }, reachedDates: {}, meetingDates: [] });
    expect(cp.at).toBe(5);
  });
});
