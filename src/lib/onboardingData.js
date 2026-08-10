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
