// Roadmap Exclusions (079_roadmap_exclusions.sql) - members who've opted
// out of the Roadmap track entirely, admin-managed. An excluded member's
// own portal hides My Roadmap (sidebar + Dashboard preview tile), skips
// the "gone quiet" nudge and roadmap-reminder email, and they stop being
// auto-assigned Core Foundations items or counted in the admin Stale
// Roadmaps queue.

import { supabase } from './supabase';

/** Admin: every excluded member, most recently added first. */
export async function fetchRoadmapExclusions() {
  const { data, error } = await supabase
    .from('roadmap_excluded_members')
    .select('id, member_email, added_at')
    .order('added_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => ({ id: row.id, memberEmail: row.member_email, addedAt: row.added_at }));
}

/** Admin: excludes a member from the roadmap. Harmless no-op if already
 * excluded (member_email is UNIQUE). */
export async function addRoadmapExclusion(memberEmail, addedBy) {
  const { error } = await supabase
    .from('roadmap_excluded_members')
    .insert({ member_email: memberEmail.toLowerCase(), added_by: addedBy || null });
  if (error && error.code !== '23505') throw error; // 23505 = unique_violation, already excluded
}

/** Admin: re-includes a member in the roadmap. */
export async function removeRoadmapExclusion(memberEmail) {
  const { error } = await supabase.from('roadmap_excluded_members').delete().eq('member_email', memberEmail.toLowerCase());
  if (error) throw error;
}

/** Whether the signed-in member has opted out of the roadmap - RLS scopes
 * this to their own row, so it can never leak who else is excluded. */
export async function amIRoadmapExcluded() {
  const { data, error } = await supabase.from('roadmap_excluded_members').select('id').maybeSingle();
  if (error) throw error;
  return !!data;
}
