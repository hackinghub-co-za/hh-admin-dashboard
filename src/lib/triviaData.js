// Live Buzzer Trivia (supabase/066_live_trivia.sql) - Phase 3 of the
// head-to-head competitions roadmap, and the first feature in this project
// to use Supabase Realtime. Every write goes through a SECURITY DEFINER
// RPC (never a direct table write) exactly like every other member-facing
// feature in this app; what's new here is that clients also *subscribe* to
// live changes on trivia_sessions/trivia_participants/trivia_buzzes via
// Postgres Changes, instead of only ever fetching on demand.

import { supabase } from './supabase';

function mapSession(row) {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    currentQuestionIndex: row.current_question_index,
    currentQuestionLocked: row.current_question_locked,
    totalQuestions: Array.isArray(row.question_ids) ? row.question_ids.length : 0,
    createdBy: row.created_by,
    createdAt: row.created_at,
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

/** The most recent trivia session that isn't finished, if any - a single
 * live community event at a time, same operational assumption the RPCs
 * document (nothing technical stops two, but there's only ever meant to be
 * one running). Falls back to the most recent Completed one so a member
 * landing right after it ends still sees final standings instead of
 * nothing. */
export async function fetchLatestTriviaSession() {
  const { data, error } = await supabase
    .from('trivia_sessions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ? mapSession(data) : null;
}

export async function fetchTriviaSession(sessionId) {
  const { data, error } = await supabase.from('trivia_sessions').select('*').eq('id', sessionId).maybeSingle();
  if (error) throw error;
  return data ? mapSession(data) : null;
}

/** Live-subscribes to one session's row (status/question index/lock state
 * changing) - fires `onChange` with the mapped session on every UPDATE.
 * Returns an unsubscribe function; always call it on unmount/tab-away, a
 * leaked channel keeps listening (and keeps the socket open) forever. */
export function subscribeToTriviaSession(sessionId, onChange) {
  const channel = supabase
    .channel(`trivia-session-${sessionId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'trivia_sessions', filter: `id=eq.${sessionId}` },
      (payload) => onChange(mapSession(payload.new))
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

/** Live-subscribes to a session's participant rows (scores changing, new
 * joiners) - fires `onChange` with no payload (just a signal to refetch
 * the leaderboard) since a score change plus a new-join both just mean
 * "the standings are stale now", not something worth diffing client-side. */
export function subscribeToTriviaParticipants(sessionId, onChange) {
  const channel = supabase
    .channel(`trivia-participants-${sessionId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'trivia_participants', filter: `session_id=eq.${sessionId}` },
      () => onChange()
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

/** Live-subscribes to new buzz-ins for a session - powers a "who just
 * buzzed" feed. Fires with the raw inserted row (mapped to camelCase). */
export function subscribeToTriviaBuzzes(sessionId, onBuzz) {
  const channel = supabase
    .channel(`trivia-buzzes-${sessionId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'trivia_buzzes', filter: `session_id=eq.${sessionId}` },
      (payload) => onBuzz({
        memberEmail: payload.new.member_email,
        memberName: payload.new.member_name || '',
        isCorrect: payload.new.is_correct,
        questionIndex: payload.new.question_index,
        buzzedAt: payload.new.buzzed_at,
      })
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export async function fetchCurrentTriviaQuestion(sessionId) {
  const { data, error } = await supabase.rpc('get_current_trivia_question', { p_session_id: sessionId });
  if (error) throw error;
  const row = (data || [])[0];
  if (!row) return null;
  return {
    id: row.id,
    domain: row.domain,
    question: row.question,
    choices: row.choices || [],
    questionNumber: row.question_number,
    totalQuestions: row.total_questions,
    locked: row.locked,
  };
}

export async function fetchTriviaLeaderboard(sessionId) {
  const { data, error } = await supabase.rpc('get_trivia_leaderboard', { p_session_id: sessionId });
  if (error) throw error;
  return (data || []).map((r) => ({
    memberEmail: r.member_email,
    memberName: r.member_name || '',
    score: r.score,
    isMe: r.is_me,
  }));
}

export async function joinTriviaSession(sessionId) {
  const { error } = await supabase.rpc('join_trivia_session', { p_session_id: sessionId });
  if (error) throw error;
}

/** Returns true if this buzz won the question - false means either the
 * answer was wrong, or someone else's buzz beat it to the lock (see the
 * row-lock fairness mechanism in buzz_in_trivia() itself). */
export async function buzzInTrivia(sessionId, chosenIndex) {
  const { data, error } = await supabase.rpc('buzz_in_trivia', { p_session_id: sessionId, p_chosen_index: chosenIndex });
  if (error) throw error;
  return data === true;
}

// ---- Admin ----

export async function createTriviaSession(title, questionCount) {
  const { data, error } = await supabase.rpc('create_trivia_session', { p_title: title, p_question_count: questionCount || 10 });
  if (error) throw error;
  return data;
}

export async function startTriviaSession(sessionId) {
  const { error } = await supabase.rpc('start_trivia_session', { p_session_id: sessionId });
  if (error) throw error;
}

export async function advanceTriviaQuestion(sessionId) {
  const { error } = await supabase.rpc('advance_trivia_question', { p_session_id: sessionId });
  if (error) throw error;
}

export async function endTriviaSession(sessionId) {
  const { error } = await supabase.rpc('end_trivia_session', { p_session_id: sessionId });
  if (error) throw error;
}
