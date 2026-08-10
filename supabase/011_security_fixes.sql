-- Hacking Hub Admin Dashboard - Security Fixes (Vuln 1, 2, 3 from full-repo review)
-- Run this in the Supabase SQL Editor after 002-010 have already been applied.

-- =========================================================================
-- VULN 1: Self-service role escalation via missing WITH CHECK on
-- "Allow users to update their own profiles" (schema.sql:82-83).
--
-- That policy only had `USING (auth.uid() = id)`, and Postgres reuses USING as
-- the check when WITH CHECK is omitted - so nothing stopped a member from
-- PATCHing their own `role` column straight to 'admin', which every admin-gated
-- table in this schema trusts via is_admin(auth.uid()). Fix: pin `role` so a
-- non-admin can only ever write role='member' for themselves. Reuses the
-- existing is_admin() SECURITY DEFINER function (from 002_member_persistence.sql)
-- rather than a fresh subquery against profiles, to avoid reintroducing the
-- exact RLS infinite-recursion bug 002 already fixed on the neighboring policy.
-- =========================================================================

DROP POLICY IF EXISTS "Allow users to update their own profiles" ON public.profiles;
CREATE POLICY "Allow users to update their own profiles" ON public.profiles
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id AND (role = 'member' OR public.is_admin(auth.uid())));

-- =========================================================================
-- VULN 2: update_my_directory_profile() could self-provision a brand-new
-- member_profiles row (via its INSERT ... ON CONFLICT) for any authenticated
-- Google account, silently defaulting status to 'Active' - which is_member_allowed()
-- then treats as a legitimate member, granting Member Portal access to anyone
-- who was never approved/never paid. Every real member already has a row
-- (backfilled in 004_member_access_control.sql, or created by an admin), so this
-- function only ever needs to UPDATE an existing row, never create one. Removing
-- the INSERT branch entirely: if no row exists for the caller's email, this now
-- just matches zero rows and no-ops.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.update_my_directory_profile(
  p_full_name TEXT,
  p_about TEXT,
  p_location TEXT,
  p_linkedin TEXT,
  p_specialty TEXT,
  p_employment_status TEXT,
  p_job_title TEXT
) RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.member_profiles SET
    full_name = p_full_name,
    about = p_about,
    location = p_location,
    linkedin = p_linkedin,
    specialty = p_specialty,
    employment_status = p_employment_status,
    job_title = p_job_title,
    updated_at = timezone('utc'::text, now())
  WHERE email = lower(auth.jwt() ->> 'email');
$$;

-- =========================================================================
-- VULN 3: get_member_directory() returned every active member's PII (name,
-- bio, location, LinkedIn, job details) to any `authenticated` caller, with no
-- check that the caller was themselves an approved member. Add the same
-- is_member_allowed() check the sign-in gate already uses.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.get_member_directory()
RETURNS TABLE (
  email TEXT,
  full_name TEXT,
  about TEXT,
  location TEXT,
  linkedin TEXT,
  specialty TEXT,
  job_readiness TEXT,
  employment_status TEXT,
  job_title TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT email, full_name, about, location, linkedin, specialty, job_readiness,
         employment_status, job_title
  FROM public.member_profiles
  WHERE status != 'Left'
    AND public.is_member_allowed(auth.jwt() ->> 'email');
$$;
