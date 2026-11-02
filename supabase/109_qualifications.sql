-- Hacking Hub Admin Dashboard - Qualifications on Edit Profile
-- Run this in the Supabase SQL Editor after 002-108 have already been
-- applied. Safe to re-run: every statement is idempotent.
--
-- A member declares their highest qualification (degree, diploma, etc.) on
-- Edit Profile. Students say what they are studying for, where, and which
-- year of study they are in (qualification_status 'In Progress'), and whether
-- this is their final year (true = they finish this year, false = they do not).
-- A member who is studying is asked that last question so we know who is
-- about to graduate.
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
  ADD COLUMN IF NOT EXISTS qualification_study_year INTEGER,
  ADD COLUMN IF NOT EXISTS qualification_final_year BOOLEAN;

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
RETURNS TABLE (level TEXT, name TEXT, institution TEXT, status TEXT, year INTEGER, study_year INTEGER, final_year BOOLEAN)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT qualification_level, qualification_name, qualification_institution, qualification_status, qualification_year, qualification_study_year, qualification_final_year
  FROM public.member_profiles
  WHERE email = lower(auth.jwt() ->> 'email');
$$;

GRANT EXECUTE ON FUNCTION public.get_my_qualification() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_qualification() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_qualification() FROM anon;

-- Saves the caller's own qualification. Only ever touches these seven columns
-- on their own row. Picking no level clears the rest, so a half-filled entry
-- can't linger, and the year of study and final-year answer are only kept
-- while it is In Progress.
DROP FUNCTION IF EXISTS public.save_my_qualification(TEXT, TEXT, TEXT, TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.save_my_qualification(TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER);
CREATE FUNCTION public.save_my_qualification(
  p_level TEXT,
  p_name TEXT,
  p_institution TEXT,
  p_status TEXT,
  p_year INTEGER,
  p_study_year INTEGER DEFAULT NULL,
  p_final_year BOOLEAN DEFAULT NULL
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
    qualification_final_year = CASE WHEN v_level IS NULL OR v_status IS DISTINCT FROM 'In Progress' THEN NULL ELSE p_final_year END,
    updated_at = now()
  WHERE email = v_email;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_my_qualification(TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, BOOLEAN) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.save_my_qualification(TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, BOOLEAN) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.save_my_qualification(TEXT, TEXT, TEXT, TEXT, INTEGER, INTEGER, BOOLEAN) FROM anon;

-- =========================================================================
-- PART 2: PROFILE GATE
-- =========================================================================
-- Until a member has filled in gender, where they live, employment status
-- and their qualification, signing in shows a full-screen "One last step"
-- form (src/components/ProfileGate.jsx) instead of the portal. These
-- functions are the one place that decides what "filled in" means, so the
-- web app and the mobile app can ask the same question.
--
-- Complete means:
--  - gender: any answer, including 'Prefer not to say'
--  - location: any of the city options
--  - employment: Employed, Unemployed or Student. Employed also needs a job
--    title and a gross monthly salary, or salary_declined (Prefer not to say)
--  - qualification: level, status, name, institution and year. A member who
--    is still studying (In Progress, not Matric) also gives their year of
--    study and whether this is their final year
-- Staff (any role other than member) and anyone who is not Active are never
-- stopped. The salary stays on the member's own row, which only the admin
-- account can read; it is never part of get_member_directory().

ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS salary_declined BOOLEAN NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.my_profile_gate_missing()
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_role TEXT;
  r public.member_profiles%ROWTYPE;
  v_missing TEXT[] := '{}';
BEGIN
  IF v_email IS NULL THEN RETURN v_missing; END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF COALESCE(v_role, 'member') <> 'member' THEN RETURN v_missing; END IF;
  SELECT * INTO r FROM public.member_profiles WHERE email = v_email;
  IF NOT FOUND OR r.status NOT IN ('Active', 'Active (Permanent)') THEN RETURN v_missing; END IF;

  IF NULLIF(btrim(r.gender), '') IS NULL THEN v_missing := array_append(v_missing, 'gender'); END IF;
  IF NULLIF(btrim(r.location), '') IS NULL THEN v_missing := array_append(v_missing, 'location'); END IF;
  IF r.employment_status IS NULL OR r.employment_status NOT IN ('Employed', 'Unemployed', 'Student')
     OR (r.employment_status = 'Employed' AND (
           NULLIF(btrim(r.job_title), '') IS NULL
           OR (COALESCE(r.monthly_remuneration, 0) <= 0 AND NOT r.salary_declined))) THEN
    v_missing := array_append(v_missing, 'employment');
  END IF;
  IF r.qualification_level IS NULL OR r.qualification_status IS NULL
     OR NULLIF(btrim(r.qualification_name), '') IS NULL
     OR NULLIF(btrim(r.qualification_institution), '') IS NULL
     OR r.qualification_year IS NULL
     OR (r.qualification_status = 'In Progress' AND r.qualification_level <> 'Matric'
         AND (r.qualification_study_year IS NULL OR r.qualification_final_year IS NULL)) THEN
    v_missing := array_append(v_missing, 'qualification');
  END IF;
  RETURN v_missing;
END;
$$;
GRANT EXECUTE ON FUNCTION public.my_profile_gate_missing() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.my_profile_gate_missing() FROM PUBLIC, anon;

-- The caller's own current answers, to pre-fill the form.
CREATE OR REPLACE FUNCTION public.get_my_profile_gate()
RETURNS TABLE (gender TEXT, location TEXT, employment_status TEXT, job_title TEXT, monthly_remuneration NUMERIC, salary_declined BOOLEAN)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT gender, location, employment_status, job_title, monthly_remuneration, salary_declined
  FROM public.member_profiles
  WHERE email = lower(auth.jwt() ->> 'email');
$$;
GRANT EXECUTE ON FUNCTION public.get_my_profile_gate() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_profile_gate() FROM PUBLIC, anon;

-- Saves the gate's answers on the caller's own row. The qualification goes
-- through save_my_qualification() above. Job title and salary are only kept
-- while the member is Employed. A blank value leaves the stored one alone.
CREATE OR REPLACE FUNCTION public.save_my_profile_gate(
  p_gender TEXT,
  p_location TEXT,
  p_employment_status TEXT,
  p_job_title TEXT,
  p_monthly_remuneration NUMERIC,
  p_salary_declined BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_gender TEXT := NULLIF(btrim(p_gender), '');
  v_location TEXT := NULLIF(btrim(p_location), '');
  v_emp TEXT := NULLIF(btrim(p_employment_status), '');
  v_current_emp TEXT;
BEGIN
  IF v_email IS NULL OR NOT public.is_member_allowed(v_email) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF v_gender IS NOT NULL AND v_gender NOT IN ('Male', 'Female', 'Prefer not to say') THEN
    RAISE EXCEPTION 'Unknown gender option';
  END IF;
  IF v_location IS NOT NULL AND v_location NOT IN ('Cape Town', 'Johannesburg', 'Durban', 'Pretoria', 'Other (SA)', 'Other (Rest of the World)') THEN
    RAISE EXCEPTION 'Unknown location option';
  END IF;
  IF v_emp IS NOT NULL AND v_emp NOT IN ('Employed', 'Unemployed', 'Student') THEN
    RAISE EXCEPTION 'Unknown employment status';
  END IF;

  SELECT employment_status INTO v_current_emp FROM public.member_profiles WHERE email = v_email;
  v_emp := COALESCE(v_emp, v_current_emp);

  UPDATE public.member_profiles SET
    gender = COALESCE(v_gender, gender),
    location = COALESCE(v_location, location),
    employment_status = COALESCE(v_emp, employment_status),
    job_title = CASE WHEN v_emp = 'Employed' THEN NULLIF(left(btrim(p_job_title), 120), '') ELSE NULL END,
    monthly_remuneration = CASE WHEN v_emp = 'Employed' AND NOT COALESCE(p_salary_declined, false)
                                THEN LEAST(GREATEST(COALESCE(p_monthly_remuneration, 0), 0), 10000000) ELSE 0 END,
    salary_declined = CASE WHEN v_emp = 'Employed' THEN COALESCE(p_salary_declined, false) ELSE false END,
    updated_at = now()
  WHERE email = v_email;
END;
$$;
GRANT EXECUTE ON FUNCTION public.save_my_profile_gate(TEXT, TEXT, TEXT, TEXT, NUMERIC, BOOLEAN) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.save_my_profile_gate(TEXT, TEXT, TEXT, TEXT, NUMERIC, BOOLEAN) FROM PUBLIC, anon;
