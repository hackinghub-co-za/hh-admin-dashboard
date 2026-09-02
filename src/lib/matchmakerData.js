// Matchmaker - opt-in pool + randomized groups (supabase/030_matchmaker.sql).
// Members join/leave the pool themselves; only an admin can run a round,
// which shuffles everyone in the pool into groups of 2-4 and consumes the
// pool. Only called for real (non-mock) sessions - Mock Member/Mock Admin
// have no Supabase session, so both portals use local-only demo state
// instead.

import { supabase } from './supabase';

function mapGroupRow(row) {
  return {
    id: row.id,
    activityType: row.activity_type,
    memberEmails: row.member_emails || [],
    status: row.status,
    dueDate: row.due_date,
  };
}

/** Everyone currently in the opt-in pool (visible to all approved members). */
export async function fetchOptinPool() {
  const { data, error } = await supabase.from('matchmaker_optins').select('member_email').order('opted_in_at', { ascending: true });
  if (error) throw error;
  return (data || []).map((row) => row.member_email);
}

/** Join the pool for the next round. */
export async function joinOptinPool(email) {
  const { error } = await supabase.from('matchmaker_optins').insert({ member_email: email.toLowerCase() });
  if (error) throw error;
}

/** Leave the pool before a round runs. */
export async function leaveOptinPool(email) {
  const { error } = await supabase.from('matchmaker_optins').delete().eq('member_email', email.toLowerCase());
  if (error) throw error;
}

/** The signed-in member's own group(s). */
export async function fetchMyGroups() {
  const { data, error } = await supabase
    .from('matchmaker_groups')
    .select('id, activity_type, member_emails, status, due_date')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapGroupRow);
}

/** Admin: every group. */
export async function fetchAllGroups() {
  const { data, error } = await supabase
    .from('matchmaker_groups')
    .select('id, activity_type, member_emails, status, due_date')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapGroupRow);
}

/** Admin: shuffle the current opt-in pool into groups of 2-4 and consume it.
 * Returns how many groups were created. */
export async function runMatchmakerRound() {
  const { data, error } = await supabase.rpc('run_matchmaker_round');
  if (error) throw error;
  return data;
}

/** Admin: mark a group Completed (or back to Active). */
export async function updateGroupStatus(id, status) {
  const { error } = await supabase.from('matchmaker_groups').update({ status }).eq('id', id);
  if (error) throw error;
}

/** Admin: change when a group's project/presentation is due. */
export async function updateGroupDueDate(id, dueDate) {
  const { error } = await supabase.from('matchmaker_groups').update({ due_date: dueDate || null }).eq('id', id);
  if (error) throw error;
}

/** Admin: remove a group entirely. */
export async function deleteGroup(id) {
  const { error } = await supabase.from('matchmaker_groups').delete().eq('id', id);
  if (error) throw error;
}
