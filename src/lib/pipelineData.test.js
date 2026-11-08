import { describe, it, expect } from 'vitest';
import { daysUntilRemoved, STALE_AFTER_DAYS, followUpStatus, normaliseLinkedIn } from './pipelineData';

const DAY = 86400000;

describe('daysUntilRemoved', () => {
  const now = Date.UTC(2026, 10, 8, 12);
  it('counts down from 21 days since the last update', () => {
    expect(daysUntilRemoved(new Date(now).toISOString(), now)).toBe(STALE_AFTER_DAYS);
    expect(daysUntilRemoved(new Date(now - 14 * DAY).toISOString(), now)).toBe(7);
  });

  it('never goes below zero', () => {
    expect(daysUntilRemoved(new Date(now - 40 * DAY).toISOString(), now)).toBe(0);
  });
});

describe('followUpStatus', () => {
  const today = '2026-11-08';
  it('marks overdue, today and upcoming reach-outs', () => {
    expect(followUpStatus({ phase: 'Contacted', followUpOn: '2026-11-05' }, today)).toBe('overdue');
    expect(followUpStatus({ phase: 'Ready to Join', followUpOn: '2026-11-08' }, today)).toBe('today');
    expect(followUpStatus({ phase: 'Contacted', followUpOn: '2026-11-12' }, today)).toBe('upcoming');
  });

  it('ignores cards without a date or in other phases', () => {
    expect(followUpStatus({ phase: 'Contacted', followUpOn: '' }, today)).toBe(null);
    expect(followUpStatus({ phase: 'Joined', followUpOn: '2026-11-05' }, today)).toBe(null);
  });
});

describe('normaliseLinkedIn', () => {
  it('adds https:// when it was left off, and keeps full links as they are', () => {
    expect(normaliseLinkedIn('www.linkedin.com/in/someone')).toBe('https://www.linkedin.com/in/someone');
    expect(normaliseLinkedIn(' https://linkedin.com/in/someone ')).toBe('https://linkedin.com/in/someone');
  });

  it('turns a blank box into no link', () => {
    expect(normaliseLinkedIn('   ')).toBe(null);
  });
});
