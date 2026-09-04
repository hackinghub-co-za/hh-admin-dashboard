// Weekly LinkedIn post confirmation (supabase/059_linkedin_weekly_post.sql).
// Distinct from linkedInPlaybookData.js (pure content: themes/example
// posts/hashtags, no Supabase calls) - this file is purely the RPC
// wrappers for confirming/reading this week's status. Only called for real
// (non-mock) sessions.

import { supabase } from './supabase';

/** Mark the current ISO week as posted for the signed-in member. Safe to
 * call more than once in the same week (upserts, no duplicate row). */
export async function confirmMyLinkedInPost() {
  const { error } = await supabase.rpc('confirm_my_linkedin_post');
  if (error) throw error;
}

/** Whether the signed-in member has already confirmed for the current week. */
export async function fetchMyLinkedInPostStatus() {
  const { data, error } = await supabase.rpc('get_my_linkedin_post_status');
  if (error) throw error;
  return !!data;
}

/** Admin: whether a given member has confirmed for the current week, and
 * when they last confirmed (regardless of week) - computed server-side
 * (get_member_linkedin_post_status) so "what week is it" is defined in
 * exactly one place, not re-derived here. */
export async function fetchMemberLinkedInPostStatus(memberEmail) {
  const { data, error } = await supabase.rpc('get_member_linkedin_post_status', { p_email: memberEmail });
  if (error) throw error;
  const row = (data || [])[0];
  return {
    confirmedThisWeek: !!row?.confirmed_this_week,
    lastConfirmedAt: row?.last_confirmed_at || null,
  };
}
