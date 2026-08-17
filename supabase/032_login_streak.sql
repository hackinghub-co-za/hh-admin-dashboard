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
  ADD COLUMN IF NOT EXISTS last_login_date DATE;

CREATE OR REPLACE FUNCTION public.record_daily_login()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_new_streak INTEGER;
BEGIN
  INSERT INTO public.member_profiles (email, login_streak, last_login_date)
  VALUES (v_email, 1, CURRENT_DATE)
  ON CONFLICT (email) DO UPDATE SET
    login_streak = CASE
      WHEN public.member_profiles.last_login_date = CURRENT_DATE THEN public.member_profiles.login_streak
      WHEN public.member_profiles.last_login_date = CURRENT_DATE - 1 THEN public.member_profiles.login_streak + 1
      ELSE 1
    END,
    last_login_date = CURRENT_DATE
  RETURNING login_streak INTO v_new_streak;

  RETURN v_new_streak;
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_daily_login() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.record_daily_login() FROM PUBLIC, anon;
