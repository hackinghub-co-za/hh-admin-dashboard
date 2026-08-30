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
 * for an already-RSVP'd member is a harmless no-op server-side. */
export async function rsvpForCompetition(memberName) {
  const { error } = await supabase.rpc('rsvp_for_competition', { p_member_name: memberName });
  if (error) throw error;
}
