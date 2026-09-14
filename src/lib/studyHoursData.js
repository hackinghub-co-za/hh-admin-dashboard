// Study Hours - Phase 1 of the "Competitive Study Mode" plan (see the
// study-mode planning artifact). Only called for real (non-mock) sessions -
// Mock Member has no Supabase session, so the Study Hours card under the
// TryHackMe leaderboard uses local-only demo state instead.

import { supabase } from './supabase';

/** Fetch the opted-in leaderboard, most total minutes first. RLS scopes
 * this to signed-in, approved members only. */
export async function fetchStudyLeaderboard() {
  const { data, error } = await supabase
    .from('study_leaderboard')
    .select('email, member_name, total_minutes, sessions_count, current_streak')
    .eq('opted_out', false)
    .order('total_minutes', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => ({
    email: row.email,
    member: row.member_name,
    minutes: row.total_minutes,
    sessions: row.sessions_count,
    streak: row.current_streak,
  }));
}

/** Joins (or rejoins after opting out) the current member for Study Hours.
 * Idempotent - re-calling for an already-joined member is a harmless no-op
 * server-side. */
export async function joinStudyHours(memberName) {
  const { error } = await supabase.rpc('join_study_hours', { p_member_name: memberName });
  if (error) throw error;
}

/** Opts the current member out. Soft: their row and every stat (total
 * minutes, streak, sessions) stay intact, just hidden from
 * fetchStudyLeaderboard until they join again. */
export async function optOutOfStudyHours() {
  const { error } = await supabase.rpc('opt_out_of_study_hours');
  if (error) throw error;
}

/** Logs one completed Pomodoro session (planned_minutes must be one of the
 * timer's real options - 25/45/60 - the RPC itself re-validates this, so a
 * spoofed value never reaches the leaderboard). Requires having joined
 * Study Hours first. cert is free text - same CERT_CATALOG_BY_VENDOR
 * vendor-then-cert picker Cert Calendar already uses, "Other" included. */
export async function logStudySession(cert, plannedMinutes) {
  const { error } = await supabase.rpc('log_study_session', { p_cert: cert || null, p_planned_minutes: plannedMinutes });
  if (error) throw error;
}
