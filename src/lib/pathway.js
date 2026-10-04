// Core Foundations Pathway (supabase/102_core_pathway.sql) - the pure
// scheduling model behind the two-lane view on My Roadmap. No React, no
// Supabase: given what a member has done and how they've arranged their
// lanes, it projects which week each remaining item lands in.
//
// Model, matching the published plan: a labs lane that never pauses and
// certificate sprints layered on top. In a normal week labs get all but an
// hour of the member's weekly time; in a sprint week the certificate takes
// 7/12 of it and labs get what is left after a 30-minute wrap-up. Lab hours
// flow straight from one lab item into the next. Hours are planning
// estimates, not measurements.

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

// A checkpoint 1-on-1 the member must book once they reach this many items.
export const CHECKPOINTS = [
  { at: 2, title: 'Checkpoint 1-on-1', body: 'Two items done. Look back at what you enjoyed and plan the next stretch with your coach.' },
  { at: CORE_FOUNDATIONS_MIN_REQUIRED, title: 'Minimum met: choose your track', body: 'Four items done. Book a 1-on-1 to pick your Specialization track together.' },
  { at: SPECIALIZATION_UNLOCK_MIN, title: 'Specialization unlock', body: 'Five items done. Book a 1-on-1 so staff can approve your Foundations and open Specialization.' },
];

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

function sprintLength(fraction, certHours) {
  return Math.max(1, Math.ceil((CERT_HOURS * (1 - fraction)) / certHours - 1e-9));
}

/** Remaining lab items in the member's chosen order, unknown ones after in default order. */
function orderedLabs(labOrder, remaining) {
  const chosen = (labOrder || []).filter((t) => remaining.includes(t));
  return [...chosen, ...LAB_ITEMS.filter((t) => remaining.includes(t) && !chosen.includes(t))];
}

/**
 * Places the remaining certificate sprints: each at its chosen (or default)
 * week, never in the past, and pushed later if it would overlap the one
 * before it.
 */
function placeCerts(status, certStarts, now, split) {
  const remaining = CERT_ITEMS.filter((t) => status[t] && !status[t].completed);
  const wanted = remaining.map((t) => ({
    title: t,
    want: Math.max(now, Number.isInteger(certStarts?.[t]) ? certStarts[t] : DEFAULT_CERT_STARTS[t]),
    len: sprintLength(status[t]?.fraction || 0, split.cert),
  })).sort((a, b) => a.want - b.want || CERT_ITEMS.indexOf(a.title) - CERT_ITEMS.indexOf(b.title));
  let prevEnd = 0;
  return wanted.map((c) => {
    const start = Math.max(c.want, prevEnd + 1);
    prevEnd = start + c.len - 1;
    return { title: c.title, start, end: prevEnd, len: c.len };
  });
}

/**
 * The whole projection. `status` is { [catalogTitle]: { completed, fraction } }
 * for the catalog items on the member's roadmap (an item missing from it is
 * not scheduled); `prefs` is { labOrder, certStarts, weeklyHours };
 * `now` is the member's current pathway week.
 */
export function buildPathway(status, prefs, now) {
  const split = splitHours(prefs?.weeklyHours);
  const doneTitles = CORE_FOUNDATIONS_CATALOG.map((c) => c.title).filter((t) => status[t]?.completed);
  const doneCount = doneTitles.length;

  const certs = placeCerts(status, prefs?.certStarts, now, split);
  const sprintWeeks = new Set();
  certs.forEach((c) => { for (let w = c.start; w <= c.end; w++) sprintWeeks.add(w); });

  const labOrder = orderedLabs(prefs?.labOrder, LAB_ITEMS.filter((t) => status[t] && !status[t].completed));
  const labs = [];
  let idx = 0;
  let remaining = labOrder.length ? LAB_HOURS[labOrder[0]] * (1 - (status[labOrder[0]]?.fraction || 0)) : 0;
  let prevEnd = now - 1;
  for (let w = now; idx < labOrder.length && w < now + 400; w++) {
    let avail = sprintWeeks.has(w) ? split.labsInSprint : split.labsNormal;
    while (avail > 0 && idx < labOrder.length) {
      const take = Math.min(avail, remaining);
      avail -= take;
      remaining -= take;
      if (remaining <= 1e-9) {
        labs.push({ title: labOrder[idx], start: Math.min(prevEnd + 1, w), end: w });
        prevEnd = w;
        idx++;
        if (idx < labOrder.length) remaining = LAB_HOURS[labOrder[idx]] * (1 - (status[labOrder[idx]]?.fraction || 0));
      }
    }
  }

  const events = [...labs, ...certs].map((b) => ({ title: b.title, week: b.end }))
    .sort((a, b) => a.week - b.week || PATHWAY_ITEMS.indexOf(a.title) - PATHWAY_ITEMS.indexOf(b.title));
  const weekWhenDone = (n) => (doneCount >= n ? null : events[n - doneCount - 1]?.week ?? null);
  const lastWeek = Math.max(now, ...labs.map((b) => b.end), ...certs.map((c) => c.end));

  return {
    now,
    split,
    labs,
    certs,
    events,
    doneTitles,
    doneCount,
    minMetWeek: weekWhenDone(CORE_FOUNDATIONS_MIN_REQUIRED),
    unlockWeek: weekWhenDone(SPECIALIZATION_UNLOCK_MIN),
    lastWeek,
    thisWeekLab: labs.find((b) => b.start <= now && now <= b.end) || labs[0] || null,
    thisWeekCert: certs.find((c) => c.start <= now && now <= c.end) || null,
    afterUnlock: CORE_FOUNDATIONS_CATALOG.map((c) => c.title).filter((t) => !PATHWAY_ITEMS.includes(t) && status[t] && !status[t].completed),
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
