import { describe, it, expect } from 'vitest';
import { computeReadinessPercent } from './examReadinessData';

// Shared by the Cert Calendar card badge and ExamReadinessModal so both
// always agree (the module's own comment) - a regression here would show
// two different readiness numbers for the same cert in two different
// places, which is exactly the kind of drift this function exists to
// prevent.
describe('computeReadinessPercent', () => {
  const milestones = [{ key: 'a' }, { key: 'b' }, { key: 'c' }, { key: 'd' }];

  it('is 0 with nothing done and no practice score', () => {
    expect(computeReadinessPercent(milestones, {}, null)).toBe(0);
  });

  it('is 100 with every milestone done and a perfect practice score', () => {
    const checklist = { a: true, b: true, c: true, d: true };
    expect(computeReadinessPercent(milestones, checklist, 100)).toBe(100);
  });

  it('caps at 50 with every milestone done but no logged practice score - the documented behavior', () => {
    const checklist = { a: true, b: true, c: true, d: true };
    expect(computeReadinessPercent(milestones, checklist, null)).toBe(50);
    expect(computeReadinessPercent(milestones, checklist, undefined)).toBe(50);
  });

  it('weights checklist completion and practice score 50/50', () => {
    const checklist = { a: true, b: true, c: false, d: false }; // 50% checklist
    expect(computeReadinessPercent(milestones, checklist, 80)).toBe(65); // 50*0.5 + 80*0.5
  });

  it('treats a missing checklist entry as not done, not as an error', () => {
    expect(computeReadinessPercent(milestones, undefined, 60)).toBe(30); // 0% checklist + 60*0.5
  });

  it('handles an empty milestone list without dividing by zero', () => {
    expect(computeReadinessPercent([], {}, 40)).toBe(20); // 0% checklist + 40*0.5
  });

  it('rounds to the nearest whole percent', () => {
    const oneOfThree = [{ key: 'a' }, { key: 'b' }, { key: 'c' }];
    // checklist = 1/3 = 33.33%; score 50 -> (33.33*0.5 + 50*0.5) = 41.67 -> 42
    expect(computeReadinessPercent(oneOfThree, { a: true }, 50)).toBe(42);
  });
});
