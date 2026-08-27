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

-- =========================================================================
-- PART 3: GRANT ACCESS ON PAYMENT
-- =========================================================================
-- Until now, a payment (PayFast or an admin-recorded EFT) never actually
-- created or reactivated a member_profiles row - an admin had to notice the
-- new payer and add them by hand (or via a one-off migration like Part 2
-- above) before they could sign in at all. This is the single function both
-- payfast-webhook (via the service role, which bypasses RLS entirely) and
-- the admin dashboard's "Record EFT Payment" flow call after a successful
-- payment, so there's one grant path instead of two different manual ones.
--
-- Only ever writes email/full_name/status - never money_owed, roadmap,
-- offboarding fields, etc. - so it's safe to call on every single payment,
-- including a member's 10th monthly renewal, without clobbering anything an
-- admin or the member has already filled in. full_name only fills in when
-- empty, so a self-chosen directory name (or an admin-corrected one) never
-- gets overwritten by whatever name happened to be on a given PayFast
-- checkout.
CREATE OR REPLACE FUNCTION public.grant_member_portal_access(p_email TEXT, p_full_name TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- The service role (payfast-webhook) has no 'authenticated' JWT role, so
  -- this only gates real authenticated callers - i.e. it stops any signed-in
  -- non-admin member from granting themselves or anyone else access, while
  -- leaving the webhook and admin-authenticated calls both allowed.
  IF auth.role() = 'authenticated' AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can grant member portal access.';
  END IF;

  INSERT INTO public.member_profiles (email, full_name, status)
  VALUES (lower(p_email), NULLIF(trim(p_full_name), ''), 'Active')
  ON CONFLICT (email) DO UPDATE SET
    status = 'Active',
    full_name = COALESCE(NULLIF(trim(member_profiles.full_name), ''), EXCLUDED.full_name),
    updated_at = timezone('utc'::text, now());
END;
$$;

GRANT EXECUTE ON FUNCTION public.grant_member_portal_access(TEXT, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.grant_member_portal_access(TEXT, TEXT) FROM PUBLIC, anon;
