// Cyber Question of the Day (supabase/087_daily_question.sql) - reuses
// duel_questions as a read-only content pool, day-of-year rotation so every
// member sees the same question on the same day. Grading is server-side
// only; the RPC never returns the correct answer before a member submits.

import { supabase } from './supabase';

export async function fetchTodaysDailyQuestion() {
  const { data, error } = await supabase.rpc('get_todays_daily_question');
  if (error) throw error;
  const row = (data || [])[0];
  if (!row) return null;
  return {
    questionId: row.question_id,
    domain: row.domain,
    question: row.question,
    choices: row.choices,
    alreadyAnswered: row.already_answered,
    wasCorrect: row.was_correct,
    selectedIndex: row.selected_index,
    currentStreak: row.current_streak,
    explanation: row.explanation,
    totalAnsweredToday: row.total_answered_today,
    totalCorrectToday: row.total_correct_today,
  };
}

export async function submitDailyQuestionAnswer(selectedIndex) {
  const { data, error } = await supabase.rpc('submit_daily_question_answer', { p_selected_index: selectedIndex });
  if (error) throw error;
  const row = (data || [])[0];
  return {
    isCorrect: row?.is_correct,
    currentStreak: row?.current_streak,
    explanation: row?.explanation,
    totalAnsweredToday: row?.total_answered_today,
    totalCorrectToday: row?.total_correct_today,
  };
}
