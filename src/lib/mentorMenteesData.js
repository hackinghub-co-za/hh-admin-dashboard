// Mentor Mentees (080_mentor_mentees.sql) - which members a given mentor
// is actually assigned to. The real access boundary is enforced server-
// side by RLS (roadmap_items/cert_calendar policies now check
// is_mentor_of(member_email)) - this file is just CRUD for the assignment
// list itself, managed from the Team & Roles admin tab.

import { supabase } from './supabase';

/** Admin: every mentee currently assigned to one mentor, most recently
 * added first. */
export async function fetchMenteesForMentor(mentorEmail) {
  const { data, error } = await supabase
    .from('mentor_mentees')
    .select('id, mentee_email, added_at')
    .eq('mentor_email', mentorEmail.toLowerCase())
    .order('added_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => ({ id: row.id, menteeEmail: row.mentee_email, addedAt: row.added_at }));
}

/** Admin: assigns a member as one mentor's mentee. Harmless no-op if
 * already assigned (mentor_email + mentee_email is UNIQUE). */
export async function addMentee(mentorEmail, menteeEmail, addedBy) {
  const { error } = await supabase
    .from('mentor_mentees')
    .insert({ mentor_email: mentorEmail.toLowerCase(), mentee_email: menteeEmail.toLowerCase(), added_by: addedBy || null });
  if (error && error.code !== '23505') throw error; // 23505 = unique_violation, already assigned
}

/** Admin: unassigns a mentee from a mentor. */
export async function removeMentee(mentorEmail, menteeEmail) {
  const { error } = await supabase
    .from('mentor_mentees')
    .delete()
    .eq('mentor_email', mentorEmail.toLowerCase())
    .eq('mentee_email', menteeEmail.toLowerCase());
  if (error) throw error;
}
