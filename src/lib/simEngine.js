// Career Simulator rules - pure functions only (no React, no I/O) so they
// are unit-testable. They take the answer key as an argument; the key itself
// only ever reaches here through simProvider.js.

export const PASS_MARK = 60;
export const TRUST_START = 50;
export const CREDITS_PER_SCORE = 0.4;

export function gradeFor(score) {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const weightOf = (key, severity) => key.severityWeights[severity] ?? 1;

function verdictFor(entry, choice) {
  if (!choice) return 'missed';
  if (entry.best.includes(choice)) return 'best';
  if (entry.ok.includes(choice)) return 'ok';
  return 'wrong';
}

// Live meter movement for one decision (Act II shows these as you go).
export function choiceMeterEffect(key, choice) {
  return key.choiceEffects?.[choice] || { velocity: 0, debt: 0 };
}

// Shared by Act I (alerts) and Act II (pull requests).
// decisions: { [eventId]: { choice, responseSec } }
export function evaluateTriage(pack, key, decisions, opts = {}) {
  const w = key.weights;
  let weightSum = 0;
  let points = 0;
  let criticalTotal = 0;
  let criticalHandled = 0;
  let speedSum = 0;
  let speedCount = 0;
  let trustDelta = 0;
  const flags = new Set();
  const meters = key.start ? { ...key.start } : null;
  const perEvent = [];

  for (const ev of pack.events) {
    const entry = key.events[ev.id];
    const d = decisions[ev.id];
    const choice = d?.choice || null;
    const verdict = verdictFor(entry, choice);
    const weight = weightOf(key, ev.severity);
    weightSum += weight;
    points += weight * (verdict === 'best' ? 1 : verdict === 'ok' ? 0.5 : 0);

    const isReal = entry.truth === 'true_positive';
    if (isReal) {
      criticalTotal += weight;
      if (verdict === 'best' || verdict === 'ok') criticalHandled += weight;
    }
    if ((verdict === 'best' || verdict === 'ok') && key.sla) {
      const sla = key.sla[ev.severity] ?? 120;
      speedSum += Math.min(1, sla / Math.max(d.responseSec || 1, 1));
      speedCount += 1;
    }

    const fx = choice ? entry.effects?.[choice] : entry.missed;
    if (fx?.trust) trustDelta += fx.trust;
    (fx?.flags || []).forEach((f) => flags.add(f));
    if (meters) {
      const m = choice ? key.choiceEffects[choice] : key.missedEffect;
      meters.velocity += m.velocity;
      meters.debt += m.debt;
    }
    perEvent.push({ id: ev.id, choice, verdict, truth: entry.truth, debrief: entry.debrief, best: entry.best });
  }

  const accuracy = weightSum ? points / weightSum : 0;
  const coverage = criticalTotal ? criticalHandled / criticalTotal : 1;
  const speed = speedCount ? speedSum / speedCount : 0;
  let raw;
  if (meters) {
    meters.velocity = clamp(meters.velocity, 0, 100);
    meters.debt = clamp(meters.debt, 0, 100);
    raw = w.accuracy * accuracy + w.coverage * coverage + w.velocity * (meters.velocity / 100);
  } else {
    raw = w.accuracy * accuracy + w.coverage * coverage + w.speed * speed;
  }
  const penalty = opts.endFocus != null && opts.endFocus < 25 ? 5 : 0;
  const score = clamp(Math.round(raw * 100) - penalty, 0, 100);
  return { score, grade: gradeFor(score), accuracy, coverage, speed, perEvent, trustDelta, flags: [...flags], meters, focusPenalty: penalty };
}

// ---- Act III ---------------------------------------------------------------

export function effectiveExposure(key, flags, nodeId) {
  const tags = new Set(key.exposure[nodeId] || []);
  for (const m of key.flagMods) if (m.node === nodeId && flags.includes(m.flag)) m.add.forEach((t) => tags.add(t));
  return [...tags];
}

export function detectionMultiplier(key, flags, techniqueId) {
  let mult = 1;
  for (const m of key.flagMods) if (m.technique === techniqueId && flags.includes(m.flag)) mult = Math.min(mult, m.detection);
  return mult;
}

export function activeFlagNotes(key, flags) {
  return key.flagMods.filter((m) => flags.includes(m.flag)).map((m) => m.note);
}

function isAdjacent(pack, a, b) {
  return pack.edges.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

// state: { compromised: string[], revealed: { [nodeId]: string[] } }
export function resolveStep(pack, key, flags, techniqueId, targetId, state) {
  const node = pack.nodes.find((n) => n.id === targetId);
  const tech = key.techniques[techniqueId];
  if (!node || !tech) return { kind: 'invalid', message: 'Pick a technique and a target.', noise: 0 };
  if (!node.inScope) return { kind: 'out_of_scope', message: `${node.name} is outside the rules of engagement. The engagement ends.`, noise: 0 };

  if (techniqueId === 'T1041') {
    if (node.kind !== 'data' || !state.compromised.includes(targetId)) {
      return { kind: 'invalid', message: 'You can only exfiltrate from a data store you already control.', noise: 0 };
    }
  } else {
    if (state.compromised.includes(targetId)) return { kind: 'invalid', message: `${node.name} is already yours.`, noise: 0 };
    if (!state.compromised.some((c) => isAdjacent(pack, c, targetId))) {
      return { kind: 'invalid', message: `${node.name} is not next to anything you control.`, noise: 0 };
    }
  }

  const monitored = key.monitored[targetId] ? 1.5 : 1;
  const mult = detectionMultiplier(key, flags, techniqueId);
  const base = tech.noise * monitored * mult;
  const exposure = effectiveExposure(key, flags, targetId);

  if (techniqueId === 'T1046') {
    return { kind: 'discovery', noise: Math.round(base), node: targetId, reveals: exposure, message: `Scan complete on ${node.name}.` };
  }
  if (techniqueId === 'T1041') {
    return { kind: 'objective', noise: Math.round(base), node: targetId, message: `Data pulled from ${node.name}. Objective reached.` };
  }
  if (exposure.includes(tech.needs)) {
    return { kind: 'success', noise: Math.round(base), node: targetId, finding: tech.needs, message: `${node.name} compromised.` };
  }
  return { kind: 'fail', noise: Math.round(base * 1.5), node: targetId, message: `That technique found nothing to use on ${node.name}. The attempt was noisy.` };
}

// run: { objective, burned, outOfScope, detection, findings: [{node, tag}], reported: { [node]: bool }, stoodDown }
export function evaluateEngagement(pack, key, run) {
  let score;
  if (run.outOfScope) score = 0;
  else if (run.objective) score = 55 + Math.round((100 - Math.min(100, run.detection)) * 0.45);
  else if (run.burned) score = 10;
  else score = 20;

  const flags = [];
  let trustDelta = 0;
  const omitted = run.findings.filter((f) => run.reported[f.node] === false);
  for (const f of omitted) {
    score -= key.omitScore;
    trustDelta += key.omitTrust;
    flags.push(`finding_unreported_${f.node}`);
  }
  if (run.outOfScope) trustDelta -= 20;
  if (run.objective && omitted.length === 0 && run.findings.length) trustDelta += 5;
  score = clamp(score, 0, 100);
  return { score, grade: gradeFor(score), trustDelta, flags, omitted: omitted.map((f) => f.node) };
}

// ---- Act IV ----------------------------------------------------------------

export function visibleRisks(pack, flags) {
  return pack.risks.filter((r) => !r.appearsIf || r.appearsIf.some((f) => flags.includes(f)));
}

export function boardEventVisible(pack, flags) {
  return pack.boardEvent.appearsIf.some((f) => flags.includes(f));
}

export function residualScores(pack, key, flags, alloc) {
  const risks = visibleRisks(pack, flags);
  return risks.map((r) => {
    const t = key.truth[r.id];
    let keep = 1;
    for (const c of pack.controls) {
      if (!key.controls[c.id].reduces.includes(r.id)) continue;
      const eff = key.maxReduction * Math.min(1, (alloc[c.id] || 0) / c.max);
      keep *= 1 - eff;
    }
    const base = t.l * t.i;
    return { id: r.id, base, residual: base * keep };
  });
}

export function evaluateBoard(pack, key, flags, credits, input) {
  const risks = visibleRisks(pack, flags);
  const spent = pack.controls.reduce((s, c) => s + (input.alloc[c.id] || 0), 0);
  if (spent > credits) return { error: 'Over budget' };

  const perRisk = risks.map((r) => {
    const t = key.truth[r.id];
    const p = input.placements[r.id];
    const dist = p ? Math.abs(p.l - t.l) + Math.abs(p.i - t.i) : 9;
    const credit = dist === 0 ? 1 : dist === 1 ? 0.6 : dist === 2 ? 0.3 : 0;
    return { id: r.id, truth: t, placed: p || null, credit };
  });
  const placement = perRisk.length ? perRisk.reduce((s, r) => s + r.credit, 0) / perRisk.length : 1;

  const res = residualScores(pack, key, flags, input.alloc);
  const baseline = res.reduce((s, r) => s + r.base, 0);
  const residual = res.reduce((s, r) => s + r.residual, 0);
  const reduction = baseline ? (baseline - residual) / baseline : 0;
  let allocation = Math.min(1, reduction / key.allocationTarget);
  if (credits > 0 && spent / credits < 0.6) allocation *= 0.7;

  const auditQ = key.audit[input.audit]?.quality;
  const gov = [auditQ];
  const hasBoard = boardEventVisible(pack, flags);
  if (hasBoard) gov.push(key.board[input.board]?.quality);
  const govScore = gov.reduce((s, q) => s + (q === 'best' ? 1 : q === 'ok' ? 0.5 : 0), 0) / gov.length;

  const w = key.weights;
  const score = clamp(Math.round(100 * (w.placement * placement + w.allocation * allocation + w.governance * govScore)), 0, 100);

  let trustDelta = 0;
  if (auditQ === 'best') trustDelta += 5; else if (auditQ === 'wrong') trustDelta -= 8;
  if (hasBoard) {
    const b = key.board[input.board]?.quality;
    if (b === 'best') trustDelta += 8; else if (b === 'wrong') trustDelta -= 15;
  }
  return { score, grade: gradeFor(score), perRisk, baseline, residual, reduction, spent, placement, allocation, govScore, trustDelta, flags: [], hasBoard };
}

// ---- Career ----------------------------------------------------------------

export function emptyCareer() {
  return { version: 1, results: {}, flagsByAct: {}, trustByAct: {} };
}

// Flags and trust only come from an act's FIRST completed attempt, so
// replaying a shift can improve the grade but never undo a consequence.
export function applyResult(career, act, result) {
  const prev = career.results[act.id];
  const passed = result.score >= PASS_MARK || prev?.passed || false;
  const next = {
    ...career,
    results: { ...career.results, [act.id]: { best: Math.max(prev?.best || 0, result.score), grade: gradeFor(Math.max(prev?.best || 0, result.score)), attempts: (prev?.attempts || 0) + 1, passed } },
  };
  if (!prev) {
    next.flagsByAct = { ...career.flagsByAct, [act.id]: result.flags };
    next.trustByAct = { ...career.trustByAct, [act.id]: result.trustDelta };
  }
  return next;
}

export function deriveCareer(career, acts) {
  const flags = [...new Set(Object.values(career.flagsByAct).flat())];
  const trust = clamp(TRUST_START + Object.values(career.trustByAct).reduce((s, n) => s + n, 0), 0, 100);
  const credits = Object.values(career.results).reduce((s, r) => s + Math.round(r.best * CREDITS_PER_SCORE), 0);
  let unlocked = 1;
  for (const a of acts) if (career.results[a.id]?.passed) unlocked = Math.max(unlocked, a.order + 1);
  const complete = acts.every((a) => career.results[a.id]?.passed);
  return { flags, trust, credits, unlocked: Math.min(unlocked, acts.length), complete };
}
