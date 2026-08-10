-- Hacking Hub Admin Dashboard - First-Login Onboarding Sequence
-- Run this in the Supabase SQL Editor after 002-005 have already been applied.
--
-- Adds a flag for whether a member has seen the onboarding sequence, plus two narrow
-- SECURITY DEFINER functions so a member can check and set only that one flag on
-- their own row - member_profiles otherwise stays admin-only for everything
-- (salary, money owed, etc.), and this doesn't loosen that.

ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMP WITH TIME ZONE;

-- Read-only: has this email completed onboarding? Never exposes row data.
CREATE OR REPLACE FUNCTION public.has_completed_onboarding(check_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT onboarded_at IS NOT NULL FROM public.member_profiles WHERE email = lower(check_email)),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_completed_onboarding(TEXT) TO anon, authenticated;

-- Write, but only the caller's own row and only this one column - keyed off their
-- verified sign-in email (auth.jwt()), never a client-supplied email.
CREATE OR REPLACE FUNCTION public.mark_onboarding_complete()
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.member_profiles
  SET onboarded_at = timezone('utc'::text, now())
  WHERE email = lower(auth.jwt() ->> 'email');
$$;

GRANT EXECUTE ON FUNCTION public.mark_onboarding_complete() TO authenticated;
