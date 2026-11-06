// New Recent Wins popup (NewWinsModal) - which wins a member hasn't been
// shown yet. "Seen" is the highest win id this member has already had the
// popup for. Ids only ever grow (community_wins.id is a BIGSERIAL), so
// anything above it is new. For a real member it is kept in the database
// (community_win_views, 044_community_content.sql), so each win shows once
// per member on any device; Mock Member keeps it in localStorage instead.
//
// Only wins from the last MAX_AGE_DAYS count, so a brand-new member gets
// the latest few rather than the whole history, and
// at most MAX_SHOWN at once, newest first.

import { supabase } from './supabase';

export const MAX_AGE_DAYS = 14;
export const MAX_SHOWN = 5;

const storageKey = (email) => `hh_wins_seen_upto_${(email || '').toLowerCase()}`;

export function readLastSeenWinId(email) {
  try {
    const n = Number(localStorage.getItem(storageKey(email)));
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

export function writeLastSeenWinId(email, id) {
  try {
    localStorage.setItem(storageKey(email), String(id));
  } catch {
    // Storage unavailable - the popup may show again next visit, which is
    // the same tradeoff the monthly recap accepts.
  }
}

/** The signed-in member's highest seen win id (0 if never shown one). */
export async function fetchMyWinsSeenUpto() {
  const { data, error } = await supabase.rpc('get_my_wins_seen_upto');
  if (error) throw error;
  return Number(data) || 0;
}

/** Raise the signed-in member's mark; it never moves backwards. */
export async function markMyWinsSeen(upto) {
  const { error } = await supabase.rpc('mark_my_wins_seen', { p_upto: upto });
  if (error) throw error;
}

// Date-only strings compare as calendar dates, same reason as
// relativeWinDateLabel: new Date('YYYY-MM-DD') is UTC midnight.
function daysAgo(dateStr, today) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr || '')) return Infinity;
  const [y, m, d] = dateStr.split('-').map(Number);
  const then = Date.UTC(y, m - 1, d);
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((now - then) / 86400000);
}

export function unseenWins(wins, lastSeenId, today = new Date()) {
  return (wins || [])
    .filter((w) => Number(w.id) > lastSeenId && daysAgo(w.achievedDate, today) <= MAX_AGE_DAYS)
    .sort((a, b) => Number(b.id) - Number(a.id))
    .slice(0, MAX_SHOWN);
}

export function highestWinId(wins) {
  return (wins || []).reduce((max, w) => Math.max(max, Number(w.id) || 0), 0);
}
