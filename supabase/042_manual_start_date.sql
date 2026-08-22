-- Hacking Hub Admin Dashboard - Manually-Set Member Start Date
-- Run this in the Supabase SQL Editor after 002_member_persistence.sql has
-- already been applied. Safe to re-run: idempotent.
--
-- "Start Date" on a member's profile was always derived from their first
-- real PayFast payment (member_profiles has no source of its own for it) -
-- fine for most members, but wrong for anyone who joined before ever paying
-- (e.g. the allowlisted-no-payment members from earlier - 029_member_
-- roadmaps.sql's Chioma fix) or whose coaching relationship genuinely
-- started on a different date than their first payment. This column lets
-- an admin set the real date directly; it's an override, not a replacement
-- - the payment-derived date still shows separately as "First Payment" on
-- the member's profile. It's also preferred first when Insights computes
-- join-date-based stats (tenure, time to employment, time to first cert),
-- ahead of onboarded_at and first payment date.
--
-- Members can see their own start date (Dashboard) but never set it
-- themselves - explicitly confirmed: admin-editable only, so it stays
-- trustworthy for the Insights tenure stats it feeds. get_my_start_date()
-- is the same narrow SECURITY DEFINER + own-row-only pattern as
-- get_my_roadmap_track() - one column, one row, the caller's own. Falls
-- back to onboarded_at if no admin has set a manual date yet; it can't also
-- fall back to first-payment-date the way the admin-side UI does, since
-- that's derived client-side from a static JSON snapshot merged with live
-- PayFast data, not something a database function can see.

ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS manual_start_date DATE;

CREATE OR REPLACE FUNCTION public.get_my_start_date()
RETURNS DATE
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT COALESCE(manual_start_date, onboarded_at::date)
  FROM public.member_profiles
  WHERE email = lower(auth.jwt() ->> 'email');
$$;
GRANT EXECUTE ON FUNCTION public.get_my_start_date() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_start_date() FROM PUBLIC, anon;
