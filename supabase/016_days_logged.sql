-- Hacking Hub Admin Dashboard - Replace Points with Days Logged
-- Run this in the Supabase SQL Editor after 002-015 have already been applied.
--
-- Competition standings no longer track a "points" tally - replaced with
-- days_logged, the number of distinct days a member logged a TryHackMe room
-- during the competition window. rooms_completed is unchanged. Both remain
-- admin-entered manually (no live TryHackMe API integration), same as before.

ALTER TABLE public.competition_standings
  DROP COLUMN IF EXISTS points,
  ADD COLUMN IF NOT EXISTS days_logged INTEGER NOT NULL DEFAULT 0;

-- Same signature as before (still just p_member_name) - only the body changes,
-- so CREATE OR REPLACE is safe here without a DROP FUNCTION first.
CREATE OR REPLACE FUNCTION public.rsvp_for_competition(p_member_name TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.competition_standings (email, member_name, rooms_completed, days_logged)
  VALUES (lower(auth.jwt() ->> 'email'), p_member_name, 0, 0)
  ON CONFLICT (email) DO NOTHING;
$$;
