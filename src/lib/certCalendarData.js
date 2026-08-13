// Persisted Cert Calendar data - target exam dates, cohorts, and pass/fail
// results. Only called for real (non-mock) sessions - Mock Member/Admin have
// no Supabase session, so those use local-only demo state instead.

import { supabase } from './supabase';

/** Fetch every cert calendar entry, soonest exam date first. RLS scopes this
 * to signed-in, approved members only. */
export async function fetchCertCalendar() {
  const { data, error } = await supabase
    .from('cert_calendar')
    .select('id, member, cert_name, date, cohort, result, created_by')
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
  }));
}

/** Adds a new cert calendar entry, self-attributed to the current member (RLS
 * enforces created_by can only ever be the caller's own email, and result
 * always starts 'Pending'). */
export async function addCertCalendarEntry({ member, cert, date, cohort, createdBy }) {
  const { data, error } = await supabase
    .from('cert_calendar')
    .insert({
      member,
      cert_name: cert,
      date,
      cohort: cohort || null,
      created_by: createdBy.toLowerCase(),
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
  };
}

/** Admin-only: updates the pass/fail result of a cert calendar entry. RLS
 * (admins manage cert calendar) rejects this for non-admins. */
export async function updateCertCalendarResult(id, result) {
  const { error } = await supabase.from('cert_calendar').update({ result }).eq('id', id);
  if (error) throw error;
}
