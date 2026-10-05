import { describe, it, expect } from 'vitest';
import { buildTrackConfig, CERT_STUDY_WEEKS, LAB_STUDY_HOURS, TRACKS_WITH_PATHWAY, isLabItem } from './trackPathway';
import { buildPathway, checkCertMove } from './pathway';
import { SPECIALIZATION_CATALOGS } from './memberOptions';

const allTitles = TRACKS_WITH_PATHWAY.flatMap((t) => SPECIALIZATION_CATALOGS[t].items.map((i) => i.title));
const blankFor = (config) => Object.fromEntries(config.catalogTitles.map((t) => [t, { completed: false, fraction: 0 }]));
const prefs = (extra = {}) => ({ labOrder: [], certStarts: {}, weeklyHours: 6, ...extra });

describe('track estimates', () => {
  it('covers every item in every track, so nothing silently falls back to a default', () => {
    const missing = allTitles.filter((t) => !(t in CERT_STUDY_WEEKS) && !(t in LAB_STUDY_HOURS));
    expect(missing).toEqual([]);
  });
  it('never lists an item in both lanes', () => {
    Object.keys(CERT_STUDY_WEEKS).forEach((t) => expect(isLabItem(t)).toBe(false));
  });
  it('has no estimate for a title that is in no track', () => {
    const known = new Set(allTitles);
    [...Object.keys(CERT_STUDY_WEEKS), ...Object.keys(LAB_STUDY_HOURS)].forEach((t) => expect(known.has(t), t).toBe(true));
  });
});

describe('buildTrackConfig', () => {
  it('returns null for a track with no catalog', () => {
    expect(buildTrackConfig('Not Assigned')).toBeNull();
    expect(buildTrackConfig('Nonsense')).toBeNull();
  });
  it('splits SOC into certificates and labs and sets the real milestones', () => {
    const c = buildTrackConfig('SOC');
    expect(Object.keys(c.certs)).toEqual(['CySA+', 'SC-200']);
    expect(Object.keys(c.labs)).toEqual(['THM SOC Level 1', 'Blue Team Level 1', 'CISCO Cybersecurity Defense Analyst']);
    expect(c.milestones).toEqual([{ at: 3, label: 'Projects unlock' }, { at: 5, label: 'Track complete' }]);
  });
  it('uses half the catalog, rounded up, for Projects unlock', () => {
    TRACKS_WITH_PATHWAY.forEach((t) => {
      const c = buildTrackConfig(t);
      expect(c.milestones[0].at).toBe(Math.ceil(c.catalogTitles.length / 2));
    });
  });
});

describe('every track schedules cleanly', () => {
  TRACKS_WITH_PATHWAY.forEach((track) => {
    it(`${track}: labs are contiguous, sprints never overlap, everything finishes`, () => {
      const c = buildTrackConfig(track);
      const plan = buildPathway(blankFor(c), prefs(), 1, c);
      expect(plan.labs.length).toBe(Object.keys(c.labs).length);
      expect(plan.certs.length).toBe(Object.keys(c.certs).length);
      for (let i = 1; i < plan.labs.length; i++) expect(plan.labs[i].start).toBe(plan.labs[i - 1].end + 1);
      for (let i = 1; i < plan.certs.length; i++) expect(plan.certs[i].start).toBeGreaterThan(plan.certs[i - 1].end);
      expect(plan.milestones.every((m) => m.week !== null)).toBe(true);
      expect(plan.milestones.at(-1).week).toBe(plan.lastWeek);
    });
  });
});

describe('track plans honour progress and rearranging', () => {
  const c = buildTrackConfig('SOC');
  it('leaves finished items out and counts them toward the milestones', () => {
    const s = blankFor(c);
    s['CySA+'] = { completed: true, fraction: 1 };
    s['THM SOC Level 1'] = { completed: true, fraction: 1 };
    s['SC-200'] = { completed: true, fraction: 1 };
    const plan = buildPathway(s, prefs(), 5, c);
    expect(plan.doneCount).toBe(3);
    expect(plan.certs).toEqual([]);
    expect(plan.milestones[0]).toMatchObject({ at: 3, reached: true, week: null });
    expect(plan.milestones[1].week).toBe(plan.lastWeek);
  });
  it('runs certificates back to back by default and lets one be moved', () => {
    const plan = buildPathway(blankFor(c), prefs(), 1, c);
    expect(plan.certs[0].start).toBe(1);
    expect(plan.certs[1].start).toBe(plan.certs[0].end + 1);
    // Swapping order means moving the first one out of the way.
    const moved = buildPathway(blankFor(c), prefs({ certStarts: { 'CySA+': 12 } }), 1, c);
    expect(moved.certs.map((x) => [x.title, x.start])).toEqual([['SC-200', 1], ['CySA+', 12]]);
    // A saved start that would overlap an earlier sprint is pushed later, never stacked.
    const clash = buildPathway(blankFor(c), prefs({ certStarts: { 'SC-200': 3 } }), 1, c);
    expect(clash.certs.map((x) => x.title)).toEqual(['CySA+', 'SC-200']);
    expect(clash.certs[1].start).toBe(clash.certs[0].end + 1);
    expect(checkCertMove(plan, 'SC-200', plan.certs[0].start)).toMatch(/one certificate sprint/);
    expect(checkCertMove(plan, 'SC-200', plan.certs[1].end + 5)).toBeNull();
  });
  it('gives no Core-only advice on a track', () => {
    const plan = buildPathway(blankFor(c), prefs({ labOrder: ['Blue Team Level 1'] }), 1, c);
    expect(plan.config.advice(plan)).toEqual([]);
  });
});
