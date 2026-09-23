-- "Your Why" - why a member actually got into cybersecurity (money, remote
-- work, providing for family, a movie/show, career change, etc.). A
-- preset, multi-select set of reasons (countable, feeds an Insights
-- breakdown) plus an optional free-text story (the part that's actually
-- personal) - same "chips + optional detail" idea as the cert picker, same
-- self-service ownership model as fun_fact right next to it.

ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS why_reasons TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS why_story TEXT;

-- Read-only peer feed, same explicit whitelist as before - both new
-- columns are exactly as sensitive as fun_fact (self-disclosed, meant to
-- be seen by other members), so they join it in both the return type and
-- the SELECT list rather than needing their own carve-out.
DROP FUNCTION IF EXISTS public.get_member_directory();
CREATE FUNCTION public.get_member_directory()
RETURNS TABLE (
  email TEXT,
  full_name TEXT,
  about TEXT,
  location TEXT,
  linkedin TEXT,
  tryhackme_username TEXT,
  headshot_url TEXT,
  github_url TEXT,
  tiktok_url TEXT,
  website_url TEXT,
  years_experience INTEGER,
  certifications TEXT,
  fun_fact TEXT,
  specialty TEXT,
  job_readiness TEXT,
  employment_status TEXT,
  job_title TEXT,
  roadmap_track TEXT,
  why_reasons TEXT[],
  why_story TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT email, full_name, about, location, linkedin, tryhackme_username, headshot_url,
         github_url, tiktok_url, website_url, years_experience, certifications, fun_fact,
         specialty, job_readiness, employment_status, job_title, roadmap_track,
         why_reasons, why_story
  FROM public.member_profiles
  WHERE status != 'Left'
    AND full_name IS NOT NULL
    AND trim(full_name) != ''
    AND public.is_member_allowed(auth.jwt() ->> 'email');
$$;

GRANT EXECUTE ON FUNCTION public.get_member_directory() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_member_directory() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_member_directory() FROM anon;

-- Write, same "own row, whitelisted columns only" shape as before, now 19
-- args instead of 17 - explicit DROP first since the argument list is
-- changing (see this file's own header comment on why CREATE OR REPLACE
-- alone isn't safe for that).
DROP FUNCTION IF EXISTS public.update_my_directory_profile(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.update_my_directory_profile(
  p_full_name TEXT,
  p_about TEXT,
  p_location TEXT,
  p_linkedin TEXT,
  p_tryhackme_username TEXT,
  p_headshot_url TEXT,
  p_github_url TEXT,
  p_tiktok_url TEXT,
  p_website_url TEXT,
  p_years_experience INTEGER,
  p_certifications TEXT,
  p_fun_fact TEXT,
  p_specialty TEXT,
  p_employment_status TEXT,
  p_job_title TEXT,
  p_age TEXT,
  p_gender TEXT,
  p_why_reasons TEXT[],
  p_why_story TEXT
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
    headshot_url = p_headshot_url,
    github_url = p_github_url,
    tiktok_url = p_tiktok_url,
    website_url = p_website_url,
    years_experience = p_years_experience,
    certifications = p_certifications,
    fun_fact = p_fun_fact,
    specialty = p_specialty,
    employment_status = p_employment_status,
    job_title = p_job_title,
    age = p_age,
    gender = p_gender,
    why_reasons = COALESCE(p_why_reasons, '{}'),
    why_story = p_why_story,
    updated_at = timezone('utc'::text, now())
  WHERE email = lower(auth.jwt() ->> 'email');
$$;

GRANT EXECUTE ON FUNCTION public.update_my_directory_profile(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.update_my_directory_profile(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_my_directory_profile(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT) FROM anon;
