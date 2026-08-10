-- Hacking Hub Admin Dashboard - TryHackMe Username Field
-- Run this in the Supabase SQL Editor after 002-013 have already been applied.
--
-- Adds a tryhackme_username field alongside the other self-editable public-facing
-- columns from 010_member_directory.sql. Stored as a bare username, not a URL -
-- the profile link (https://tryhackme.com/p/<username>) is built client-side from
-- a hardcoded prefix, so there's no scheme for a malicious value to smuggle a
-- javascript: URI through the way the unvalidated linkedin field could (the XSS
-- fixed via 011_security_fixes.sql / flagged in the security review).
--
-- CREATE OR REPLACE FUNCTION can't change a function's return columns or
-- argument list - both functions below are DROPped first, then recreated with
-- the new signature.

ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS tryhackme_username TEXT;

DROP FUNCTION IF EXISTS public.get_member_directory();
CREATE FUNCTION public.get_member_directory()
RETURNS TABLE (
  email TEXT,
  full_name TEXT,
  about TEXT,
  location TEXT,
  linkedin TEXT,
  tryhackme_username TEXT,
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
  SELECT email, full_name, about, location, linkedin, tryhackme_username, specialty,
         job_readiness, employment_status, job_title
  FROM public.member_profiles
  WHERE status != 'Left'
    AND public.is_member_allowed(auth.jwt() ->> 'email');
$$;

GRANT EXECUTE ON FUNCTION public.get_member_directory() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_member_directory() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_member_directory() FROM anon;

DROP FUNCTION IF EXISTS public.update_my_directory_profile(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
CREATE FUNCTION public.update_my_directory_profile(
  p_full_name TEXT,
  p_about TEXT,
  p_location TEXT,
  p_linkedin TEXT,
  p_tryhackme_username TEXT,
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
    tryhackme_username = p_tryhackme_username,
    specialty = p_specialty,
    employment_status = p_employment_status,
    job_title = p_job_title,
    updated_at = timezone('utc'::text, now())
  WHERE email = lower(auth.jwt() ->> 'email');
$$;

GRANT EXECUTE ON FUNCTION public.update_my_directory_profile(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.update_my_directory_profile(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_my_directory_profile(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM anon;
