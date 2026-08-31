// Study Quiz System (supabase/054_quiz_system.sql). A real, first-party
// quiz engine that replaces the old "take a practice test somewhere else,
// then type your score into Exam Readiness by hand" flow - see
// submit_quiz_attempt() below, which logs the score automatically via the
// same log_my_practice_test_score() RPC exam_readiness has always used.
// Only called for real (non-mock) sessions - Mock Member has no Supabase
// session to fetch real questions from.

import { supabase } from './supabase';

/** Fetch a random subset of Published questions for a cert, choices
 * pre-shuffled server-side. Returns fewer than `limit` if the question
 * bank for that cert is smaller. */
export async function fetchQuizQuestions(certName, limit = 20) {
  const { data, error } = await supabase.rpc('get_quiz_questions', {
    p_cert_name: certName,
    p_limit: limit,
  });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    domain: row.domain,
    question: row.question,
    choices: row.choices,
    correctIndex: row.correct_index,
    explanation: row.explanation,
  }));
}

/** Submits a finished attempt for grading. Server computes the score (never
 * trust a client-computed one) and automatically logs it as this cert's
 * latest practice-test score. answers: [{ questionId, chosenIndex }]. */
export async function submitQuizAttempt(certName, mode, startedAt, answers) {
  const { data, error } = await supabase.rpc('submit_quiz_attempt', {
    p_cert_name: certName,
    p_mode: mode,
    p_started_at: startedAt,
    p_answers: answers,
  });
  if (error) throw error;
  const row = data?.[0];
  return {
    score: row?.score ?? 0,
    correctCount: row?.correct_count ?? 0,
    questionCount: row?.question_count ?? 0,
  };
}

/** This member's own quiz attempt history for a cert, most recent first -
 * powers a simple score-over-time view. RLS scopes this to their own rows. */
export async function fetchMyQuizAttempts(certName) {
  const { data, error } = await supabase
    .from('quiz_attempts')
    .select('id, cert_name, mode, score, question_count, correct_count, completed_at')
    .eq('cert_name', certName)
    .order('completed_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    certName: row.cert_name,
    mode: row.mode,
    score: row.score,
    questionCount: row.question_count,
    correctCount: row.correct_count,
    completedAt: row.completed_at,
  }));
}
