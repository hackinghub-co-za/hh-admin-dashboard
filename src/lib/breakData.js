// Take a Break (supabase/095_take_a_break.sql) - a member's own fixed-
// duration, auto-resuming break. No "end early" call exists on purpose -
// fixed-duration/auto-resume was chosen over a manual toggle, so there's
// nothing here to cancel a break once started.

import { supabase } from './supabase';

/** The caller's own break status - null fields if never on a break. */
export async function fetchMyBreakStatus() {
  const { data, error } = await supabase.rpc('get_my_break_status');
  if (error) throw error;
  const row = (data || [])[0];
  return { breakStartedAt: row?.break_started_at || null, breakUntil: row?.break_until || null };
}

/** Starts a break of `days` days from today (SAST) - server re-validates
 * 1-30, the UI only ever offers 3/7/14. Returns the resulting break_until
 * date (YYYY-MM-DD). */
export async function startMyBreak(days) {
  const { data, error } = await supabase.rpc('start_my_break', { p_days: days });
  if (error) throw error;
  return data;
}
