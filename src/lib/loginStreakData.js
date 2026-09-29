// Daily login streak (supabase/032_login_streak.sql). Call once per session
// load - the RPC does the whole read-compare-write itself and returns the
// resulting streak, so there's no separate fetch needed.

import { supabase } from './supabase';

export async function recordDailyLogin() {
  const { data, error } = await supabase.rpc('record_daily_login');
  if (error) throw error;
  return data;
}

/** The caller's own current + personal-best streak, for the streak modal's
 * stat tiles - separate from recordDailyLogin()'s return value. */
export async function fetchMyLoginStreakSummary() {
  const { data, error } = await supabase.rpc('get_my_login_streak_summary');
  if (error) throw error;
  const row = (data || [])[0];
  return { currentStreak: row?.current_streak || 0, longestStreak: row?.longest_streak || 0 };
}

/** The caller's own login dates over the trailing ~year, for the
 * GitHub-style calendar on the streak tile. Returns a Set of 'YYYY-MM-DD'
 * strings for O(1) "did I log in on this day" lookups while rendering. */
export async function fetchMyLoginHistory(days = 371) {
  const { data, error } = await supabase.rpc('get_my_login_history', { p_days: days });
  if (error) throw error;
  return new Set((data || []).map((row) => row.login_date));
}

/** Whoever currently has the single highest live login streak community-wide
 * - null if nobody has an active streak yet. */
export async function fetchTopLoginStreak() {
  const { data, error } = await supabase.rpc('get_top_login_streak');
  if (error) throw error;
  const row = (data || [])[0];
  if (!row) return null;
  return { fullName: row.full_name, email: row.email, streak: row.login_streak };
}
