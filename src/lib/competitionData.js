// Persisted competition RSVP + leaderboard. Only called for real (non-mock)
// sessions - Mock Member has no Supabase session, so the Competitions tab shows
// local-only demo state instead (see MemberPortal.jsx).

import { supabase } from './supabase';

/** Fetch the full leaderboard, most rooms completed first (the actual prize
 * ranking - days_logged is shown as a secondary, informational column only).
 * RLS scopes this to signed-in, approved members only - no sensitive columns
 * here regardless. */
export async function fetchCompetitionStandings() {
  const { data, error } = await supabase
    .from('competition_standings')
    .select('email, member_name, rooms_completed, days_logged')
    .eq('opted_out', false)
    .order('rooms_completed', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => ({
    email: row.email,
    member: row.member_name,
    rooms: row.rooms_completed,
    daysLogged: row.days_logged,
  }));
}

/** RSVPs the current member for the active competition. Idempotent - re-calling
 * for an already-RSVP'd member is a harmless no-op server-side. Also clears a
 * prior opt-out (supabase/053_competition_opt_out.sql), so re-joining after
 * opting out resumes with whatever rooms_completed/days_logged they already
 * had rather than restarting at 0. */
export async function rsvpForCompetition(memberName) {
  const { error } = await supabase.rpc('rsvp_for_competition', { p_member_name: memberName });
  if (error) throw error;
}

/** Opts the current member out of the competition. Soft: their row and any
 * admin-entered progress stay intact, just hidden from fetchCompetitionStandings
 * (WHERE opted_out = false) until they RSVP again. Idempotent - a no-op if
 * they weren't RSVP'd (or already opted out) in the first place. */
export async function optOutOfCompetition() {
  const { error } = await supabase.rpc('opt_out_of_competition');
  if (error) throw error;
}
