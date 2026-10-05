// Roadmap pathway (supabase/102_core_pathway.sql) - the pure scheduling model
// behind the two-lane view on My Roadmap, for Core Foundations and for every
// Specialization track. No React, no Supabase: given what a member has done
// and how they've arranged their lanes, it projects which week each
// remaining item lands in.
//
// Model, matching the published plan: a labs lane that never pauses and
// certificate sprints layered on top. In a normal week labs get all but an
// hour of the member's weekly time; in a sprint week the certificate takes
// 7/12 of it and labs get what is left after a 30-minute wrap-up. Lab hours
// flow straight from one lab item into the next. Hours are planning
// estimates, not measurements.
//
// A pathway is described by a config ({ labs, certs, ... }); CORE_CONFIG is
// Core Foundations, and trackPathway.js builds one per Specialization track.

import { CORE_FOUNDATIONS_CATALOG, CORE_FOUNDATION_SUBTASKS, CORE_FOUNDATIONS_MIN_REQUIRED, SPECIALIZATION_UNLOCK_MIN } from './memberOptions';

export const LAB_ITEMS = ['Immersive Labs', 'TryHackMe Pre-Security', 'TryHackMe Cyber 101'];
export const CERT_ITEMS = ['AZ-900', 'SC-900'];
export const PATHWAY_ITEMS = [...LAB_ITEMS, ...CERT_ITEMS];
export const LAB_HOURS = { 'Immersive Labs': 27, 'TryHackMe Pre-Security': 23, 'TryHackMe Cyber 101': 30 };
export const CERT_HOURS = 7;
export const DEFAULT_CERT_STARTS = { 'AZ-900': 3, 'SC-900': 9 };
export const WEEKLY_HOURS_OPTIONS = [3, 4, 6, 8, 10, 12];
export const DEFAULT_WEEKLY_HOURS = 6;
const MAX_WEEKS_AHEAD = 52;

// Subtasks aren't equal in size for Immersive Labs (6, 13 and 1 collections).
const SUBTASK_WEIGHTS = {
  'Immersive Labs': { 'immersive-fundamentals': 6, 'immersive-defsecops': 13, 'immersive-humanconnection': 1 },
};

// A checkpoint 1-on-1 the member must book once they reach this many Core Foundations items.
export const CHECKPOINTS = [
  { at: 2, title: 'Checkpoint 1-on-1', body: 'Two items done. Look back at what you enjoyed and plan the next stretch with your coach.' },
  { at: CORE_FOUNDATIONS_MIN_REQUIRED, title: 'Minimum met: choose your track', body: 'Four items done. Book a 1-on-1 to pick your Specialization track together.' },
  { at: SPECIALIZATION_UNLOCK_MIN, title: 'Specialization unlock', body: 'Five items done. Book a 1-on-1 so staff can approve your Foundations and open Specialization.' },
];

function coreAdvice(plan) {
  const out = [];
  const labOrder = plan.labs.map((b) => b.title);
  const certOrder = [...plan.certs].sort((a, b) => a.start - b.start).map((c) => c.title);
  if (plan.doneCount === 0 && labOrder.includes('Immersive Labs') && labOrder[0] !== 'Immersive Labs') {
    out.push('Immersive Labs is the recommended opener. Its six Fundamentals collections are the on-ramp for newcomers.');
  }
  if (labOrder.includes('TryHackMe Cyber 101') && labOrder.includes('TryHackMe Pre-Security') && labOrder.indexOf('TryHackMe Cyber 101') < labOrder.indexOf('TryHackMe Pre-Security')) {
    out.push('Cyber 101 leans on the networking and Linux in Pre-Security, so most members take Pre-Security first.');
  }
  if (certOrder.length === 2 && certOrder[0] === 'SC-900') {
    out.push('SC-900 builds on the vocabulary in AZ-900, so most members take AZ-900 first.');
  }
  if (plan.doneCount === 0 && plan.certs.some((c) => c.start <= 2)) {
    out.push('Weeks 1 and 2 are for Getting Started and your first collections. A sprint here is a heavy start.');
  }
  return out;
}

/** Core Foundations: five items to the unlock, certificates placed at weeks 3 and 9 by default. */
export const CORE_CONFIG = {
  key: 'core',
  labs: LAB_HOURS,
  certs: { 'AZ-900': CERT_HOURS, 'SC-900': CERT_HOURS },
  defaultCertStarts: DEFAULT_CERT_STARTS,
  catalogTitles: CORE_FOUNDATIONS_CATALOG.map((c) => c.title),
  milestones: [
    { at: CORE_FOUNDATIONS_MIN_REQUIRED, label: 'Minimum met' },
    { at: SPECIALIZATION_UNLOCK_MIN, label: 'Specialization unlock' },
  ],
  advice: coreAdvice,
};

const DAY_MS = 86400000;

/** 1-based pathway week for `today` (both YYYY-MM-DD). */
export function pathwayWeek(startedOn, today) {
  if (!startedOn || !today) return 1;
  const days = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${startedOn}T00:00:00Z`)) / DAY_MS);
  return Math.max(1, Math.floor(days / 7) + 1);
}

/** Share of an item already done (0-1), from its subtasks. */
export function itemFraction(title, completed, doneKeys) {
  if (completed) return 1;
  const catalog = CORE_FOUNDATION_SUBTASKS[title] || [];
  if (!catalog.length || !doneKeys || !doneKeys.size) return 0;
  const weights = SUBTASK_WEIGHTS[title] || {};
  const total = catalog.reduce((sum, s) => sum + (weights[s.key] || 1), 0);
  const done = catalog.reduce((sum, s) => sum + (doneKeys.has(s.key) ? (weights[s.key] || 1) : 0), 0);
  return total ? Math.min(1, done / total) : 0;
}

export function splitHours(weeklyHours) {
  const h = WEEKLY_HOURS_OPTIONS.includes(weeklyHours) ? weeklyHours : DEFAULT_WEEKLY_HOURS;
  const cert = (h * 7) / 12;
  return { total: h, labsNormal: h - 1, cert, labsInSprint: Math.max(0.5, h - cert - 0.5) };
}

function sprintLength(studyHours, fraction, certHours) {
  return Math.max(1, Math.ceil((studyHours * (1 - fraction)) / certHours - 1e-9));
}

/** Remaining lab items in the member's chosen order, unknown ones after in default order. */
function orderedLabs(labOrder, remaining, config) {
  const chosen = (labOrder || []).filter((t) => remaining.includes(t));
  return [...chosen, ...Object.keys(config.labs).filter((t) => remaining.includes(t) && !chosen.includes(t))];
}

/**
 * Places the remaining certificate sprints: each at its chosen (or default)
 * week, never in the past, and pushed later if it would overlap the one
 * before it. Without fixed defaults they run back to back from `now`.
 */
function placeCerts(status, certStarts, now, split, config) {
  const remaining = Object.keys(config.certs).filter((t) => status[t] && !status[t].completed);
  const len = (t) => sprintLength(config.certs[t], status[t]?.fraction || 0, split.cert);
  let cursor = now;
  const wanted = remaining.map((t) => {
    const saved = Number.isInteger(certStarts?.[t]) ? certStarts[t] : null;
    let want;
    if (saved !== null) want = saved;
    else if (config.defaultCertStarts) want = config.defaultCertStarts[t];
    else { want = cursor; cursor += len(t); }
    return { title: t, want: Math.max(now, want), len: len(t) };
  }).sort((a, b) => a.want - b.want || remaining.indexOf(a.title) - remaining.indexOf(b.title));
  let prevEnd = 0;
  return wanted.map((c) => {
    const start = Math.max(c.want, prevEnd + 1);
    prevEnd = start + c.len - 1;
    return { title: c.title, start, end: prevEnd, len: c.len };
  });
}

/**
 * The whole projection. `status` is { [title]: { completed, fraction } } for
 * the catalog items on the member's roadmap (an item missing from it is not
 * scheduled); `prefs` is { labOrder, certStarts, weeklyHours }; `now` is the
 * member's current pathway week.
 */
export function buildPathway(status, prefs, now, config = CORE_CONFIG) {
  const split = splitHours(prefs?.weeklyHours);
  const doneTitles = config.catalogTitles.filter((t) => status[t]?.completed);
  const doneCount = doneTitles.length;

  const certs = placeCerts(status, prefs?.certStarts, now, split, config);
  const sprintWeeks = new Set();
  certs.forEach((c) => { for (let w = c.start; w <= c.end; w++) sprintWeeks.add(w); });

  const labOrder = orderedLabs(prefs?.labOrder, Object.keys(config.labs).filter((t) => status[t] && !status[t].completed), config);
  const hoursFor = (t) => config.labs[t] * (1 - (status[t]?.fraction || 0));
  const labs = [];
  let idx = 0;
  let remaining = labOrder.length ? hoursFor(labOrder[0]) : 0;
  let prevEnd = now - 1;
  for (let w = now; idx < labOrder.length && w < now + 600; w++) {
    let avail = sprintWeeks.has(w) ? split.labsInSprint : split.labsNormal;
    while (avail > 0 && idx < labOrder.length) {
      const take = Math.min(avail, remaining);
      avail -= take;
      remaining -= take;
      if (remaining <= 1e-9) {
        labs.push({ title: labOrder[idx], start: Math.min(prevEnd + 1, w), end: w });
        prevEnd = w;
        idx++;
        if (idx < labOrder.length) remaining = hoursFor(labOrder[idx]);
      }
    }
  }

  const scheduledTitles = [...Object.keys(config.labs), ...Object.keys(config.certs)];
  const events = [...labs, ...certs].map((b) => ({ title: b.title, week: b.end }))
    .sort((a, b) => a.week - b.week || scheduledTitles.indexOf(a.title) - scheduledTitles.indexOf(b.title));
  const weekWhenDone = (n) => (doneCount >= n ? null : events[n - doneCount - 1]?.week ?? null);
  const lastWeek = Math.max(now, ...labs.map((b) => b.end), ...certs.map((c) => c.end));
  const milestones = config.milestones.map((m) => ({ ...m, week: weekWhenDone(m.at), reached: doneCount >= m.at }));

  return {
    now,
    config,
    split,
    labs,
    certs,
    events,
    doneTitles,
    doneCount,
    milestones,
    // Core Foundations' two named milestones, kept for existing callers.
    minMetWeek: milestones[0]?.week ?? null,
    unlockWeek: milestones[1]?.week ?? null,
    lastWeek,
    thisWeekLab: labs.find((b) => b.start <= now && now <= b.end) || labs[0] || null,
    thisWeekCert: certs.find((c) => c.start <= now && now <= c.end) || null,
    // Catalog items that aren't in either lane (Core: Cisco, AI-901, Security+).
    afterUnlock: config.catalogTitles.filter((t) => !scheduledTitles.includes(t) && status[t] && !status[t].completed),
  };
}

/** Hard limits on moving a certificate sprint. Returns an error, or null if allowed. */
export function checkCertMove(plan, title, newStart) {
  const sprint = plan.certs.find((c) => c.title === title);
  if (!sprint) return 'That certificate is already done.';
  if (newStart < plan.now) return 'A sprint cannot start in a week that has already passed.';
  if (newStart > plan.now + MAX_WEEKS_AHEAD) return 'Keep sprints within the next year.';
  const end = newStart + sprint.len - 1;
  const clash = plan.certs.find((c) => c.title !== title && newStart <= c.end && end >= c.start);
  if (clash) return 'Only one certificate sprint at a time.';
  return null;
}

/** Plain advice about an arrangement. Never blocks anything. */
export function pathwayAdvice(plan) {
  return plan.config?.advice ? plan.config.advice(plan) : [];
}

/**
 * The date each completion count was reached ({ 1: 'YYYY-MM-DD', 2: ... }),
 * from the completedAt stamps of the member's finished catalog items.
 */
export function checkpointReachedDates(catalogItems) {
  const dates = catalogItems.filter((i) => i.completed && i.completedAt)
    .map((i) => String(i.completedAt).slice(0, 10)).sort();
  const out = {};
  dates.forEach((d, i) => { out[i + 1] = d; });
  return out;
}

/**
 * The checkpoint the member is stopped at, or null. A checkpoint clears when
 * it was booked (or passed before the pathway existed), or as soon as a real
 * 1-on-1 falls on or after the day it was reached.
 */
export function activeCheckpoint({ doneCount, cleared, reachedDates, meetingDates }) {
  for (const cp of CHECKPOINTS) {
    if (doneCount < cp.at) return null;
    if (cleared?.[String(cp.at)]) continue;
    const reached = reachedDates?.[cp.at];
    if (reached && (meetingDates || []).some((d) => d >= reached)) continue;
    return cp;
  }
  return null;
}
