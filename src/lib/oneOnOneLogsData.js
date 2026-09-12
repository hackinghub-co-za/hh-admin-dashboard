// Manually logged 1-on-1 sessions (071_overdue_1on1_digest.sql). Real
// bookings happen entirely outside Supabase - "Book a 1on1 Strategy
// Session" (MemberPortal.jsx) just opens the mentor's live Google Calendar
// as a plain external link, so nothing is ever recorded there. This table
// is the only record that a session actually happened, until a real
// calendar integration replaces it (see 071's own header). An admin or
// mentor logs one right after a real session, from the Roadmaps tab.

import { supabase } from './supabase';

function mapRow(row) {
  return {
    id: row.id,
    memberEmail: row.member_email,
    mentorName: row.mentor_name,
    sessionDate: row.session_date,
    topic: row.topic || '',
    loggedBy: row.logged_by,
    createdAt: row.created_at,
  };
}

/** Every 1-on-1 logged for one member, most recent first. RLS scopes this
 * to admins/mentors (any member's rows) or the member themselves (their
 * own only). */
export async function fetchOneOnOneLogsForMember(email) {
  const { data, error } = await supabase
    .from('one_on_one_logs')
    .select('id, member_email, mentor_name, session_date, topic, logged_by, created_at')
    .eq('member_email', email.toLowerCase())
    .order('session_date', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapRow);
}

/** Admin/mentor: log a session that just happened. */
export async function logOneOnOne({ memberEmail, mentorName, sessionDate, topic, loggedBy }) {
  const { data, error } = await supabase
    .from('one_on_one_logs')
    .insert({
      member_email: memberEmail.toLowerCase(),
      mentor_name: mentorName,
      session_date: sessionDate,
      topic: topic || null,
      logged_by: loggedBy.toLowerCase(),
    })
    .select()
    .single();
  if (error) throw error;
  return mapRow(data);
}

/** Admin/mentor: remove a mis-logged entry. */
export async function deleteOneOnOneLog(id) {
  const { error } = await supabase.from('one_on_one_logs').delete().eq('id', id);
  if (error) throw error;
}
