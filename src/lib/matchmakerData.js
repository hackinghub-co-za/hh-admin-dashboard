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
    recordingUrl: row.recording_url,
    notesUrl: row.notes_url,
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
    .select('id, activity_type, member_emails, status, due_date, recording_url, notes_url')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapGroupRow);
}

/** Admin: every group. */
export async function fetchAllGroups() {
  const { data, error } = await supabase
    .from('matchmaker_groups')
    .select('id, activity_type, member_emails, status, due_date, recording_url, notes_url')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapGroupRow);
}

/** Every group that has shared a recording - the "watch and rate" showcase.
 * RLS (030_matchmaker.sql, "members read groups with recordings") already
 * scopes this to recording_url IS NOT NULL for any approved member, own
 * group or not, so no extra filtering is needed here. */
export async function fetchShowcaseGroups() {
  const { data, error } = await supabase
    .from('matchmaker_groups')
    .select('id, activity_type, member_emails, status, due_date, recording_url, notes_url')
    .not('recording_url', 'is', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapGroupRow);
}

/** A member of the group shares (or updates) the link to their recorded
 * presentation. */
export async function submitGroupRecording(groupId, recordingUrl) {
  const { error } = await supabase.rpc('submit_group_recording', { p_group_id: groupId, p_recording_url: recordingUrl });
  if (error) throw error;
}

/** A member of the group shares (or updates) a link to their meeting notes -
 * same shape as submitGroupRecording, independent field. */
export async function submitGroupNotes(groupId, notesUrl) {
  const { error } = await supabase.rpc('submit_group_notes', { p_group_id: groupId, p_notes_url: notesUrl });
  if (error) throw error;
}

/** Rate a group's presentation (1-5) with an optional anonymous comment -
 * re-rating just overwrites the caller's own previous rating. */
export async function rateGroup(groupId, rating, comment) {
  const { error } = await supabase.rpc('rate_matchmaker_group', {
    p_group_id: groupId,
    p_rating: rating,
    p_comment: comment || null,
  });
  if (error) throw error;
}

/** Every rating + comment for a group, anonymised (no rater identity). */
export async function fetchGroupRatings(groupId) {
  const { data, error } = await supabase.rpc('get_group_ratings', { p_group_id: groupId });
  if (error) throw error;
  return (data || []).map((row) => ({ rating: row.rating, comment: row.comment, createdAt: row.created_at }));
}

/** What the signed-in member already rated this group, if anything. */
export async function fetchMyGroupRating(groupId) {
  const { data, error } = await supabase.rpc('get_my_group_rating', { p_group_id: groupId });
  if (error) throw error;
  const row = (data || [])[0];
  return row ? { rating: row.rating, comment: row.comment } : null;
}

/** Admin: shuffle the current opt-in pool into groups of 2-4 and consume it.
 * Returns how many groups were created. */
export async function runMatchmakerRound() {
  const { data, error } = await supabase.rpc('run_matchmaker_round');
  if (error) throw error;
  return data;
}

/** Admin: emails every member of every Active group that hasn't been
 * notified yet (supabase/functions/matchmaker-group-email) - idempotent, so
 * safe to call again if it partially fails or after a retry. Meant to be
 * called right after runMatchmakerRound() succeeds. */
export async function sendMatchmakerGroupEmails() {
  const { data, error } = await supabase.functions.invoke('matchmaker-group-email', { body: {} });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
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
