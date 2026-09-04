// Persisted Cert Calendar data - target exam dates, cohorts, and pass/fail
// results. Only called for real (non-mock) sessions - Mock Member/Admin have
// no Supabase session, so those use local-only demo state instead.

import { supabase } from './supabase';

/** Fetch every cert calendar entry, soonest exam date first. RLS scopes this
 * to signed-in, approved members only. */
export async function fetchCertCalendar() {
  const { data, error } = await supabase
    .from('cert_calendar')
    .select('id, member, cert_name, date, cohort, result, created_by, member_email')
    .order('date', { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    member: row.member,
    cert: row.cert_name,
    date: row.date,
    cohort: row.cohort || 'General',
    result: row.result,
    createdBy: row.created_by || '',
    memberEmail: row.member_email || '',
  }));
}

/** Adds a new cert calendar entry, self-attributed to the current member (RLS
 * enforces created_by AND member_email can only ever be the caller's own
 * email for a self-submission, and result always starts 'Pending').
 * memberEmail is the actual certified member's email - callers must pass it
 * explicitly rather than relying on a fallback here, since defaulting to
 * createdBy would be wrong whenever an admin adds an entry on someone else's
 * behalf (createdBy would be the admin's own email, not the member's). */
export async function addCertCalendarEntry({ member, cert, date, cohort, createdBy, memberEmail }) {
  const { data, error } = await supabase
    .from('cert_calendar')
    .insert({
      member,
      cert_name: cert,
      date,
      cohort: cohort || null,
      created_by: createdBy.toLowerCase(),
      member_email: memberEmail ? memberEmail.toLowerCase() : null,
    })
    .select()
    .single();
  if (error) throw error;
  return {
    id: data.id,
    member: data.member,
    cert: data.cert_name,
    date: data.date,
    cohort: data.cohort || 'General',
    result: data.result,
    createdBy: data.created_by || '',
    memberEmail: data.member_email || '',
  };
}

/** Admin-only: updates the pass/fail result of a cert calendar entry. RLS
 * (admins manage cert calendar) rejects this for non-admins. */
export async function updateCertCalendarResult(id, result) {
  const { error } = await supabase.from('cert_calendar').update({ result }).eq('id', id);
  if (error) throw error;
}

/** Admin-only: edits any field of an existing cert calendar entry (not just
 * the result). RLS (admins manage cert calendar) rejects this for non-admins
 * - a member can only ever add their own entry, never edit one. */
export async function updateCertCalendarEntry(id, { member, cert, date, cohort, result, memberEmail }) {
  const { error } = await supabase
    .from('cert_calendar')
    .update({
      member,
      cert_name: cert,
      date,
      cohort: cohort || null,
      result,
      member_email: memberEmail ? memberEmail.toLowerCase() : null,
    })
    .eq('id', id);
  if (error) throw error;
}

/** Admin-only: removes a cert calendar entry entirely. RLS rejects this for
 * non-admins. */
export async function deleteCertCalendarEntry(id) {
  const { error } = await supabase.from('cert_calendar').delete().eq('id', id);
  if (error) throw error;
}

/** Admin: sends the member a congratulations email for one specific cert
 * calendar entry (supabase/functions/cert-pass-email) - a no-op server-side
 * (returns { skipped: true, reason }) if it isn't actually marked Passed,
 * has no member_email on file, or was already sent. Meant to be called
 * right after updateCertCalendarResult()/updateCertCalendarEntry() marks an
 * entry Passed, same trigger AdminDashboard's announceCertWin() already
 * uses to post the Recent Win. */
export async function sendCertPassEmail(certId) {
  const { data, error } = await supabase.functions.invoke('cert-pass-email', { body: { certId } });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}
