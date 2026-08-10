-- Hacking Hub Admin Dashboard - Member Offboarding Workflow
-- Run this in the Supabase SQL Editor after 002-007 have already been applied.
--
-- Adds a grace-period offboarding flow. An admin marks a member's status
-- 'Leaving' (a new value alongside Active / Active (Permanent) / Left) with a
-- reason and internal notes - is_member_allowed() from 004 already treats
-- anything other than 'Left' as allowed, so this requires no change there: the
-- member can still sign in one more time. On that next sign-in, the app shows
-- them a farewell screen instead of the normal portal, where they can leave
-- optional exit feedback. Submitting (or skipping) finalizes status = 'Left',
-- which is what actually revokes access on their following sign-in attempt.
--
-- Same two-function shape as 006_onboarding.sql: one read-only status check
-- (safe for anon+authenticated), one narrow self-service write keyed off the
-- caller's own verified JWT email. This time the anon/PUBLIC revoke on the
-- write function is included immediately, not as a follow-up migration.

ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS offboarding_reason TEXT,
  ADD COLUMN IF NOT EXISTS offboarding_notes TEXT,
  ADD COLUMN IF NOT EXISTS offboarding_started_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS exit_feedback_rating SMALLINT,
  ADD COLUMN IF NOT EXISTS exit_feedback_text TEXT,
  ADD COLUMN IF NOT EXISTS left_at TIMESTAMP WITH TIME ZONE;

-- Read-only: is this email currently in the 'Leaving' grace period? Never
-- exposes row data (reason/notes stay admin-only via the existing member_profiles
-- RLS policy).
CREATE OR REPLACE FUNCTION public.is_offboarding_pending(check_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT status = 'Leaving' FROM public.member_profiles WHERE email = lower(check_email)),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_offboarding_pending(TEXT) TO anon, authenticated;

-- Write, scoped to only the caller's own row, keyed off their verified sign-in
-- email (auth.jwt()), never a client-supplied email. Only finalizes if the row
-- is actually in 'Leaving' - a member can't use this to self-remove from any
-- other state, and calling it twice is harmless (second call just no-ops).
CREATE OR REPLACE FUNCTION public.submit_exit_feedback(feedback_rating SMALLINT, feedback_text TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.member_profiles
  SET
    exit_feedback_rating = feedback_rating,
    exit_feedback_text = feedback_text,
    status = 'Left',
    left_at = timezone('utc'::text, now())
  WHERE email = lower(auth.jwt() ->> 'email')
    AND status = 'Leaving';
$$;

REVOKE EXECUTE ON FUNCTION public.submit_exit_feedback(SMALLINT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_exit_feedback(SMALLINT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_exit_feedback(SMALLINT, TEXT) TO authenticated;
