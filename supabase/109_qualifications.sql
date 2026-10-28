-- Hacking Hub Admin Dashboard - Qualifications on Edit Profile
-- Run this in the Supabase SQL Editor after 002-108 have already been
-- applied. Safe to re-run: every statement is idempotent.
--
-- A member declares their highest qualification (degree, diploma, etc.) on
-- Edit Profile. Students say what they are studying for, where, and which
-- year of study they are in (qualification_status 'In Progress').
-- Same privacy rules as age/gender (010_member_directory.sql):
-- never part of get_member_directory(), so other members can't see it, and
-- read back only by the member themselves (get_my_qualification) or by an
-- admin through the normal member_profiles select. Used for the Admin
-- Insights "By Qualification" breakdown and for answering employers who ask
-- how many members hold a degree.
--
-- Kept as its own read/write pair instead of new parameters on
-- update_my_directory_profile(): that function's signature is also called by
-- the mobile app (104_app_onboarding.sql), and changing it would mean a DROP
-- and a coordinated app release.

ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS qualification_level TEXT,
  ADD COLUMN IF NOT EXISTS qualification_name TEXT,
  ADD COLUMN IF NOT EXISTS qualification_institution TEXT,
  ADD COLUMN IF NOT EXISTS qualification_status TEXT,
  ADD COLUMN IF NOT EXISTS qualification_year INTEGER,
  ADD COLUMN IF NOT EXISTS qualification_study_year INTEGER;

-- Must match QUALIFICATION_LEVELS / QUALIFICATION_STATUSES in
-- src/lib/memberOptions.js.
ALTER TABLE public.member_profiles DROP CONSTRAINT IF EXISTS member_profiles_qualification_level_check;
ALTER TABLE public.member_profiles ADD CONSTRAINT member_profiles_qualification_level_check
  CHECK (qualification_level IS NULL OR qualification_level IN (
    'Matric', 'Higher Certificate', 'Diploma', 'Bachelor''s Degree', 'Honours', 'Master''s', 'Doctorate'
  ));
ALTER TABLE public.member_profiles DROP CONSTRAINT IF EXISTS member_profiles_qualification_status_check;
ALTER TABLE public.member_profiles ADD CONSTRAINT member_profiles_qualification_status_check
  CHECK (qualification_status IS NULL OR qualification_status IN ('Completed', 'In Progress'));
-- Year of study (1 = first year ... 6 = sixth year or later), only kept while
-- the qualification is In Progress.
ALTER TABLE public.member_profiles DROP CONSTRAINT IF EXISTS member_profiles_qualification_study_year_check;
ALTER TABLE public.member_profiles ADD CONSTRAINT member_profiles_qualification_study_year_check
  CHECK (qualification_study_year IS NULL OR qualification_study_year BETWEEN 1 AND 6);
ALTER TABLE public.member_profiles DROP CONSTRAINT IF EXISTS member_profiles_qualification_year_check;
ALTER TABLE public.member_profiles ADD CONSTRAINT member_profiles_qualification_year_check
  CHECK (qualification_year IS NULL OR qualification_year BETWEEN 1960 AND 2100);

-- The caller's own qualification, to pre-fill their Edit Profile form. The
-- return shape grew by study_year, so the old version is dropped first.
DROP FUNCTION IF EXISTS public.get_my_qualification();
CREATE FUNCTION public.get_my_qualification()
RETURNS TABLE (level TEXT, name TEXT, institution TEXT, status TEXT, year INTEGER, study_year INTEGER)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT qualification_level, qualification_name, qualification_institution, qualification_status, qualification_year, qualification_study_year
  FROM public.member_profiles
  WHERE email = lower(auth.jwt() ->> 'email');
$$;

GRANT EXECUTE ON FUNCTION public.get_my_qualification() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_qualification() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_qualification() FROM anon;

-- Saves the caller's own qualification. Only ever touches these six columns
-- on their own row. Picking no level clears the rest, so a half-filled entry
-- can't linger, and the year of study is only kept while it is In Progress.
DROP FUNCTION IF EXISTS public.save_my_qualification(TEXT, TEXT, TEXT, TEXT, INTEGER);
CREATE FUNCTION public.save_my_qualification(
  p_level TEXT,
  p_name TEXT,
  p_institution TEXT,
  p_status TEXT,
  p_year INTEGER,
  p_study_year INTEGER DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_level TEXT := NULLIF(trim(p_level), '');
  v_status TEXT := NULLIF(trim(p_status), '');
BEGIN
  IF v_email IS NULL OR NOT public.is_member_allowed(v_email) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  UPDATE public.member_profiles SET
    qualification_level = v_level,
    qualification_name = CASE WHEN v_level IS NULL THEN NULL ELSE NULLIF(left(trim(p_name), 120), '') END,
    qualification_institution = CASE WHEN v_level IS NULL THEN NULL ELSE NULLIF(left(trim(p_institution), 120), '') END,
    qualification_status = CASE WHEN v_level IS NULL THEN NULL ELSE v_status END,
    qualification_year = CASE WHEN v_level IS NULL THEN NULL ELSE p_year END,
    qualification_study_year = CASE WHEN v_level IS NULL OR v_status IS DISTINCT FROM 'In Progress' THEN NULL ELSE p_study_year END,
    updated_at = now()
  WHERE email = v_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_my_qualification(TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.save_my_qualification(TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.save_my_qualification(TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER) FROM anon;
