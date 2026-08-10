-- Hacking Hub Admin Dashboard - Member Directory
-- Run this in the Supabase SQL Editor after 002-009 have already been applied.
--
-- Lets members browse each other's profiles (about, location, LinkedIn, job
-- title/employment status, specialty, job readiness) and self-edit their own
-- entry. member_profiles is otherwise locked to admins-only for every operation
-- (FOR ALL USING is_admin(...)) and holds genuinely sensitive columns
-- (money_owed, monthly_remuneration, phone, offboarding/exit-feedback fields,
-- age, gender) - a row-level policy can't hide specific columns, so this can't be
-- a broad "members can SELECT member_profiles" policy. Instead, same pattern as
-- every other member-facing RPC in this schema: a SECURITY DEFINER function that
-- returns only an explicit, hand-picked column whitelist, and a narrow write
-- function scoped to only the caller's own row and only the same public-facing
-- columns. Anon/PUBLIC revoke included immediately (lesson learned from
-- 006/007_onboarding, where that had to be a follow-up fix).

-- Bug fix, unrelated to the directory below but caught while touching this table:
-- member_profiles.status still carries its original CHECK constraint from
-- 002_member_persistence.sql (only 'Active' / 'Active (Permanent)' / 'Left'),
-- but 008_offboarding.sql introduced 'Leaving' as a real status value without
-- updating it. Since Mock Admin never hits the real database, this never
-- surfaced in testing - a real admin setting a real member to 'Leaving' would
-- hit a constraint violation. Widening it here.
ALTER TABLE public.member_profiles DROP CONSTRAINT IF EXISTS member_profiles_status_check;
ALTER TABLE public.member_profiles ADD CONSTRAINT member_profiles_status_check
  CHECK (status IN ('Active', 'Active (Permanent)', 'Leaving', 'Left'));

ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS about TEXT;

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
  WHERE status != 'Left';
$$;

GRANT EXECUTE ON FUNCTION public.get_member_directory() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_member_directory() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_member_directory() FROM anon;

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
  INSERT INTO public.member_profiles (email, full_name, about, location, linkedin, specialty, employment_status, job_title)
  VALUES (lower(auth.jwt() ->> 'email'), p_full_name, p_about, p_location, p_linkedin, p_specialty, p_employment_status, p_job_title)
  ON CONFLICT (email) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    about = EXCLUDED.about,
    location = EXCLUDED.location,
    linkedin = EXCLUDED.linkedin,
    specialty = EXCLUDED.specialty,
    employment_status = EXCLUDED.employment_status,
    job_title = EXCLUDED.job_title,
    updated_at = timezone('utc'::text, now());
$$;

GRANT EXECUTE ON FUNCTION public.update_my_directory_profile(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.update_my_directory_profile(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_my_directory_profile(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM anon;
