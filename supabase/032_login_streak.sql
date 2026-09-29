-- Hacking Hub Admin Dashboard - Daily Login Streak
-- Run this in the Supabase SQL Editor after 002-031 have already been applied.
-- Safe to re-run: every statement is idempotent.
--
-- Tracks how many consecutive days in a row a member has opened the portal,
-- shown as a "🔥 N" badge on their dashboard. record_daily_login() is called
-- once per session load (see MemberPortal.jsx) and does the whole
-- read-compare-write in one INSERT ... ON CONFLICT, comparing against the
-- row's OWN previous last_login_date (accessible via the table-qualified
-- name inside the ON CONFLICT clause) rather than needing a separate SELECT
-- first:
--   - already recorded today -> streak unchanged
--   - last login was exactly yesterday -> streak + 1
--   - anything older (or never logged in before) -> streak resets to 1
-- Returns the resulting streak so the client never needs a second read.

ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS login_streak INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_login_date DATE,
  -- Personal-best streak, distinct from login_streak (the current, live
  -- one) - a member who breaks their own streak keeps this record rather
  -- than losing all evidence of it. Updated by record_daily_login() below
  -- whenever the current streak reaches a new high.
  ADD COLUMN IF NOT EXISTS longest_login_streak INTEGER NOT NULL DEFAULT 0;

-- Append-only log of the actual calendar days a member logged in - one row
-- per member per day, never updated once written. login_streak/
-- last_login_date on member_profiles are the fast, current-state summary;
-- this is what actually powers the GitHub-style contribution calendar on
-- the streak tile (My Roadmap has no equivalent - this table exists purely
-- for that visual). record_daily_login() below is the only writer.
CREATE TABLE IF NOT EXISTS public.login_history (
  member_email TEXT NOT NULL,
  login_date DATE NOT NULL,
  PRIMARY KEY (member_email, login_date)
);

ALTER TABLE public.login_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read own login history" ON public.login_history;
CREATE POLICY "members read own login history"
  ON public.login_history FOR SELECT
  TO authenticated
  USING (member_email = lower(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "admins manage login history" ON public.login_history;
CREATE POLICY "admins manage login history"
  ON public.login_history FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.record_daily_login()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_new_streak INTEGER;
BEGIN
  INSERT INTO public.member_profiles (email, login_streak, last_login_date, longest_login_streak)
  VALUES (v_email, 1, CURRENT_DATE, 1)
  ON CONFLICT (email) DO UPDATE SET
    login_streak = CASE
      WHEN public.member_profiles.last_login_date = CURRENT_DATE THEN public.member_profiles.login_streak
      WHEN public.member_profiles.last_login_date = CURRENT_DATE - 1 THEN public.member_profiles.login_streak + 1
      ELSE 1
    END,
    last_login_date = CURRENT_DATE,
    longest_login_streak = GREATEST(
      public.member_profiles.longest_login_streak,
      CASE
        WHEN public.member_profiles.last_login_date = CURRENT_DATE THEN public.member_profiles.login_streak
        WHEN public.member_profiles.last_login_date = CURRENT_DATE - 1 THEN public.member_profiles.login_streak + 1
        ELSE 1
      END
    )
  RETURNING login_streak INTO v_new_streak;

  -- A day only ever counts once, same "already recorded today" dedup the
  -- streak math above uses - ON CONFLICT DO NOTHING rather than checking
  -- first, since this table's PK already enforces it.
  INSERT INTO public.login_history (member_email, login_date)
  VALUES (v_email, CURRENT_DATE)
  ON CONFLICT (member_email, login_date) DO NOTHING;

  RETURN v_new_streak;
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_daily_login() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.record_daily_login() FROM PUBLIC, anon;

-- Powers the GitHub-style calendar on the streak tile - the caller's own
-- login dates over the trailing p_days (default ~1 year, matching GitHub's
-- own contribution graph window). Just the dates; the client fills in the
-- empty squares itself.
CREATE OR REPLACE FUNCTION public.get_my_login_history(p_days INTEGER DEFAULT 371)
RETURNS TABLE (login_date DATE)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT lh.login_date
  FROM public.login_history lh
  WHERE lh.member_email = lower(auth.jwt() ->> 'email')
    AND lh.login_date >= CURRENT_DATE - p_days;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_login_history(INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_login_history(INTEGER) FROM PUBLIC, anon;

-- The caller's own current + personal-best streak, for the streak modal's
-- two stat tiles. Separate from record_daily_login()'s return value
-- (deliberately unchanged, INTEGER only) rather than widening that RPC's
-- signature - this one is only called on demand when the modal opens, not
-- on every session load.
CREATE OR REPLACE FUNCTION public.get_my_login_streak_summary()
RETURNS TABLE (current_streak INTEGER, longest_streak INTEGER)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT COALESCE(mp.login_streak, 0), COALESCE(mp.longest_login_streak, 0)
  FROM public.member_profiles mp
  WHERE mp.email = lower(auth.jwt() ->> 'email');
$$;
GRANT EXECUTE ON FUNCTION public.get_my_login_streak_summary() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_login_streak_summary() FROM PUBLIC, anon;

-- Community-wide "who currently has the longest active streak" - a single
-- row naming the one member with the highest live login_streak right now
-- (not the all-time record, which is longest_login_streak and is purely
-- personal - this one changes as people's live streaks rise and reset).
-- A narrow, name+count-only RPC rather than exposing the whole roster's
-- streaks, same reasoning as every other leaderboard RPC in this app.
CREATE OR REPLACE FUNCTION public.get_top_login_streak()
RETURNS TABLE (full_name TEXT, email TEXT, login_streak INTEGER)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT mp.full_name, mp.email, mp.login_streak
  FROM public.member_profiles mp
  WHERE mp.login_streak > 0
  ORDER BY mp.login_streak DESC, mp.last_login_date DESC
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_top_login_streak() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_top_login_streak() FROM PUBLIC, anon;
