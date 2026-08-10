// Supabase-backed member-side offboarding RPCs. Only called for real (non-mock)
// sessions - Mock Member has no Supabase session for these to act on (see App.jsx).

import { supabase } from './supabase';

/** True if this email is currently in the 'Leaving' grace period. */
export async function checkOffboardingPending(email) {
  const { data, error } = await supabase.rpc('is_offboarding_pending', { check_email: email });
  if (error) throw error;
  return data === true;
}

/** Submits the current member's exit feedback (or blank fields to skip it) and
 * finalizes their own row to status = 'Left'. */
export async function submitExitFeedback({ rating, feedback }) {
  const { error } = await supabase.rpc('submit_exit_feedback', {
    feedback_rating: rating || null,
    feedback_text: feedback || null,
  });
  if (error) throw error;
}
