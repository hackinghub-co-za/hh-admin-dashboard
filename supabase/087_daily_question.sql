-- Hacking Hub Admin Dashboard - Cyber Question of the Day, replacing the
-- TryHackMe Room of the Day widget (dropped in 086_drop_recommended_rooms.sql).
-- Run in the Supabase SQL Editor after 086. Safe to re-run.
--
-- Reuses duel_questions (062_quiz_duels.sql) as a read-only content pool
-- rather than inventing a third question bank - same precedent Live Buzzer
-- Trivia (066_live_trivia.sql) already established for itself, and the same
-- anti-cheat shape: duel_questions has no member-facing SELECT policy, so
-- the correct answer only ever reaches the client through a SECURITY
-- DEFINER RPC that omits correct_index, with grading always server-side.
-- "Today's" question is picked the same day-of-year modulo rotation
-- get_todays_recommended_room() (064, now dropped) used, so every member
-- sees the identical question on the identical day with no admin upkeep.
--
-- Two tables, same split as study_leaderboard/study_sessions (081):
-- daily_question_streaks is the running aggregate a member's streak reads
-- from; daily_question_answers is the permanent, append-only log each
-- submission writes to (also enforces one answer per member per day via
-- its UNIQUE constraint).
--
-- Streak counts correct answers only (confirmed with the founder) - a
-- wrong answer resets current_streak to 0 immediately, not just on some
-- future day, which is why last_correct_date and last_answered_date are
-- tracked separately: last_answered_date only answers "did they already
-- attempt today", last_correct_date is what the streak CASE logic keys off.

CREATE TABLE IF NOT EXISTS public.daily_question_answers (
  id BIGSERIAL PRIMARY KEY,
  member_email TEXT NOT NULL,
  question_date DATE NOT NULL,
  question_id BIGINT NOT NULL REFERENCES public.duel_questions(id),
  selected_index INTEGER NOT NULL,
  is_correct BOOLEAN NOT NULL,
  answered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (member_email, question_date)
);

ALTER TABLE public.daily_question_answers ENABLE ROW LEVEL SECURITY;

-- A member can see their own answer history - not a public leaderboard,
-- same "own rows only" shape as study_sessions.
DROP POLICY IF EXISTS "members read own daily question answers" ON public.daily_question_answers;
CREATE POLICY "members read own daily question answers"
  ON public.daily_question_answers FOR SELECT
  TO authenticated
  USING (member_email = lower(auth.jwt() ->> 'email'));

-- No member INSERT/UPDATE policy - submit_daily_question_answer() below is
-- the only write path, same "self-service via SECURITY DEFINER RPC, not
-- raw table access" pattern as study_sessions/log_study_session.
DROP POLICY IF EXISTS "admins manage daily question answers" ON public.daily_question_answers;
CREATE POLICY "admins manage daily question answers"
  ON public.daily_question_answers FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_daily_question_answers_member ON public.daily_question_answers (member_email, question_date);

CREATE TABLE IF NOT EXISTS public.daily_question_streaks (
  email TEXT PRIMARY KEY,
  current_streak INTEGER NOT NULL DEFAULT 0,
  last_correct_date DATE,
  last_answered_date DATE,
  total_correct INTEGER NOT NULL DEFAULT 0,
  total_answered INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.daily_question_streaks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read own daily question streak" ON public.daily_question_streaks;
CREATE POLICY "members read own daily question streak"
  ON public.daily_question_streaks FOR SELECT
  TO authenticated
  USING (email = lower(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "admins manage daily question streaks" ON public.daily_question_streaks;
CREATE POLICY "admins manage daily question streaks"
  ON public.daily_question_streaks FOR ALL
  USING (public.is_admin(auth.uid()));

-- STABLE, not VOLATILE: same day always yields the same question for every
-- caller. Single round trip - the caller always needs both the question and
-- their own today-status together to know what to render, same reasoning
-- get_my_duels() already applies to its own combined shape.
CREATE OR REPLACE FUNCTION public.get_todays_daily_question()
RETURNS TABLE (
  question_id BIGINT,
  domain TEXT,
  question TEXT,
  choices JSONB,
  already_answered BOOLEAN,
  was_correct BOOLEAN,
  selected_index INTEGER,
  current_streak INTEGER
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_today DATE := (timezone('utc'::text, now()))::date;
  v_count INTEGER;
  v_question_id BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.duel_questions;
  IF v_count = 0 THEN
    RETURN;
  END IF;

  SELECT dq.id INTO v_question_id
  FROM public.duel_questions dq
  ORDER BY dq.id
  OFFSET (EXTRACT(doy FROM v_today)::INTEGER % v_count)
  LIMIT 1;

  RETURN QUERY
  SELECT
    dq.id,
    dq.domain,
    dq.question,
    dq.choices,
    (a.id IS NOT NULL),
    a.is_correct,
    a.selected_index,
    COALESCE(s.current_streak, 0)
  FROM public.duel_questions dq
  LEFT JOIN public.daily_question_answers a
    ON a.question_id = dq.id AND a.member_email = v_email AND a.question_date = v_today
  LEFT JOIN public.daily_question_streaks s ON s.email = v_email
  WHERE dq.id = v_question_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_todays_daily_question() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_todays_daily_question() FROM PUBLIC, anon;

-- Grades and records the caller's answer to today's question. Re-derives
-- today's question server-side with the same modulo pick rather than
-- trusting a client-supplied question_id, and rejects a second same-day
-- submission (the UNIQUE constraint on daily_question_answers backs this up
-- too, belt-and-suspenders).
CREATE OR REPLACE FUNCTION public.submit_daily_question_answer(p_selected_index INTEGER)
RETURNS TABLE (is_correct BOOLEAN, current_streak INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_today DATE := (timezone('utc'::text, now()))::date;
  v_count INTEGER;
  v_question_id BIGINT;
  v_correct_index INTEGER;
  v_is_correct BOOLEAN;
  v_new_streak INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.duel_questions;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'No daily questions are set up yet.';
  END IF;

  SELECT dq.id, dq.correct_index INTO v_question_id, v_correct_index
  FROM public.duel_questions dq
  ORDER BY dq.id
  OFFSET (EXTRACT(doy FROM v_today)::INTEGER % v_count)
  LIMIT 1;

  IF EXISTS (
    SELECT 1 FROM public.daily_question_answers
    WHERE member_email = v_email AND question_date = v_today
  ) THEN
    RAISE EXCEPTION 'You already answered today''s question.';
  END IF;

  v_is_correct := (v_correct_index = p_selected_index);

  INSERT INTO public.daily_question_answers (member_email, question_date, question_id, selected_index, is_correct)
  VALUES (v_email, v_today, v_question_id, p_selected_index, v_is_correct);

  INSERT INTO public.daily_question_streaks AS s (
    email, current_streak, last_correct_date, last_answered_date, total_correct, total_answered, updated_at
  )
  VALUES (
    v_email,
    CASE WHEN v_is_correct THEN 1 ELSE 0 END,
    CASE WHEN v_is_correct THEN v_today ELSE NULL END,
    v_today,
    CASE WHEN v_is_correct THEN 1 ELSE 0 END,
    1,
    timezone('utc'::text, now())
  )
  ON CONFLICT (email) DO UPDATE SET
    current_streak = CASE
      WHEN NOT v_is_correct THEN 0
      WHEN s.last_correct_date = v_today - 1 THEN s.current_streak + 1
      ELSE 1
    END,
    last_correct_date = CASE WHEN v_is_correct THEN v_today ELSE s.last_correct_date END,
    last_answered_date = v_today,
    total_answered = s.total_answered + 1,
    total_correct = s.total_correct + CASE WHEN v_is_correct THEN 1 ELSE 0 END,
    updated_at = timezone('utc'::text, now())
  RETURNING s.current_streak INTO v_new_streak;

  RETURN QUERY SELECT v_is_correct, v_new_streak;
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_daily_question_answer(INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.submit_daily_question_answer(INTEGER) FROM PUBLIC, anon;
