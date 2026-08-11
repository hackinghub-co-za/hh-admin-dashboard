-- Hacking Hub Admin Dashboard - Competition Standings (persisted RSVP + leaderboard)
-- Run this in the Supabase SQL Editor after 002-014 have already been applied.
--
-- Backs the Competitions tab's "Yes I'm In" RSVP and Current Standings leaderboard,
-- which were previously local-only React state that reset on every page reload.
-- Dedicated table, not a member_profiles column - this data (rooms completed,
-- points) has nothing to do with a member's profile and is meant to be visible to
-- every member (a leaderboard), unlike member_profiles' admin-only default.
--
-- rooms_completed/points start at 0 on RSVP and are only ever admin-editable from
-- here on (there's no live TryHackMe API integration to pull real scores from, so
-- an admin enters them manually as the competition progresses - same manual-entry
-- pattern already used for the Cert Calendar). A member can only ever insert their
-- own starting row via the RPC below, never set their own score.

CREATE TABLE public.competition_standings (
  email TEXT PRIMARY KEY,
  member_name TEXT NOT NULL,
  rooms_completed INTEGER NOT NULL DEFAULT 0,
  points INTEGER NOT NULL DEFAULT 0,
  rsvped_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.competition_standings ENABLE ROW LEVEL SECURITY;

-- Every approved member can see the whole leaderboard - no sensitive columns here
-- (just a name, a room count, and a point total), so unlike member_profiles this
-- doesn't need a column-whitelisting RPC, just a direct RLS policy. Still gated by
-- is_member_allowed so a signed-in-but-never-approved account can't read it either.
CREATE POLICY "members read competition standings"
  ON public.competition_standings FOR SELECT
  TO authenticated
  USING (public.is_member_allowed(auth.jwt() ->> 'email'));

-- Admins manage everything directly (entering rooms_completed/points as the
-- competition progresses), same is_admin() pattern as every other table.
CREATE POLICY "admins manage competition standings"
  ON public.competition_standings FOR ALL
  USING (public.is_admin(auth.uid()));

-- Self-service RSVP, scoped to only the caller's own row, keyed off their
-- verified sign-in email - rooms_completed/points are hardcoded to 0 here and
-- never taken from the caller, so a member can never set their own score.
-- ON CONFLICT DO NOTHING makes re-RSVPing a harmless no-op rather than resetting
-- an already-scored member back to 0.
CREATE OR REPLACE FUNCTION public.rsvp_for_competition(p_member_name TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.competition_standings (email, member_name, rooms_completed, points)
  VALUES (lower(auth.jwt() ->> 'email'), p_member_name, 0, 0)
  ON CONFLICT (email) DO NOTHING;
$$;

GRANT EXECUTE ON FUNCTION public.rsvp_for_competition(TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.rsvp_for_competition(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rsvp_for_competition(TEXT) FROM anon;
