import { describe, it, expect } from 'vitest';
import { SIM_ACTS } from '../data/sim/packs';
import { SIM_KEYS } from '../data/sim/keys';
import {
  evaluateTriage, resolveStep, evaluateEngagement, evaluateBoard, visibleRisks,
  applyResult, deriveCareer, emptyCareer, gradeFor,
} from './simEngine';

const act = (id) => SIM_ACTS.find((a) => a.id === id);
const soc = act('soc').pack;
const dso = act('devsecops').pack;
const red = act('redteam').pack;
const grc = act('grc').pack;

function allBest(pack, key) {
  return Object.fromEntries(pack.events.map((e) => [e.id, { choice: key.events[e.id].best[0], responseSec: 20 }]));
}

describe('content integrity', () => {
  it('every event has a key entry and every choice in it is a real choice', () => {
    for (const a of [act('soc'), act('devsecops')]) {
      const key = SIM_KEYS[a.pack.id];
      for (const ev of a.pack.events) {
        const entry = key.events[ev.id];
        expect(entry, ev.id).toBeTruthy();
        expect(entry.best.length, ev.id).toBeGreaterThan(0);
      }
    }
  });

  it('public packs never carry answer fields', () => {
    const text = JSON.stringify(SIM_ACTS.map((a) => a.pack));
    for (const banned of ['"truth"', '"best"', '"debrief"', '"flagMods"', '"effects"']) expect(text).not.toContain(banned);
  });

  it('every risk has a truth entry and every control reduces known risks', () => {
    const key = SIM_KEYS[grc.id];
    for (const r of grc.risks) expect(key.truth[r.id], r.id).toBeTruthy();
    const ids = new Set(grc.risks.map((r) => r.id));
    for (const c of grc.controls) {
      expect(key.controls[c.id]).toBeTruthy();
      key.controls[c.id].reduces.forEach((r) => expect(ids.has(r)).toBe(true));
    }
  });
});

describe('Act I triage', () => {
  const key = SIM_KEYS[soc.id];
  it('a perfect shift grades A with no flags', () => {
    const r = evaluateTriage(soc, key, allBest(soc, key), { endFocus: 60 });
    expect(r.score).toBeGreaterThanOrEqual(90);
    expect(r.flags).toEqual([]);
  });
  it('dismissing the exfil alert sets the carry-over flag and costs trust', () => {
    const d = allBest(soc, key);
    d['ev-103'] = { choice: 'close_benign', responseSec: 20 };
    const r = evaluateTriage(soc, key, d, {});
    expect(r.flags).toContain('exfil_dismissed');
    expect(r.trustDelta).toBeLessThan(0);
    expect(r.score).toBeLessThan(evaluateTriage(soc, key, allBest(soc, key), {}).score);
  });
  it('leaving alerts unresolved counts as missed', () => {
    const r = evaluateTriage(soc, key, {}, {});
    expect(r.perEvent.every((e) => e.verdict === 'missed')).toBe(true);
    expect(r.flags).toContain('ransomware_spread');
    expect(r.grade).toBe('F');
  });
});

describe('Act II pipeline', () => {
  const key = SIM_KEYS[dso.id];
  it('suppressing a real finding creates debt and a flag', () => {
    const d = allBest(dso, key);
    d['ev-203'] = { choice: 'suppress_as_fp', responseSec: 5 };
    const r = evaluateTriage(dso, key, d, {});
    expect(r.flags).toContain('unauth_refunds');
    expect(r.meters.debt).toBeGreaterThan(key.start.debt);
  });
  it('blocking everything is not a winning strategy', () => {
    const d = Object.fromEntries(dso.events.map((e) => [e.id, { choice: 'block', responseSec: 5 }]));
    const best = evaluateTriage(dso, key, allBest(dso, key), {});
    expect(evaluateTriage(dso, key, d, {}).score).toBeLessThan(best.score);
  });
});

describe('Act III engagement', () => {
  const key = SIM_KEYS[red.id];
  const base = { compromised: ['internet'], revealed: {} };

  it('touching the out-of-scope node ends the engagement', () => {
    const s = { compromised: ['internet', 'web', 'app', 'db'], revealed: {} };
    expect(resolveStep(red, key, [], 'T1021', 'payroll', s).kind).toBe('out_of_scope');
  });
  it('cannot reach a node that is not adjacent', () => {
    expect(resolveStep(red, key, [], 'T1190', 'app', base).kind).toBe('invalid');
  });
  it('the public site falls to an exploit; a wrong technique is noisy and fails', () => {
    expect(resolveStep(red, key, [], 'T1190', 'web', base).kind).toBe('success');
    const fail = resolveStep(red, key, [], 'T1078', 'web', base);
    expect(fail.kind).toBe('fail');
    expect(fail.noise).toBeGreaterThan(key.techniques.T1078.noise);
  });
  it('earlier consequences make the path quieter', () => {
    const state = { compromised: ['internet', 'web'], revealed: {} };
    const clean = resolveStep(red, key, [], 'T1078', 'app', state);
    const leaked = resolveStep(red, key, ['secret_leaked'], 'T1078', 'app', state);
    expect(clean.kind).toBe('fail');
    expect(leaked.kind).toBe('success');
    const dbState = { compromised: ['internet', 'web', 'app', 'db'], revealed: {} };
    const loud = resolveStep(red, key, [], 'T1041', 'db', dbState);
    const quiet = resolveStep(red, key, ['exfil_dismissed'], 'T1041', 'db', dbState);
    expect(quiet.noise).toBeLessThan(loud.noise);
  });
  it('omitting a finding from the report is penalised and flagged', () => {
    const run = { objective: true, burned: false, outOfScope: false, detection: 40, findings: [{ node: 'web', tag: 'public_vuln' }], reported: { web: false } };
    const r = evaluateEngagement(red, key, run);
    expect(r.flags).toContain('finding_unreported_web');
    expect(r.trustDelta).toBeLessThan(0);
    expect(r.score).toBeLessThan(evaluateEngagement(red, key, { ...run, reported: { web: true } }).score);
  });
});

describe('Act IV board', () => {
  const key = SIM_KEYS[grc.id];
  it('risks from earlier acts only appear when their flag is set', () => {
    expect(visibleRisks(grc, []).map((r) => r.id)).toEqual(['r1', 'r7', 'r9']);
    expect(visibleRisks(grc, ['secret_leaked', 'exfil_dismissed']).map((r) => r.id)).toContain('r4');
  });
  it('rejects an over-budget allocation', () => {
    const r = evaluateBoard(grc, key, [], 50, { placements: {}, alloc: { monitoring: 40, patching: 40 }, audit: 'fix_and_evidence' });
    expect(r.error).toBeTruthy();
  });
  it('accurate placement, spending and answers score high', () => {
    const flags = ['exfil_dismissed'];
    const placements = Object.fromEntries(visibleRisks(grc, flags).map((r) => [r.id, { l: key.truth[r.id].l, i: key.truth[r.id].i }]));
    const r = evaluateBoard(grc, key, flags, 120, { placements, alloc: { monitoring: 40, patching: 20, training: 20, vendor: 40 }, audit: 'fix_and_evidence', board: 'notify_all' });
    expect(r.score).toBeGreaterThanOrEqual(85);
    const bad = evaluateBoard(grc, key, flags, 120, { placements: {}, alloc: {}, audit: 'blame_team', board: 'hide' });
    expect(bad.score).toBeLessThan(20);
  });
});

describe('career', () => {
  const acts = SIM_ACTS;
  it('flags and trust come from the first completed attempt only', () => {
    let c = emptyCareer();
    c = applyResult(c, acts[0], { score: 30, flags: ['exfil_dismissed'], trustDelta: -15 });
    c = applyResult(c, acts[0], { score: 95, flags: [], trustDelta: 0 });
    const d = deriveCareer(c, acts);
    expect(d.flags).toEqual(['exfil_dismissed']);
    expect(d.trust).toBe(35);
    expect(c.results.soc.best).toBe(95);
    expect(c.results.soc.attempts).toBe(2);
  });
  it('a pass unlocks the next act, a fail does not', () => {
    let c = applyResult(emptyCareer(), acts[0], { score: 40, flags: [], trustDelta: 0 });
    expect(deriveCareer(c, acts).unlocked).toBe(1);
    c = applyResult(c, acts[0], { score: 70, flags: [], trustDelta: 0 });
    expect(deriveCareer(c, acts).unlocked).toBe(2);
  });
  it('grades map to the documented bands', () => {
    expect([95, 80, 65, 45, 10].map(gradeFor)).toEqual(['A', 'B', 'C', 'D', 'F']);
  });
});
