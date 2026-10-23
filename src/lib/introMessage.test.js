import { describe, it, expect } from 'vitest';
import { buildIntroMessage, joinWithAnd, firstNameOf, suggestFocusAreas, INTRO_GOALS, INTRO_BACKGROUNDS } from './introMessage';

describe('joinWithAnd', () => {
  it('joins one, two and three or more items', () => {
    expect(joinWithAnd([])).toBe('');
    expect(joinWithAnd(['SOC'])).toBe('SOC');
    expect(joinWithAnd(['SOC', 'GRC'])).toBe('SOC and GRC');
    expect(joinWithAnd(['SOC', 'Cloud Security', 'GRC'])).toBe('SOC, Cloud Security and GRC');
  });
});

describe('firstNameOf', () => {
  it('takes the first word and tolerates blanks', () => {
    expect(firstNameOf('Sipho Mokoena')).toBe('Sipho');
    expect(firstNameOf('  Nande  ')).toBe('Nande');
    expect(firstNameOf('')).toBe('');
    expect(firstNameOf(null)).toBe('');
  });
});

describe('suggestFocusAreas', () => {
  it('maps a track to the matching area and ignores the rest', () => {
    expect(suggestFocusAreas('SOC')).toEqual(['SOC']);
    expect(suggestFocusAreas('Cloud Security')).toEqual(['Cloud Security']);
    expect(suggestFocusAreas('GRC')).toEqual(['GRC']);
    expect(suggestFocusAreas('AI Security')).toEqual(['AI Security']);
    expect(suggestFocusAreas('Cybersecurity Analyst')).toEqual([]);
    expect(suggestFocusAreas('Not Assigned')).toEqual([]);
    expect(suggestFocusAreas(undefined)).toEqual([]);
  });
});

describe('buildIntroMessage', () => {
  it('builds the full message', () => {
    const text = buildIntroMessage({
      name: 'Sipho',
      goal: INTRO_GOALS[0],
      background: INTRO_BACKGROUNDS[0],
      areas: ['SOC', 'Cloud Security'],
      linkedin: 'linkedin.com/in/sipho-example',
    });
    expect(text).toBe(
      "Hi everyone, I'm Sipho. My goal is to land my first cybersecurity role.\n\n" +
      "I'm currently working in IT. I'm focusing on SOC and Cloud Security.\n\n" +
      'You can find me on LinkedIn: linkedin.com/in/sipho-example'
    );
  });
  it('leaves out the focus line and the LinkedIn line when they are empty', () => {
    const text = buildIntroMessage({ name: 'Nande', goal: INTRO_GOALS[1], background: INTRO_BACKGROUNDS[2], areas: [], linkedin: '  ' });
    expect(text).toBe("Hi everyone, I'm Nande. My goal is to move from IT into cybersecurity.\n\nI'm a recent graduate.");
  });
  it('falls back sensibly when nothing is filled in', () => {
    expect(buildIntroMessage()).toBe("Hi everyone. My goal is to land my first cybersecurity role.\n\nI'm currently working in IT.");
  });
});
