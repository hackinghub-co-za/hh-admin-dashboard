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

-- =========================================================================
-- PART 2: THE ONBOARDING CHECKLIST
-- =========================================================================
-- onboarded_at/has_completed_onboarding above only ever tracked one thing -
-- has this member seen the first-login intro sequence at all - which is
-- still exactly what it's for (gating whether OnboardingSequence plays on
-- login). What it can't do is track the actual list of things a new member
-- needs to get done (watch the intro video, book their first 1-on-1, join
-- WhatsApp, etc.) as separate, resumable, admin-visible steps - today
-- that's just a row of links on one screen with no memory of what's been
-- clicked. This table is that memory: one row per member per step, created
-- the moment they complete it.
--
-- A narrow (member_email, step_key) table rather than one boolean column
-- per step - adding a new checklist step later is a code change, not a
-- migration, and "how many of N steps has this member finished" is a
-- trivial count() instead of a wide, ever-growing row.
CREATE TABLE IF NOT EXISTS public.member_onboarding_steps (
  member_email TEXT NOT NULL,
  step_key TEXT NOT NULL CHECK (step_key IN (
    'watch_video', 'book_1on1', 'join_whatsapp', 'install_calendar', 'setup_profile', 'portal_tour'
  )),
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (member_email, step_key)
);

ALTER TABLE public.member_onboarding_steps ENABLE ROW LEVEL SECURITY;

-- Members can read their own progress directly - nothing sensitive here,
-- just which of their own steps are done. Writes deliberately don't get a
-- matching INSERT policy: they only ever happen through the function below,
-- which pins step_key to the fixed vocabulary above and completed_at to the
-- server clock rather than trusting either from the client.
DROP POLICY IF EXISTS "members read own onboarding steps" ON public.member_onboarding_steps;
CREATE POLICY "members read own onboarding steps"
  ON public.member_onboarding_steps FOR SELECT
  TO authenticated
  USING (member_email = lower(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "admins manage onboarding steps" ON public.member_onboarding_steps;
CREATE POLICY "admins manage onboarding steps"
  ON public.member_onboarding_steps FOR ALL
  USING (public.is_admin(auth.uid()));

-- Self-service completion, scoped to only the caller's own row - same
-- ownership pattern as every other member-submitted table in this project.
-- Idempotent (ON CONFLICT DO NOTHING) so replaying a step (e.g. re-clicking
-- an already-completed checklist item) is a harmless no-op, not an error.
CREATE OR REPLACE FUNCTION public.mark_my_onboarding_step_complete(p_step_key TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.member_onboarding_steps (member_email, step_key)
  VALUES (lower(auth.jwt() ->> 'email'), p_step_key)
  ON CONFLICT (member_email, step_key) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_my_onboarding_step_complete(TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_my_onboarding_step_complete(TEXT) FROM PUBLIC, anon;

-- =========================================================================
-- PART 3: HARD-GATE THE CHECKLIST AFTER A GRACE PERIOD
-- =========================================================================
-- The checklist above (PART 2) has always been a dismissible dashboard card
-- - nothing stops a member from ignoring it entirely and using the rest of
-- the portal immediately. This adds a real block: once a member is
-- GETTING_STARTED_GRACE_DAYS (3, see App.jsx) past this timestamp, the
-- portal restricts them to just Dashboard/Meetings/Members (the two tabs
-- needed to actually finish book_1on1/setup_profile) until all 6 steps are
-- done.
--
-- Deliberately a SEPARATE column from onboarded_at, not a reuse of it.
-- onboarded_at is set once, at first login, for every member who has ever
-- used the portal - reusing it here would mean every existing member past
-- 3 days old and never having touched the (previously optional) checklist
-- gets hard-locked out the instant this migration runs. The backfill below
-- instead gives every already-onboarded member a FRESH 3-day grace period
-- starting from whenever this file actually runs, so rollout doesn't
-- surprise anyone currently active. Going forward, mark_onboarding_complete
-- (PART 1) sets this at the same moment onboarded_at is set, so a brand new
-- member's grace period starts right when their first-login intro ends.
ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS getting_started_grace_started_at TIMESTAMP WITH TIME ZONE;

UPDATE public.member_profiles
SET getting_started_grace_started_at = timezone('utc'::text, now())
WHERE getting_started_grace_started_at IS NULL AND onboarded_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.mark_onboarding_complete()
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.member_profiles
  SET onboarded_at = timezone('utc'::text, now()),
      getting_started_grace_started_at = COALESCE(getting_started_grace_started_at, timezone('utc'::text, now()))
  WHERE email = lower(auth.jwt() ->> 'email');
$$;

-- Narrow getter, same pattern/reasoning as has_completed_onboarding above -
-- member_profiles has no member-facing SELECT policy at all (only the
-- admin-only "Admins manage member_profiles" FOR ALL), so every per-member
-- fact a member needs to read about themselves goes through a function
-- like this instead.
CREATE OR REPLACE FUNCTION public.get_my_getting_started_grace_started_at()
RETURNS TIMESTAMP WITH TIME ZONE
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT getting_started_grace_started_at FROM public.member_profiles
  WHERE email = lower(auth.jwt() ->> 'email');
$$;

GRANT EXECUTE ON FUNCTION public.get_my_getting_started_grace_started_at() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_getting_started_grace_started_at() FROM PUBLIC, anon;
