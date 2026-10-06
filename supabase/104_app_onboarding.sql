-- Hacking Hub Admin Dashboard - hh-app New Member Onboarding (Step 1 data)
-- Run this in the Supabase SQL Editor after 002-103 have already been applied.
-- Safe to re-run: every statement is idempotent.
--
-- Backs the hh-app mobile onboarding flow's mandatory Step 1 ("Your Member
-- Data"). Deliberately NOT a new checklist system - the app's 3 required
-- steps (watch the welcome video, fill in member data, introduce yourself
-- in WhatsApp) map directly onto 3 of the 6 step_keys the web portal's
-- Getting Started checklist already tracks (006_onboarding.sql:
-- 'watch_video', 'setup_profile', 'join_whatsapp'), so this reuses that
-- exact table/RPC rather than building a parallel one. A member who
-- already finished those 3 steps on web (even without ever touching the
-- other 3, book_1on1/install_calendar/portal_tour) correctly skips the
-- app's gate on first install.
--
-- Most of Step 1's fields already have a column (tryhackme_username,
-- phone, linkedin, location, age, employment_status - all from
-- 010_member_directory.sql / 002_member_persistence.sql) and could in
-- principle go through the existing update_my_directory_profile() RPC -
-- this uses a new, narrower RPC instead specifically to avoid touching a
-- function the web portal's own profile editor already depends on. Only
-- two genuinely new columns are needed: company_name (no existing column
-- fit) and hh_team (no team-assignment concept exists anywhere yet).

ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS company_name TEXT;

ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS hh_team TEXT CHECK (hh_team IN ('HH Red', 'HH Blue'));

-- Self-service, same ownership pattern as update_my_directory_profile() -
-- scoped to only the caller's own row, keyed off their verified sign-in
-- email. All params nullable/optional (DEFAULT NULL with COALESCE below)
-- so a partial save (e.g. company name only relevant when employed) never
-- clobbers a field the member didn't touch this time.
CREATE OR REPLACE FUNCTION public.save_my_onboarding_profile(
  p_tryhackme_username TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_linkedin TEXT DEFAULT NULL,
  p_location TEXT DEFAULT NULL,
  p_age TEXT DEFAULT NULL,
  p_employment_status TEXT DEFAULT NULL,
  p_company_name TEXT DEFAULT NULL,
  p_hh_team TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
BEGIN
  IF v_email IS NULL OR NOT public.is_member_allowed(v_email) THEN
    RAISE EXCEPTION 'Not an approved member.';
  END IF;

  UPDATE public.member_profiles
  SET tryhackme_username = COALESCE(p_tryhackme_username, tryhackme_username),
      phone = COALESCE(p_phone, phone),
      linkedin = COALESCE(p_linkedin, linkedin),
      location = COALESCE(p_location, location),
      age = COALESCE(p_age, age),
      employment_status = COALESCE(p_employment_status, employment_status),
      company_name = COALESCE(p_company_name, company_name),
      hh_team = COALESCE(p_hh_team, hh_team),
      updated_at = timezone('utc'::text, now())
  WHERE email = v_email;
END;
$$;
GRANT EXECUTE ON FUNCTION public.save_my_onboarding_profile(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.save_my_onboarding_profile(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
