-- Hacking Hub Admin Dashboard - Live Buzzer Trivia (Phase 3 of the
-- head-to-head competitions roadmap - see the "Duel Protocol" planning
-- artifact). Run after 002-065 have already been applied. Safe to re-run.
--
-- Unlike Quiz Duel (async, 1v1, 48-hour window) and Room Race (async, 1v1,
-- admin-approved), this is the one format that's genuinely live: an admin
-- hosts a single session, any number of members join, everyone sees the
-- same question at the same moment, and it's a race to buzz in first -
-- exactly the "new technical capability, not a variation on an existing
-- pattern" the original plan flagged this as needing. This is the first
-- table in this project to use Supabase Realtime (Postgres Changes) -
-- every other live-feeling thing in this app (notifications, leaderboards)
-- is actually just polling/refetch-on-navigate.
--
-- FAIRNESS, THE PART THE ORIGINAL PLAN WORRIED ABOUT: two members' buzz-ins
-- can arrive within milliseconds of each other, and their network latency
-- to Supabase is never equal - client-reported timestamps would be both
-- spoofable and unfair (whoever has worse WiFi always loses). buzz_in()
-- below sidesteps this entirely by never trusting a client-side time at
-- all: it takes a row lock (SELECT ... FOR UPDATE) on the session before
-- doing anything, which makes Postgres itself serialize concurrent buzz
-- attempts for the same question one at a time - whichever request's
-- transaction actually acquires the lock first is authoritative, full
-- stop, the same server-authoritative-order principle a real TV game
-- show's buzzer hardware uses.
--
-- Reuses duel_questions (062_quiz_duels.sql) rather than a third question
-- bank - same 21-question, 7-domain, track-agnostic set already built for
-- exactly "fair regardless of which track either player is on", and the
-- same anti-cheat rule applies: members never receive correct_index
-- directly, only through get_current_trivia_question() below.

-- =========================================================================
-- SCHEMA
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.trivia_sessions (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  question_ids JSONB NOT NULL,                 -- fixed, ordered array of duel_questions.id
  current_question_index INTEGER NOT NULL DEFAULT -1,  -- -1 = lobby, not started yet
  current_question_locked BOOLEAN NOT NULL DEFAULT false, -- true once someone has won the current question
  current_question_started_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'Waiting' CHECK (status IN ('Waiting', 'Active', 'Completed')),
  created_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.trivia_sessions ENABLE ROW LEVEL SECURITY;

-- A live session is a community event, not a private 1:1 like Quiz Duel -
-- every active member can see it exists and watch it progress, whether or
-- not they've joined as a participant.
DROP POLICY IF EXISTS "members read trivia sessions" ON public.trivia_sessions;
CREATE POLICY "members read trivia sessions"
  ON public.trivia_sessions FOR SELECT
  TO authenticated
  USING (public.is_member_allowed(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "admins manage trivia sessions" ON public.trivia_sessions;
CREATE POLICY "admins manage trivia sessions"
  ON public.trivia_sessions FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.trivia_participants (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES public.trivia_sessions(id) ON DELETE CASCADE,
  member_email TEXT NOT NULL,
  member_name TEXT,
  score INTEGER NOT NULL DEFAULT 0,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (session_id, member_email)
);

ALTER TABLE public.trivia_participants ENABLE ROW LEVEL SECURITY;

-- Everyone in the room needs to see everyone else's live score - that's
-- the whole point of a scoreboard - so this is readable by any active
-- member, not scoped to "your own row" the way quiz_duels is.
DROP POLICY IF EXISTS "members read trivia participants" ON public.trivia_participants;
CREATE POLICY "members read trivia participants"
  ON public.trivia_participants FOR SELECT
  TO authenticated
  USING (public.is_member_allowed(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "admins manage trivia participants" ON public.trivia_participants;
CREATE POLICY "admins manage trivia participants"
  ON public.trivia_participants FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.trivia_buzzes (
  id BIGSERIAL PRIMARY KEY,
  session_id BIGINT NOT NULL REFERENCES public.trivia_sessions(id) ON DELETE CASCADE,
  question_id BIGINT NOT NULL REFERENCES public.duel_questions(id),
  question_index INTEGER NOT NULL,
  member_email TEXT NOT NULL,
  member_name TEXT,
  chosen_index INTEGER NOT NULL,
  is_correct BOOLEAN NOT NULL,
  buzzed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (session_id, question_index, member_email)  -- one buzz attempt per member per question
);

ALTER TABLE public.trivia_buzzes ENABLE ROW LEVEL SECURITY;

-- Same "the room can see it" transparency as a real buzzer show - everyone
-- watching sees who buzzed and whether they got it right, not just the
-- admin. This never exposes correct_index itself (that lives on
-- duel_questions, not here) - is_correct is the graded outcome, computed
-- server-side in buzz_in() below, same anti-cheat boundary as Quiz Duel.
DROP POLICY IF EXISTS "members read trivia buzzes" ON public.trivia_buzzes;
CREATE POLICY "members read trivia buzzes"
  ON public.trivia_buzzes FOR SELECT
  TO authenticated
  USING (public.is_member_allowed(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "admins manage trivia buzzes" ON public.trivia_buzzes;
CREATE POLICY "admins manage trivia buzzes"
  ON public.trivia_buzzes FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_trivia_participants_session ON public.trivia_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_trivia_buzzes_session ON public.trivia_buzzes(session_id, question_index);

-- Enables Postgres Changes for these three tables - the first Realtime
-- usage anywhere in this project. Every client watching a session
-- subscribes to trivia_sessions (question advances, locks) and
-- trivia_participants (live scores); trivia_buzzes powers the "who just
-- buzzed" live feed. Safe to re-run - adding an already-added table to a
-- publication is a no-op error we swallow via the DO block.
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trivia_sessions;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trivia_participants;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trivia_buzzes;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- =========================================================================
-- ADMIN: SESSION LIFECYCLE
-- =========================================================================

-- Creates a new session in the lobby ('Waiting') - picks p_question_count
-- random duel_questions, same random-selection approach as
-- challenge_to_duel(). Only one non-Completed session should really exist
-- at a time in practice (this is a single live community event, not many
-- concurrent ones), but nothing here enforces that - it's an operational
-- convention, not a technical constraint, same trust level as an admin
-- running run_matchmaker_round() only when they mean to.
CREATE OR REPLACE FUNCTION public.create_trivia_session(p_title TEXT, p_question_count INTEGER DEFAULT 10)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_question_ids JSONB;
  v_id BIGINT;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can create a trivia session.';
  END IF;
  IF trim(coalesce(p_title, '')) = '' THEN
    RAISE EXCEPTION 'Give the session a title.';
  END IF;

  SELECT jsonb_agg(id) INTO v_question_ids FROM (
    SELECT id FROM public.duel_questions ORDER BY random() LIMIT greatest(p_question_count, 1)
  ) q;

  IF v_question_ids IS NULL OR jsonb_array_length(v_question_ids) = 0 THEN
    RAISE EXCEPTION 'No trivia questions are set up yet.';
  END IF;

  INSERT INTO public.trivia_sessions (title, question_ids, created_by)
  VALUES (trim(p_title), v_question_ids, lower(auth.jwt() ->> 'email'))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_trivia_session(TEXT, INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_trivia_session(TEXT, INTEGER) FROM PUBLIC, anon;

-- Moves a session from the lobby to question 1 - members already in the
-- lobby see this the instant it happens via the trivia_sessions Realtime
-- subscription, no refresh needed.
CREATE OR REPLACE FUNCTION public.start_trivia_session(p_session_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can start a trivia session.';
  END IF;

  UPDATE public.trivia_sessions
  SET status = 'Active',
      current_question_index = 0,
      current_question_locked = false,
      current_question_started_at = timezone('utc'::text, now()),
      started_at = timezone('utc'::text, now())
  WHERE id = p_session_id AND status = 'Waiting';
END;
$$;
GRANT EXECUTE ON FUNCTION public.start_trivia_session(BIGINT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.start_trivia_session(BIGINT) FROM PUBLIC, anon;

-- Moves to the next question, or ends the session once the last question's
-- been shown. The admin controls pacing by design (reading the room, not a
-- fixed countdown) - a strict per-question timer is a reasonable v2, not
-- required for a working live session.
CREATE OR REPLACE FUNCTION public.advance_trivia_question(p_session_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session public.trivia_sessions%ROWTYPE;
  v_total INTEGER;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can advance the session.';
  END IF;

  SELECT * INTO v_session FROM public.trivia_sessions WHERE id = p_session_id;
  IF v_session.id IS NULL OR v_session.status != 'Active' THEN
    RAISE EXCEPTION 'This session is not active.';
  END IF;

  v_total := jsonb_array_length(v_session.question_ids);

  IF v_session.current_question_index + 1 >= v_total THEN
    UPDATE public.trivia_sessions
    SET status = 'Completed', completed_at = timezone('utc'::text, now())
    WHERE id = p_session_id;
  ELSE
    UPDATE public.trivia_sessions
    SET current_question_index = current_question_index + 1,
        current_question_locked = false,
        current_question_started_at = timezone('utc'::text, now())
    WHERE id = p_session_id;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.advance_trivia_question(BIGINT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.advance_trivia_question(BIGINT) FROM PUBLIC, anon;

-- Lets an admin cut a session short (e.g. a real emergency, or it's just
-- not working out) without waiting to click through every remaining
-- question.
CREATE OR REPLACE FUNCTION public.end_trivia_session(p_session_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can end a trivia session.';
  END IF;

  UPDATE public.trivia_sessions
  SET status = 'Completed', completed_at = timezone('utc'::text, now())
  WHERE id = p_session_id AND status IN ('Waiting', 'Active');
END;
$$;
GRANT EXECUTE ON FUNCTION public.end_trivia_session(BIGINT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.end_trivia_session(BIGINT) FROM PUBLIC, anon;

-- =========================================================================
-- MEMBER: JOIN, READ, BUZZ
-- =========================================================================

-- Late joins are allowed (Waiting or Active) - arriving mid-session with a
-- score of 0 is a reasonable real-world case for a live community event,
-- unlike Quiz Duel's fixed 1:1 pairing.
CREATE OR REPLACE FUNCTION public.join_trivia_session(p_session_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_name TEXT;
  v_status TEXT;
BEGIN
  SELECT status INTO v_status FROM public.trivia_sessions WHERE id = p_session_id;
  IF v_status IS NULL OR v_status = 'Completed' THEN
    RAISE EXCEPTION 'This session is not open to join.';
  END IF;

  SELECT full_name INTO v_name FROM public.member_profiles WHERE email = v_email;

  INSERT INTO public.trivia_participants (session_id, member_email, member_name)
  VALUES (p_session_id, v_email, v_name)
  ON CONFLICT (session_id, member_email) DO NOTHING;
END;
$$;
GRANT EXECUTE ON FUNCTION public.join_trivia_session(BIGINT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.join_trivia_session(BIGINT) FROM PUBLIC, anon;

-- The current question, never including correct_index - same anti-cheat
-- boundary as get_duel_questions(). Returns nothing if the session is in
-- the lobby (current_question_index = -1) or already completed.
CREATE OR REPLACE FUNCTION public.get_current_trivia_question(p_session_id BIGINT)
RETURNS TABLE (
  id BIGINT, domain TEXT, question TEXT, choices JSONB,
  question_number INTEGER, total_questions INTEGER, locked BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE
AS $$
DECLARE
  v_session public.trivia_sessions%ROWTYPE;
  v_question_id BIGINT;
BEGIN
  SELECT * INTO v_session FROM public.trivia_sessions WHERE id = p_session_id;
  IF v_session.id IS NULL OR v_session.current_question_index < 0 THEN
    RETURN;
  END IF;

  v_question_id := (v_session.question_ids ->> v_session.current_question_index)::BIGINT;

  RETURN QUERY
  SELECT dq.id, dq.domain, dq.question, dq.choices,
         v_session.current_question_index + 1,
         jsonb_array_length(v_session.question_ids),
         v_session.current_question_locked
  FROM public.duel_questions dq
  WHERE dq.id = v_question_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_current_trivia_question(BIGINT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_current_trivia_question(BIGINT) FROM PUBLIC, anon;

-- The buzzer itself. See the header comment for exactly how the row lock
-- below makes this fair regardless of either player's network latency -
-- this is the one function in this migration worth reading twice.
CREATE OR REPLACE FUNCTION public.buzz_in_trivia(p_session_id BIGINT, p_chosen_index INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_name TEXT;
  v_session public.trivia_sessions%ROWTYPE;
  v_question_id BIGINT;
  v_correct_index INTEGER;
  v_is_correct BOOLEAN;
  v_won BOOLEAN := false;
BEGIN
  -- The row lock: whichever concurrent call reaches this SELECT first
  -- holds the lock until this transaction ends, forcing every other
  -- simultaneous buzz-in for this same session to wait its turn instead
  -- of racing on raw wall-clock time (see header comment).
  SELECT * INTO v_session FROM public.trivia_sessions WHERE id = p_session_id FOR UPDATE;

  IF v_session.id IS NULL OR v_session.status != 'Active' THEN
    RAISE EXCEPTION 'This session is not active.';
  END IF;
  IF v_session.current_question_locked THEN
    RAISE EXCEPTION 'Someone already won this question.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.trivia_participants WHERE session_id = p_session_id AND member_email = v_email) THEN
    RAISE EXCEPTION 'Join the session before buzzing in.';
  END IF;

  v_question_id := (v_session.question_ids ->> v_session.current_question_index)::BIGINT;
  SELECT correct_index INTO v_correct_index FROM public.duel_questions WHERE id = v_question_id;
  v_is_correct := (v_correct_index = p_chosen_index);
  SELECT member_name INTO v_name FROM public.trivia_participants WHERE session_id = p_session_id AND member_email = v_email;

  INSERT INTO public.trivia_buzzes (session_id, question_id, question_index, member_email, member_name, chosen_index, is_correct)
  VALUES (p_session_id, v_question_id, v_session.current_question_index, v_email, v_name, p_chosen_index, v_is_correct);

  IF v_is_correct THEN
    UPDATE public.trivia_sessions SET current_question_locked = true WHERE id = p_session_id;
    UPDATE public.trivia_participants SET score = score + 1 WHERE session_id = p_session_id AND member_email = v_email;
    v_won := true;
  END IF;

  RETURN v_won;
END;
$$;
GRANT EXECUTE ON FUNCTION public.buzz_in_trivia(BIGINT, INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.buzz_in_trivia(BIGINT, INTEGER) FROM PUBLIC, anon;

-- The caller's own live standing in a session, plus the room's full
-- scoreboard - split into two return columns rather than two round trips,
-- since a client needing one almost always wants the other too.
CREATE OR REPLACE FUNCTION public.get_trivia_leaderboard(p_session_id BIGINT)
RETURNS TABLE (member_email TEXT, member_name TEXT, score INTEGER, is_me BOOLEAN)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT member_email, member_name, score, member_email = lower(auth.jwt() ->> 'email')
  FROM public.trivia_participants
  WHERE session_id = p_session_id
  ORDER BY score DESC, joined_at ASC;
$$;
GRANT EXECUTE ON FUNCTION public.get_trivia_leaderboard(BIGINT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_trivia_leaderboard(BIGINT) FROM PUBLIC, anon;
