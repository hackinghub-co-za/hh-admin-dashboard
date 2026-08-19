-- Hacking Hub Admin Dashboard - Roadmap Foundations Approval Gate
-- Run this in the Supabase SQL Editor after 028_roadmap.sql has been applied.
-- Safe to re-run: every statement is idempotent.
--
-- Reaching SPECIALIZATION_UNLOCK_MIN (5) completed Core Foundations certs
-- used to be enough on its own to reveal Specialization - but a member can
-- toggle their own roadmap_items.completed via toggle_my_roadmap_item(),
-- with nothing stopping them from checking things off they haven't actually
-- done to rush into Specialization early. This adds a second, deliberate
-- gate on top of the count: an admin has to explicitly approve a member's
-- foundations progress before Specialization actually unlocks, even once
-- they've hit 5/8. The count alone now only makes a member ELIGIBLE for
-- that review, not automatically unlocked.

ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS roadmap_foundations_approved_at TIMESTAMP WITH TIME ZONE;

-- Same narrow-exposure pattern as get_my_roadmap_track() - member_profiles
-- has no member-facing SELECT policy at all, so this is the only way a
-- member can read even this one column about their own row.
CREATE OR REPLACE FUNCTION public.get_my_roadmap_foundations_approved()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT roadmap_foundations_approved_at IS NOT NULL
  FROM public.member_profiles
  WHERE email = lower(auth.jwt() ->> 'email');
$$;
GRANT EXECUTE ON FUNCTION public.get_my_roadmap_foundations_approved() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_roadmap_foundations_approved() FROM PUBLIC, anon;
