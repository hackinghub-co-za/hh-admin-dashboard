-- Hacking Hub Admin Dashboard - Member Directory
-- Run this in the Supabase SQL Editor after 002-009 have already been applied.
--
-- Lets members browse each other's profiles (about, location, LinkedIn,
-- TryHackMe username, headshot photo, job title/employment status, specialty,
-- job readiness) and self-edit their own entry. member_profiles is otherwise
-- locked to admins-only for every operation (FOR ALL USING is_admin(...)) and
-- holds genuinely sensitive columns (money_owed, monthly_remuneration, phone,
-- offboarding/exit-feedback fields, age, gender) - a row-level policy can't
-- hide specific columns, so this can't be a broad "members can SELECT
-- member_profiles" policy. Instead, same pattern as every other member-facing
-- RPC in this schema: a SECURITY DEFINER function that returns only an
-- explicit, hand-picked column whitelist, and a narrow write function scoped
-- to only the caller's own row and only the same public-facing columns.
-- Anon/PUBLIC revoke included immediately (lesson learned from
-- 006/007_onboarding, where that had to be a follow-up fix).
--
-- This file is the consolidated, current source of truth for both functions
-- below - it originally shipped a narrower version of each, which was then
-- revised several times more (a security fix restricting get_member_directory()
-- to approved members and locking update_my_directory_profile() to
-- UPDATE-only, then the TryHackMe username field, then hiding unnamed
-- profiles, then the headshot photo, then GitHub/TikTok/personal website
-- links, then years of experience/certifications/fun fact below). Rather
-- than leave those revisions spread across later files - which would
-- silently regress this file back to an outdated, less secure state if it
-- were ever re-run on its own - every change has been folded back in here.
-- The once-separate 014_tryhackme_username.sql and
-- 018_hide_unnamed_directory_members.sql have been removed since everything
-- they did now lives in this file; 011_security_fixes.sql keeps only its
-- unrelated profiles-table fix (Vuln 1).

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
  ADD COLUMN IF NOT EXISTS about TEXT,
  ADD COLUMN IF NOT EXISTS tryhackme_username TEXT,
  ADD COLUMN IF NOT EXISTS headshot_url TEXT,
  ADD COLUMN IF NOT EXISTS github_url TEXT,
  ADD COLUMN IF NOT EXISTS tiktok_url TEXT,
  ADD COLUMN IF NOT EXISTS website_url TEXT,
  ADD COLUMN IF NOT EXISTS years_experience INTEGER,
  ADD COLUMN IF NOT EXISTS certifications TEXT,
  ADD COLUMN IF NOT EXISTS fun_fact TEXT;

-- =========================================================================
-- HEADSHOT STORAGE - a dedicated public bucket, not member_profiles. Members
-- upload their own file to a path prefixed with their own lowercased email
-- (e.g. jane@example.com/headshot.jpg); the RLS policies below only let a
-- member write inside their own prefix, keyed off their verified sign-in
-- email, same auth.jwt() pattern as every RPC in this file. Public read since
-- headshots are exactly as public as the rest of the directory. Capped at 5MB
-- and image mime types only, enforced at the bucket level (not just the
-- client's <input accept>, which is trivially bypassable).
-- =========================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('member-headshots', 'member-headshots', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "public read member headshots" ON storage.objects;
CREATE POLICY "public read member headshots"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'member-headshots');

DROP POLICY IF EXISTS "members upload own headshot" ON storage.objects;
CREATE POLICY "members upload own headshot"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'member-headshots'
    AND (storage.foldername(name))[1] = lower(auth.jwt() ->> 'email')
    AND public.is_member_allowed(auth.jwt() ->> 'email')
  );

DROP POLICY IF EXISTS "members replace own headshot" ON storage.objects;
CREATE POLICY "members replace own headshot"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'member-headshots'
    AND (storage.foldername(name))[1] = lower(auth.jwt() ->> 'email')
  );

DROP POLICY IF EXISTS "members delete own headshot" ON storage.objects;
CREATE POLICY "members delete own headshot"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'member-headshots'
    AND (storage.foldername(name))[1] = lower(auth.jwt() ->> 'email')
  );

-- Read-only, explicit column whitelist - never exposes money_owed, phone, exit
-- feedback, etc. no matter what's added to member_profiles later. Only shows
-- active-ish members (excludes 'Left') who are themselves an approved member
-- (is_member_allowed) and who've actually set a full_name (otherwise they show
-- up as an unhelpful "Unnamed member" card).
-- roadmap_track added for the "grouped by domain" directory view - the
-- track itself is admin-assigned, not sensitive (a member already sees
-- their own via My Roadmap, and it's the same value shown in the admin
-- Members tab), so exposing it alongside the already-public specialty badge
-- doesn't cross the sensitivity line the rest of this function draws.
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
  roadmap_track TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT email, full_name, about, location, linkedin, tryhackme_username, headshot_url,
         github_url, tiktok_url, website_url, years_experience, certifications, fun_fact,
         specialty, job_readiness, employment_status, job_title, roadmap_track
  FROM public.member_profiles
  WHERE status != 'Left'
    AND full_name IS NOT NULL
    AND trim(full_name) != ''
    AND public.is_member_allowed(auth.jwt() ->> 'email');
$$;

GRANT EXECUTE ON FUNCTION public.get_member_directory() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_member_directory() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_member_directory() FROM anon;

-- Write, scoped to only the caller's own row and only these 15 public-facing
-- columns - money_owed/status/offboarding/etc. stay completely untouchable
-- from here. UPDATE-only (never INSERT) - every real member already has a row
-- (backfilled in 004_member_access_control.sql, or created by an admin), so a
-- caller with no existing row just matches zero rows and no-ops, rather than
-- being able to self-provision a brand-new 'Active' membership row.
--
-- CREATE OR REPLACE, not DROP+CREATE - this file used to pair a DROP
-- FUNCTION IF EXISTS with a bare CREATE FUNCTION here (needed only when a
-- revision actually changes the argument list, which CREATE OR REPLACE
-- can't do), but that DROP line's signature was never updated when
-- years_experience/certifications/fun_fact were added. It matched nothing
-- live, silently no-opped, and left the real CREATE colliding with the
-- function that already existed - "already exists with same argument
-- types". CREATE OR REPLACE is exactly the right tool when the signature
-- isn't changing, and sidesteps this whole class of bug.
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
    updated_at = timezone('utc'::text, now())
  WHERE email = lower(auth.jwt() ->> 'email');
$$;

GRANT EXECUTE ON FUNCTION public.update_my_directory_profile(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.update_my_directory_profile(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_my_directory_profile(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT) FROM anon;
