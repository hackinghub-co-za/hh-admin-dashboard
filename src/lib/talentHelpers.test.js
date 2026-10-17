import { describe, it, expect } from 'vitest';
import { parseSkills, isAvailableNow, availabilityLabel, highlightParts, buildTalentPack, MAX_SELF_SKILLS } from './talentHelpers';

const card = (over) => ({
  id: 1, displayId: 'T-0101', role: 'SOC analyst', headline: '', years: 3, city: 'Johannesburg', workMode: 'Hybrid',
  openToContract: false, availableFrom: '', verified: ['SC-200'], self: ['Splunk'], summary: 'Three years in a SOC.', ...over,
});

describe('parseSkills', () => {
  it('splits on commas, semicolons and line breaks and trims', () => {
    expect(parseSkills('Splunk, python; Sigma rules\nKQL')).toEqual(['Splunk', 'python', 'Sigma rules', 'KQL']);
  });
  it('drops blanks and case-insensitive repeats, keeping the first spelling', () => {
    expect(parseSkills('Splunk, splunk , , SPLUNK, Python')).toEqual(['Splunk', 'Python']);
  });
  it('applies the same limits as the database', () => {
    expect(parseSkills('x'.repeat(41))).toEqual([]);
    const many = Array.from({ length: 40 }, (_, i) => `skill${i}`).join(',');
    expect(parseSkills(many)).toHaveLength(MAX_SELF_SKILLS);
  });
  it('copes with empty input', () => {
    expect(parseSkills('')).toEqual([]);
    expect(parseSkills(null)).toEqual([]);
  });
});

describe('availability', () => {
  it('treats a past or present date as available now, and no date as not stated', () => {
    expect(isAvailableNow('2026-10-01', '2026-10-17')).toBe(true);
    expect(isAvailableNow('2026-10-17', '2026-10-17')).toBe(true);
    expect(isAvailableNow('2026-11-01', '2026-10-17')).toBe(false);
    expect(isAvailableNow('', '2026-10-17')).toBe(false);
  });
  it('labels each case', () => {
    expect(availabilityLabel('', '2026-10-17')).toBe('not stated');
    expect(availabilityLabel('2026-10-01', '2026-10-17')).toBe('now');
    expect(availabilityLabel('2026-11-12', '2026-10-17')).toBe('from 12 Nov 2026');
  });
});

describe('highlightParts', () => {
  it('marks matched terms without touching the rest, ignoring case', () => {
    expect(highlightParts('Cloud security with Terraform', ['terraform', 'cloud'])).toEqual([
      { text: 'Cloud', hit: true }, { text: ' security with ', hit: false }, { text: 'Terraform', hit: true },
    ]);
  });
  it('escapes characters that mean something in a pattern', () => {
    expect(highlightParts('CompTIA Security+ (SY0-701)', ['security+', '(sy0-701)']).filter((p) => p.hit).map((p) => p.text)).toEqual(['Security+', '(SY0-701)']);
  });
  it('returns the text whole when there is nothing to match', () => {
    expect(highlightParts('hello', [])).toEqual([{ text: 'hello', hit: false }]);
    expect(highlightParts('', ['x'])).toEqual([{ text: '', hit: false }]);
  });
});

describe('buildTalentPack', () => {
  it('is empty when nobody is shortlisted', () => {
    expect(buildTalentPack([])).toBe('');
  });
  it('lists anonymous cards with verified skills marked', () => {
    const text = buildTalentPack([card({}), card({ id: 2, displayId: 'T-0102', role: '', headline: 'Cloud engineer', years: 1, openToContract: true, availableFrom: '2026-10-01', verified: [], self: ['AWS'] })], '2026-10-17');
    expect(text).toContain('HACKING HUB TALENT PACK');
    expect(text).toContain('2 candidates.');
    expect(text).toContain('T-0101  SOC analyst, 3 yrs, Johannesburg, hybrid, available not stated');
    expect(text).toContain('Skills: ✓ SC-200, Splunk');
    expect(text).toContain('T-0102  Cloud engineer, 1 yr, Johannesburg, hybrid, available now, open to contract');
  });
  it('never contains a name, email or phone number', () => {
    const text = buildTalentPack([card({ name: 'Real Person', email: 'real@example.com', phone: '0821234567' })]);
    expect(text).not.toMatch(/Real Person|real@example\.com|0821234567/);
  });
});
