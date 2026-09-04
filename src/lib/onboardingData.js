// Supabase-backed "has this member seen the onboarding sequence" check. Only called
// for real (non-mock) sessions - Mock Member has no Supabase session for these RPCs
// to act on, so it just shows the sequence locally instead (see App.jsx).

import { supabase } from './supabase';

/** True if this email has already completed onboarding. */
export async function checkOnboardingStatus(email) {
  const { data, error } = await supabase.rpc('has_completed_onboarding', { check_email: email });
  if (error) throw error;
  return data === true;
}

/** Marks the current signed-in user's own row as onboarded. */
export async function markOnboardingComplete() {
  const { error } = await supabase.rpc('mark_onboarding_complete');
  if (error) throw error;
}

/** When this member's Getting Started grace period started (see
 * 006_onboarding.sql PART 3) - null if they haven't completed the one-time
 * intro yet. Used by App.jsx to compute whether the hard gate should be
 * active. */
export async function getMyGettingStartedGraceStartedAt() {
  const { data, error } = await supabase.rpc('get_my_getting_started_grace_started_at');
  if (error) throw error;
  return data;
}

/** The fixed set of checklist steps a new member works through, in display order. */
export const ONBOARDING_STEPS = [
  { key: 'watch_video', label: 'Watch the onboarding video' },
  { key: 'book_1on1', label: 'Book your first 1-on-1' },
  { key: 'join_whatsapp', label: 'Join the WhatsApp community' },
  { key: 'install_calendar', label: 'Install Google Calendar' },
  { key: 'setup_profile', label: 'Set up your profile' },
  { key: 'portal_tour', label: 'Take the portal tour' },
];

/** Fetches the current signed-in member's own completed step keys. */
export async function fetchMyOnboardingSteps() {
  const { data, error } = await supabase.from('member_onboarding_steps').select('step_key, completed_at');
  if (error) throw error;
  return (data || []).reduce((byKey, row) => {
    byKey[row.step_key] = row.completed_at;
    return byKey;
  }, {});
}

/** Marks one checklist step complete for the current signed-in member. Idempotent. */
export async function markMyOnboardingStepComplete(stepKey) {
  const { error } = await supabase.rpc('mark_my_onboarding_step_complete', { p_step_key: stepKey });
  if (error) throw error;
}

/**
 * Admin-only: every member's checklist progress in one call, so the admin
 * dashboard can compute each member's completion without a per-member
 * fetch. Relies on member_onboarding_steps' "admins manage onboarding
 * steps" RLS policy (is_admin(auth.uid())) rather than a wrapped RPC, same
 * as fetchAllRoadmapItems().
 */
export async function fetchAllOnboardingSteps() {
  const { data, error } = await supabase.from('member_onboarding_steps').select('member_email, step_key, completed_at');
  if (error) throw error;
  return data || [];
}
