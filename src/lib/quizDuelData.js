// Quiz Duel (supabase/062_quiz_duels.sql) - Phase 1 of the head-to-head
// competitions roadmap. Questions are only ever fetched via
// get_duel_questions() (never a direct table read), and answers are graded
// server-side inside submit_duel_answer() - the client never sees
// correct_index for a question it hasn't answered yet.

import { supabase } from './supabase';

function mapDuel(row) {
  return {
    id: row.id,
    opponentEmail: row.opponent_email,
    opponentName: row.opponent_name || '',
    isMemberA: row.is_member_a,
    status: row.status,
    winnerEmail: row.winner_email,
    myCorrectCount: row.my_correct_count,
    opponentCorrectCount: row.opponent_correct_count,
    totalQuestions: row.total_questions,
    myAnsweredCount: row.my_answered_count,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

export async function challengeToDuel(opponentEmail, opponentName) {
  const { data, error } = await supabase.rpc('challenge_to_duel', {
    p_opponent_email: opponentEmail,
    p_opponent_name: opponentName || null,
  });
  if (error) throw error;
  return data;
}

export async function fetchMyDuels() {
  const { data, error } = await supabase.rpc('get_my_duels');
  if (error) throw error;
  return (data || []).map(mapDuel);
}

export async function fetchDuelQuestions(duelId) {
  const { data, error } = await supabase.rpc('get_duel_questions', { p_duel_id: duelId });
  if (error) throw error;
  return (data || []).map((q) => ({
    id: q.id,
    domain: q.domain,
    question: q.question,
    choices: q.choices || [],
  }));
}

export async function submitDuelAnswer(duelId, questionId, chosenIndex) {
  const { data, error } = await supabase.rpc('submit_duel_answer', {
    p_duel_id: duelId,
    p_question_id: questionId,
    p_chosen_index: chosenIndex,
  });
  if (error) throw error;
  return data === true;
}
