// Focus 5 (supabase/038_focus_five.sql) - the 5 members getting the most
// attention this month. Managing the list itself is still admin-only (RLS
// rejects a non-admin entirely on writes); a member can only ever check
// their OWN status and submit their own daily update (038/078). Only
// called for real (non-mock) sessions - Mock Admin has no Supabase
// session, so it uses local-only demo state instead (see AdminDashboard.jsx).

import { supabase } from './supabase';

/** Fetch every Focus 5 row, oldest-added first. RLS rejects this for non-admins. */
export async function fetchFocusFive() {
  const { data, error } = await supabase
    .from('focus_five')
    .select('id, member_email, added_at')
    .order('added_at', { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => ({ id: row.id, memberEmail: row.member_email, addedAt: row.added_at }));
}

/** Admin-only: adds a member to Focus 5. Harmless no-op if they're already on it
 * (member_email is UNIQUE). */
export async function addToFocusFive(memberEmail) {
  const { error } = await supabase
    .from('focus_five')
    .insert({ member_email: memberEmail.toLowerCase() });
  if (error && error.code !== '23505') throw error; // 23505 = unique_violation, already on the list
}

/** Admin-only: removes a member from Focus 5. */
export async function removeFromFocusFive(memberEmail) {
  const { error } = await supabase.from('focus_five').delete().eq('member_email', memberEmail.toLowerCase());
  if (error) throw error;
}

// Focus 5 Daily Updates (078_focus_five_daily_updates.sql) - whoever is
// currently on the list has to answer "what did you do today" once per
// day on login, straight to the founder's inbox. A member can only ever
// see their OWN row here (RLS), which is exactly what "am I on the list"
// and "have I already submitted today" need.

/** Whether the signed-in member is currently on the Focus 5 list - RLS
 * scopes this to their own row, so it can never leak the other 4 names. */
export async function amIFocusFive() {
  const { data, error } = await supabase.from('focus_five').select('id').maybeSingle();
  if (error) throw error;
  return !!data;
}

/** The signed-in member's own update for today (UTC), or null if they
 * haven't submitted one yet. */
export async function fetchMyTodaysFocusFiveUpdate() {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('focus_five_daily_updates')
    .select('id, update_date, update_text')
    .eq('update_date', today)
    .maybeSingle();
  if (error) throw error;
  return data ? { id: data.id, updateDate: data.update_date, updateText: data.update_text } : null;
}

/** Submits (or replaces, same day only) today's update - the RPC verifies
 * server-side that the caller is actually on the Focus 5 list. */
export async function submitFocusFiveDailyUpdate(updateText) {
  const { error } = await supabase.rpc('submit_focus_five_daily_update', { p_update_text: updateText });
  if (error) throw error;
}

/** Admin: today's update (if any) from every member currently on Focus 5,
 * keyed by lowercased email - a fallback for seeing what came in without
 * having to go dig through email. */
export async function fetchTodaysFocusFiveUpdates() {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('focus_five_daily_updates')
    .select('member_email, update_text')
    .eq('update_date', today);
  if (error) throw error;
  return Object.fromEntries((data || []).map((row) => [row.member_email.toLowerCase(), row.update_text]));
}

/** Emails the founder (siya@hackinghub.co.za) the caller's own just-submitted
 * update for today - the edge function reads the caller's own row server-side
 * rather than trusting anything from the client. Meant to be called right
 * after submitFocusFiveDailyUpdate() succeeds. */
export async function sendFocusFiveUpdateEmail() {
  const { data, error } = await supabase.functions.invoke('focus-five-update-email', { body: {} });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}
