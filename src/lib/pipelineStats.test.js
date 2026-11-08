import { describe, it, expect } from 'vitest';
import { computePipelineStats, median, formatDuration } from './pipelineStats';

const DAY = 86400000;
const now = Date.UTC(2026, 10, 30, 12);
const ago = (d) => new Date(now - d * DAY).toISOString();

const prospects = [
  { id: 1, phase: 'Joined', createdAt: ago(10), leadChannel: 'TikTok', source: 'Elite Operative application' },
  { id: 2, phase: 'Contacted', createdAt: ago(6), leadChannel: 'TikTok', source: 'Permanent Access call booking' },
  { id: 3, phase: 'Not Interested', createdAt: ago(5), leadChannel: 'YouTube', source: null, archivedAt: ago(1) },
  { id: 4, phase: 'Lead', createdAt: ago(2), leadChannel: '', source: 'Elite Operative application' },
  { id: 5, phase: 'Joined', createdAt: ago(60), leadChannel: 'LinkedIn', source: null }, // before tracking, outside 30 days
];
const changes = [
  { prospectId: 1, fromPhase: null, toPhase: 'Lead', changedAt: ago(10) },
  { prospectId: 1, fromPhase: 'Lead', toPhase: 'Contacted', changedAt: ago(9) },
  { prospectId: 1, fromPhase: 'Contacted', toPhase: 'Joined', changedAt: ago(4) },
  { prospectId: 2, fromPhase: null, toPhase: 'Lead', changedAt: ago(6) },
  { prospectId: 2, fromPhase: 'Lead', toPhase: 'Contacted', changedAt: ago(3) },
  { prospectId: 3, fromPhase: null, toPhase: 'Lead', changedAt: ago(5) },
  { prospectId: 3, fromPhase: 'Lead', toPhase: 'Not Interested', changedAt: ago(4) },
  { prospectId: 4, fromPhase: null, toPhase: 'Lead', changedAt: ago(2) },
];

describe('computePipelineStats', () => {
  const s = computePipelineStats(prospects, changes, 30, now);

  it('counts leads, joins and conversion in the period, removed cards included', () => {
    expect(s.newLeads).toBe(4);
    expect(s.joined).toBe(1);
    expect(s.conversionRate).toBe(25);
    expect(s.notInterested).toBe(1);
  });

  it('times first contact and lead to join from recorded moves only', () => {
    expect(s.daysToContact).toBe(2); // 1 day and 3 days; going straight to Not Interested isn't contact
    expect(s.daysToContactCount).toBe(2);
    expect(s.daysToJoin).toBe(6);
    expect(s.daysToJoinCount).toBe(1);
  });

  it('ranks channels and sources by leads', () => {
    expect(s.channels[0]).toEqual({ label: 'TikTok', leads: 2, joined: 1 });
    expect(s.channels.map((c) => c.label)).toContain('Not tagged');
    expect(s.sources[0].label).toBe('Elite Operative application');
    expect(s.sources.map((c) => c.label)).toContain('Added by hand');
  });

  it('covers all time when no period is given', () => {
    const all = computePipelineStats(prospects, changes, null, now);
    expect(all.newLeads).toBe(5);
    expect(all.conversionRate).toBe(40);
  });

  it('copes with an empty pipeline', () => {
    const empty = computePipelineStats([], [], 30, now);
    expect(empty.conversionRate).toBe(null);
    expect(empty.daysToContact).toBe(null);
  });
});

describe('helpers', () => {
  it('takes the median of odd and even lists', () => {
    expect(median([5, 1, 3])).toBe(3);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBe(null);
  });

  it('formats durations for the tiles', () => {
    expect(formatDuration(null)).toBe('–');
    expect(formatDuration(0.01)).toBe('under an hour');
    expect(formatDuration(0.25)).toBe('6 hours');
    expect(formatDuration(1)).toBe('1 day');
    expect(formatDuration(2.46)).toBe('2.5 days');
  });
});
