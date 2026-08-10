-- Hacking Hub Admin Dashboard - Member Sign-In Access Control
-- Run this in the Supabase SQL Editor after 002_member_persistence.sql and
-- 003_job_placed_date.sql have already been applied.
--
-- Problem: sign-in currently has no membership check at all - any Google account can
-- sign in and land in the Member Portal, and there's no way to actually revoke access
-- when someone leaves the community (only an admin-facing "Left" label).
--
-- Fix: a single SECURITY DEFINER function the app calls at sign-in. It treats
-- member_profiles as the allow-list - no row for that email, or a row marked 'Left',
-- means access is denied. It bypasses RLS internally (same pattern as is_admin() in
-- 002_member_persistence.sql) but only ever returns a boolean, never row data, so it's
-- safe to expose to any authenticated or anonymous caller.

-- =========================================================================
-- PART 1: THE ACCESS-CONTROL FUNCTION
-- =========================================================================

CREATE OR REPLACE FUNCTION public.is_member_allowed(check_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    check_email ILIKE '%@hackinghub.co.za'  -- admins are always allowed
    OR EXISTS (
      SELECT 1 FROM public.member_profiles
      WHERE email = lower(check_email) AND status != 'Left'
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_member_allowed(TEXT) TO anon, authenticated;

-- =========================================================================
-- PART 2: BACKFILL - give every real member a row so the allow-list actually
-- includes them. Only members an admin has already opened/saved in the UI have a
-- member_profiles row today; this adds the rest of the 81 real PayFast payers
-- (from src/data/payfastTransactions.json) as 'Active', without ever overwriting a
-- row an admin has already edited.
-- =========================================================================

INSERT INTO public.member_profiles (email, status)
VALUES
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active'),
    ('[REDACTED]', 'Active')
ON CONFLICT (email) DO NOTHING;
