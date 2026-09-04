-- Hacking Hub Admin Dashboard - Interviews Had
-- Run this in the Supabase SQL Editor after 002_member_persistence.sql has
-- already been applied. Safe to re-run: idempotent.
--
-- Feeds the "Interviews Had" stat on the member-side "My Journey So Far"
-- tile/storyline (MemberPortal.jsx). Unlike every other stat on that tile,
-- there's no real activity anywhere in the app to derive a genuine count
-- from - "Interview Prep" only tracks AI-generated prep sessions, not real
-- interviews a member actually had - so this is a simple admin-set count
-- instead, same trust level (and same edit surface, the Members tab) as
-- Job Readiness. No date is tracked alongside it - just a running total -
-- so it shows in the storyline as an undated milestone, not a dated
-- timeline entry.
--
-- Members can see their own count (Dashboard/My Roadmap) but never set it
-- themselves - explicitly confirmed: admin-editable only, same reasoning as
-- 042_manual_start_date.sql's start date override. get_my_interviews_had()
-- is the same narrow SECURITY DEFINER + own-row-only pattern as
-- get_my_start_date() / get_my_age_and_gender().

ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS interviews_had INTEGER NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.get_my_interviews_had()
RETURNS INTEGER
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT COALESCE(interviews_had, 0)
  FROM public.member_profiles
  WHERE email = lower(auth.jwt() ->> 'email');
$$;
GRANT EXECUTE ON FUNCTION public.get_my_interviews_had() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_interviews_had() FROM PUBLIC, anon;
