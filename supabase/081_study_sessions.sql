-- Hacking Hub Admin Dashboard - Study Hours (Phase 1 of the "Competitive
-- Study Mode" planning artifact)
-- Run this in the Supabase SQL Editor after 002-080 have already been
-- applied. Safe to re-run: every statement is idempotent.
--
-- A Pomodoro-style focus timer plus a self-verifying session log and
-- leaderboard, shipped right under the TryHackMe leaderboard on the
-- Competitions tab. Unlike Room Logs (daily_room_logs, 031), a completed
-- session needs no admin approval queue - the timer counting down to zero
-- server-side-validated length IS the proof, the same trust upgrade
-- Quiz Duel already made over the plain honor system. Phase 2 (tracking
-- tab-switches away from the timer via the Page Visibility API) and Phase 3
-- (a companion browser extension for real tab/DND control) are
-- deliberately NOT part of this file - see the planning artifact.
--
-- Opt-in, not opt-out by default: study_leaderboard only gains a row once
-- a member explicitly joins (join_study_hours), same "Yes I'm In" pattern
-- as rsvp_for_competition/053_competition_opt_out.sql, including the same
-- soft opt-out (opted_out flips true, row and stats stay intact so
-- rejoining resumes exactly where they left off).
--
-- Two tables, same split as competitions/competition_standings:
-- study_leaderboard is the running aggregate the leaderboard actually
-- reads (one row per member); study_sessions is the permanent, append-only
-- log each completed session writes to - never reset, never edited.

CREATE TABLE IF NOT EXISTS public.study_leaderboard (
  email TEXT PRIMARY KEY,
  member_name TEXT NOT NULL,
  total_minutes INTEGER NOT NULL DEFAULT 0,
  sessions_count INTEGER NOT NULL DEFAULT 0,
  current_streak INTEGER NOT NULL DEFAULT 0,
  last_session_date DATE,
  opted_out BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.study_leaderboard ENABLE ROW LEVEL SECURITY;

-- Every approved member can see the whole leaderboard - same non-sensitive
-- shape (name, minutes, streak) as competition_standings' own read policy.
DROP POLICY IF EXISTS "members read study leaderboard" ON public.study_leaderboard;
CREATE POLICY "members read study leaderboard"
  ON public.study_leaderboard FOR SELECT
  TO authenticated
  USING (public.is_member_allowed(auth.jwt() ->> 'email'));

-- No direct INSERT/UPDATE policy - join_study_hours/opt_out_of_study_hours/
-- log_study_session below are the only write paths, same "self-service via
-- SECURITY DEFINER RPC, not raw table access" pattern as competitions.
DROP POLICY IF EXISTS "admins manage study leaderboard" ON public.study_leaderboard;
CREATE POLICY "admins manage study leaderboard"
  ON public.study_leaderboard FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.study_sessions (
  id BIGSERIAL PRIMARY KEY,
  member_email TEXT NOT NULL,
  -- What cert this session was actually studying toward - same
  -- CERT_CATALOG_BY_VENDOR vendor-then-cert picker Cert Calendar already
  -- uses (memberOptions.js), including its "Other" free-text escape hatch.
  -- Free text, not a CHECK enum: the real catalog is dozens of certs across
  -- a dozen vendors plus "Other", too large and too likely to grow for a
  -- SQL IN() list to track - same reasoning cert_calendar.cert_name
  -- (024_cert_calendar.sql) already free-texts. Nullable - a session
  -- doesn't have to be tagged to a cert.
  cert TEXT,
  -- The only three lengths the in-app timer actually offers - checked here
  -- too, not just client-side, since this RPC is reachable directly by any
  -- authenticated member and a fake huge value would inflate the
  -- leaderboard for free.
  planned_minutes INTEGER NOT NULL CHECK (planned_minutes IN (25, 45, 60)),
  logged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Renames a column from an earlier run of this file, before study sessions
-- were tagged to a specific cert instead of a broad roadmap track - guarded
-- on the old column actually existing, since a fresh apply's CREATE TABLE
-- above already creates `cert` directly (a plain RENAME COLUMN would error
-- with "column track does not exist" in that case).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'study_sessions' AND column_name = 'track'
  ) THEN
    ALTER TABLE public.study_sessions RENAME COLUMN track TO cert;
  END IF;
END $$;
ALTER TABLE public.study_sessions DROP CONSTRAINT IF EXISTS study_sessions_track_check;

ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;

-- A member can see their own session history (not built into the UI yet,
-- but cheap to allow now rather than needing a schema change later for a
-- "My Sessions" view). No cross-member read - unlike the aggregate
-- leaderboard, individual session rows aren't meant to be public.
DROP POLICY IF EXISTS "members read own study sessions" ON public.study_sessions;
CREATE POLICY "members read own study sessions"
  ON public.study_sessions FOR SELECT
  TO authenticated
  USING (member_email = lower(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "admins manage study sessions" ON public.study_sessions;
CREATE POLICY "admins manage study sessions"
  ON public.study_sessions FOR ALL
  USING (public.is_admin(auth.uid()));

-- Joins (or rejoins after opting out) the caller for Study Hours. Same
-- "take p_member_name for UI parity but resolve the real name server-side"
-- fix already applied to rsvp_for_competition - a shared leaderboard is
-- exactly the kind of surface where trusting a client-supplied display
-- name would let a member impersonate someone else.
CREATE OR REPLACE FUNCTION public.join_study_hours(p_member_name TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_name TEXT;
BEGIN
  SELECT full_name INTO v_name FROM public.member_profiles WHERE email = v_email;

  INSERT INTO public.study_leaderboard (email, member_name)
  VALUES (v_email, COALESCE(v_name, v_email))
  ON CONFLICT (email) DO UPDATE SET opted_out = false;
END;
$$;
GRANT EXECUTE ON FUNCTION public.join_study_hours(TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.join_study_hours(TEXT) FROM PUBLIC, anon;

-- Soft opt-out, same shape as opt_out_of_competition - row and every stat
-- (total_minutes, streak, sessions_count) stay intact, just hidden from
-- the leaderboard (fetchStudyLeaderboard filters WHERE opted_out = false)
-- until they join again.
CREATE OR REPLACE FUNCTION public.opt_out_of_study_hours()
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.study_leaderboard SET opted_out = true
  WHERE email = lower(auth.jwt() ->> 'email');
$$;
GRANT EXECUTE ON FUNCTION public.opt_out_of_study_hours() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.opt_out_of_study_hours() FROM PUBLIC, anon;

-- Logs one completed Pomodoro session and rolls it into the aggregate.
-- Requires an existing, currently-opted-in study_leaderboard row - a
-- member has to explicitly join before their first session counts, the
-- same explicit-opt-in requirement the "make it opt in too" ask is about.
--
-- Streak logic: a day only ever counts once (finishing 3 sessions today
-- doesn't add 3 to the streak) - if the last counted day was yesterday the
-- streak extends by one, if it was already today the streak is untouched,
-- any bigger gap resets it to 1.
-- Parameter renamed from p_track to p_cert - dropped first since CREATE OR
-- REPLACE can't rename an existing parameter in place.
DROP FUNCTION IF EXISTS public.log_study_session(TEXT, INTEGER);
CREATE OR REPLACE FUNCTION public.log_study_session(p_cert TEXT, p_planned_minutes INTEGER)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_today DATE := (timezone('utc'::text, now()))::date;
  v_last_date DATE;
  v_streak INTEGER;
BEGIN
  IF p_planned_minutes NOT IN (25, 45, 60) THEN
    RAISE EXCEPTION 'Invalid session length.';
  END IF;

  SELECT last_session_date, current_streak INTO v_last_date, v_streak
  FROM public.study_leaderboard
  WHERE email = v_email AND opted_out = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Join Study Hours before logging a session.';
  END IF;

  INSERT INTO public.study_sessions (member_email, cert, planned_minutes)
  VALUES (v_email, p_cert, p_planned_minutes);

  UPDATE public.study_leaderboard
  SET total_minutes = total_minutes + p_planned_minutes,
      sessions_count = sessions_count + 1,
      current_streak = CASE
        WHEN v_last_date = v_today THEN v_streak
        WHEN v_last_date = v_today - 1 THEN v_streak + 1
        ELSE 1
      END,
      last_session_date = v_today
  WHERE email = v_email;
END;
$$;
GRANT EXECUTE ON FUNCTION public.log_study_session(TEXT, INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.log_study_session(TEXT, INTEGER) FROM PUBLIC, anon;
