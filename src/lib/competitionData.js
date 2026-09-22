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

  // Prize eligibility (070_competition_seasons.sql) - recoverable pace gate,
  // computed live server-side. Fails open (everyone stays eligible) rather
  // than silently disqualifying real prize contenders if this lookup
  // itself errors - the leaderboard/RSVP flow shouldn't break over it.
  let eligibleByEmail = {};
  try {
    const { data: eligibility, error: eligibilityError } = await supabase.rpc('get_competition_prize_eligibility');
    if (eligibilityError) throw eligibilityError;
    eligibleByEmail = Object.fromEntries((eligibility || []).map((r) => [r.email, r.eligible]));
  } catch {
    eligibleByEmail = {};
  }

  return (data || []).map((row) => ({
    email: row.email,
    member: row.member_name,
    rooms: row.rooms_completed,
    daysLogged: row.days_logged,
    eligible: eligibleByEmail[row.email] ?? true,
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

/** Admin: soft-removes a member from the current competition - same
 * reversible opted_out flag the member's own self-service opt-out uses
 * above, just settable by an admin for someone else's row. Their
 * rooms_completed/days_logged stay intact, so re-adding them later
 * (flipping opted_out back to false, or them RSVPing again) picks back up
 * where they left off rather than restarting at 0. Relies on the existing
 * "admins manage competition standings" RLS policy (FOR ALL) rather than a
 * dedicated RPC - no new migration needed. */
export async function removeMemberFromCompetition(email) {
  const { error } = await supabase.from('competition_standings').update({ opted_out: true }).eq('email', email.toLowerCase());
  if (error) throw error;
}

function mapCompetition(row) {
  return {
    id: row.id,
    title: row.title,
    platform: row.platform || '',
    description: row.description || '',
    startDate: row.start_date,
    endDate: row.end_date,
    prizes: row.prizes || [],
    eligibilityCheckpoints: row.eligibility_checkpoints || [],
    isCurrent: row.is_current,
    standingsSnapshot: row.standings_snapshot || null,
    archivedAt: row.archived_at || null,
  };
}

/** The competition currently running (title/dates/prizes) - replaces what
 * used to be a hardcoded object in MemberPortal.jsx. null only if nobody's
 * ever started one, which shouldn't happen once 070_competition_seasons.sql
 * has run (it seeds the real, currently-running one on first apply). */
export async function fetchCurrentCompetition() {
  const { data, error } = await supabase
    .from('competitions')
    .select('id, title, platform, description, start_date, end_date, prizes, eligibility_checkpoints, is_current')
    .eq('is_current', true)
    .maybeSingle();
  if (error) throw error;
  return data ? mapCompetition(data) : null;
}

/** Admin/CM: every past (archived) competition, most recent first, each
 * carrying the full standings snapshot from the moment it ended - the
 * lossless history start_new_competition() preserves instead of just
 * wiping competition_standings outright. */
export async function fetchPastCompetitions() {
  const { data, error } = await supabase
    .from('competitions')
    .select('id, title, platform, description, start_date, end_date, prizes, eligibility_checkpoints, is_current, standings_snapshot, archived_at')
    .eq('is_current', false)
    .order('end_date', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapCompetition);
}

/** Admin/CM: archives the current competition (with a full standings
 * snapshot) and starts a new one - competition_standings is cleared for a
 * fresh quarter as part of the same call; daily_room_logs is untouched. */
export async function startNewCompetition({ title, platform, description, startDate, endDate, prizes, eligibilityCheckpoints }) {
  const { data, error } = await supabase.rpc('start_new_competition', {
    p_title: title,
    p_platform: platform || null,
    p_description: description || null,
    p_start_date: startDate,
    p_end_date: endDate,
    p_prizes: prizes || [],
    p_eligibility_checkpoints: eligibilityCheckpoints || [],
  });
  if (error) throw error;
  return data;
}
