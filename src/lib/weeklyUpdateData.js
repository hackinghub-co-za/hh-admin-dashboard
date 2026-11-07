// Weekly Updates (supabase/112_weekly_updates.sql) - the Sunday check-in
// shown before the portal (WeeklyUpdateGate) and the founder's responses
// page (WeeklyUpdatesAdmin). The database decides who is asked and which
// week it is; a week is keyed by its Sunday (weekEnding, 'YYYY-MM-DD').
import { supabase } from './supabase';

export const MIN_ANSWER = 10;
export const MAX_ANSWER = 600;

/** { due, weekEnding } for the signed-in member. */
export async function fetchMyWeeklyUpdateStatus() {
  const { data, error } = await supabase.rpc('get_my_weekly_update_status');
  if (error) throw error;
  return { due: !!data?.due, weekEnding: data?.week_ending || null };
}

/** Returns { weekEnding, streak }. Blank optional answers are saved as none. */
export async function submitMyWeeklyUpdate({ did, next, achievement, blocker }) {
  const { data, error } = await supabase.rpc('submit_my_weekly_update', {
    p_did: did,
    p_next: next,
    p_achievement: achievement || null,
    p_blocker: blocker || null,
  });
  if (error) throw error;
  return { weekEnding: data?.week_ending || null, streak: Number(data?.streak) || 0 };
}

/** Admin only. weekEnding null = the current week. */
export async function fetchWeeklyUpdates(weekEnding = null) {
  const { data, error } = await supabase.rpc('get_weekly_updates', { p_week_ending: weekEnding });
  if (error) throw error;
  return {
    weekEnding: data.week_ending,
    eligible: Number(data.eligible) || 0,
    submitted: Number(data.submitted) || 0,
    withBlocker: Number(data.with_blocker) || 0,
    withAchievement: Number(data.with_achievement) || 0,
    previousRate: data.previous_rate == null ? null : Number(data.previous_rate),
    answers: (data.answers || []).map((a) => ({
      id: a.id,
      email: a.email,
      name: a.name,
      location: a.location || '',
      did: a.did,
      next: a.next,
      achievement: a.achievement || '',
      blocker: a.blocker || '',
      submittedAt: a.submitted_at,
    })),
    missing: data.missing || [],
  };
}

const parse = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayMonth = (date) => `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;

/** "Week of 2 – 8 Nov" (Monday to the Sunday it ends on). */
export function weekLabel(weekEnding) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekEnding || '')) return '';
  const end = parse(weekEnding);
  const start = new Date(end.getTime() - 6 * 86400000);
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  const from = sameMonth ? String(start.getUTCDate()) : dayMonth(start);
  return `Week of ${from} – ${dayMonth(end)}`;
}

/** The Sunday seven days before or after. */
export function shiftWeek(weekEnding, weeks) {
  const d = parse(weekEnding);
  d.setUTCDate(d.getUTCDate() + 7 * weeks);
  return d.toISOString().slice(0, 10);
}
