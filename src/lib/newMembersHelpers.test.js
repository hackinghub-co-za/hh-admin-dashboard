import { describe, it, expect } from 'vitest';
import { onboardingProgress, waitingOn, NEW_MEMBER_STEPS } from './newMembersHelpers';

const at = '2026-10-23T08:00:00Z';

describe('onboardingProgress', () => {
  it('counts only the seven list steps', () => {
    expect(onboardingProgress({})).toBe(0);
    expect(onboardingProgress(null)).toBe(0);
    expect(onboardingProgress({ watch_video: at, setup_profile: at, book_1on1: at })).toBe(2);
    expect(onboardingProgress(Object.fromEntries(NEW_MEMBER_STEPS.map((k) => [k, at])))).toBe(7);
  });
});

describe('waitingOn', () => {
  it('follows the order a member goes through', () => {
    expect(waitingOn({})).toEqual({ who: 'member', label: 'Member: say hi to Lesedi' });
    expect(waitingOn({ say_hi_lesedi: at })).toEqual({ who: 'lesedi', label: 'Lesedi: LinkedIn review' });
    expect(waitingOn({ say_hi_lesedi: at, linkedin_reviewed: at })).toEqual({ who: 'lesedi', label: 'Lesedi: approve intro' });
    expect(waitingOn({ say_hi_lesedi: at, linkedin_reviewed: at, intro_approved: at })).toEqual({ who: 'member', label: 'Member: post the intro' });
    expect(waitingOn({ intro_posted: at })).toEqual({ who: 'done', label: 'All done' });
  });
});
