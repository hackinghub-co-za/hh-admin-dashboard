// A member's own written answers to the fixed interview-question set in
// InterviewPlaybookGuideModal.jsx (supabase/082_interview_playbook_answers.sql).
// Only called for real (non-mock) sessions - Mock Member keeps answers in
// local-only state instead, same as every other mock-session fallback in
// this app.

import { supabase } from './supabase';

/** The signed-in member's own saved answers, keyed by question - RLS scopes
 * this to their own row, so no explicit email filter is needed. Returns {}
 * if they haven't written anything yet. */
export async function fetchMyInterviewPlaybookAnswers() {
  const { data, error } = await supabase
    .from('interview_playbook_answers')
    .select('answers')
    .maybeSingle();
  if (error) throw error;
  return data?.answers || {};
}

/** Saves one answer without disturbing any of the others already written. */
export async function saveMyInterviewPlaybookAnswer(questionKey, answer) {
  const { error } = await supabase.rpc('save_my_interview_playbook_answer', {
    p_question_key: questionKey,
    p_answer: answer,
  });
  if (error) throw error;
}
