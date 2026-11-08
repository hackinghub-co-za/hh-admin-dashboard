// Sales Pipeline stats (SalesPipelineBoard's Stats panel). Pure functions
// over the cards and their recorded column moves, so they're easy to test.
//
// Counts, conversion and channels use every card created in the period,
// including ones taken off the board. Timings need the move history, which
// only exists for cards created from 8 November 2026
// (pipeline_phase_changes), so they only count those cards.
import { followUpStatus } from './pipelineData';

const DAY = 86400000;
export const OPEN_PHASES = ['Lead', 'Contacted', 'Ready to Join'];

export function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function countBy(cards, keyOf) {
  const map = new Map();
  for (const c of cards) {
    const key = keyOf(c);
    const row = map.get(key) || { label: key, leads: 0, joined: 0 };
    row.leads += 1;
    if (c.phase === 'Joined') row.joined += 1;
    map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.leads - a.leads || b.joined - a.joined || a.label.localeCompare(b.label));
}

/**
 * @param prospects cards ({ id, phase, createdAt, leadChannel, source, archivedAt, followUpOn })
 * @param changes   moves ({ prospectId, fromPhase, toPhase, changedAt }), any order
 * @param days      period length in days, or null for all time
 */
export function computePipelineStats(prospects, changes, days = null, now = Date.now()) {
  const from = days == null ? -Infinity : now - days * DAY;
  const cards = prospects.filter((p) => p.createdAt && new Date(p.createdAt).getTime() >= from);

  const byCard = new Map();
  for (const ch of [...changes].sort((a, b) => new Date(a.changedAt) - new Date(b.changedAt))) {
    if (!byCard.has(ch.prospectId)) byCard.set(ch.prospectId, []);
    byCard.get(ch.prospectId).push(ch);
  }

  // Timed cards: created while history was being recorded, as a Lead.
  const toContact = [];
  const toJoin = [];
  for (const c of cards) {
    const moves = byCard.get(c.id) || [];
    if (!moves.length || moves[0].fromPhase !== null || moves[0].toPhase !== 'Lead') continue;
    const start = new Date(moves[0].changedAt).getTime();
    const firstOut = moves.slice(1).find((m) => m.toPhase !== 'Lead');
    if (firstOut && ['Contacted', 'Ready to Join', 'Joined'].includes(firstOut.toPhase)) toContact.push((new Date(firstOut.changedAt).getTime() - start) / DAY);
    const joined = moves.find((m) => m.toPhase === 'Joined');
    if (joined) toJoin.push((new Date(joined.changedAt).getTime() - start) / DAY);
  }

  const joined = cards.filter((c) => c.phase === 'Joined').length;
  return {
    newLeads: cards.length,
    joined,
    conversionRate: cards.length ? Math.round((joined / cards.length) * 100) : null,
    notInterested: cards.filter((c) => c.phase === 'Not Interested').length,
    notQualified: cards.filter((c) => c.phase === 'Not Qualified').length,
    open: prospects.filter((p) => !p.archivedAt && OPEN_PHASES.includes(p.phase)).length,
    reachOutsDue: prospects.filter((p) => !p.archivedAt && ['overdue', 'today'].includes(followUpStatus(p))).length,
    daysToContact: median(toContact),
    daysToContactCount: toContact.length,
    daysToJoin: median(toJoin),
    daysToJoinCount: toJoin.length,
    channels: countBy(cards, (c) => c.leadChannel || 'Not tagged'),
    sources: countBy(cards, (c) => c.source || 'Added by hand'),
  };
}

/** "1.5 days", "4 hours", "under an hour" - for the timing tiles. */
export function formatDuration(days) {
  if (days == null) return '–';
  if (days < 1 / 24) return 'under an hour';
  if (days < 1) {
    const h = Math.round(days * 24);
    return `${h} hour${h === 1 ? '' : 's'}`;
  }
  const d = Math.round(days * 10) / 10;
  return `${d} day${d === 1 ? '' : 's'}`;
}
