-- Hacking Hub Admin Dashboard - Competition Opt-Out
-- Run this in the Supabase SQL Editor after 002-052 have already been
-- applied. Safe to re-run: every statement is idempotent.
--
-- The Competitions tab's "Yes I'm In" button only ever let a member join -
-- once RSVP'd, there was no way back (the button was simply disabled). This
-- adds an opt-out.
--
-- Soft opt-out, not a delete: a competition_standings row can carry real,
-- admin-entered progress (rooms_completed/days_logged, manually tracked "as
-- the competition progresses" per 015_competition_standings.sql's own
-- header, automated further by 031_daily_room_logs.sql's approval flow). A
-- hard delete would silently lose that progress the moment a member opted
-- back in later (a fresh INSERT restarting them at 0/0), so this instead
-- flags the row hidden and leaves it fully intact - opting back in resumes
-- exactly where they left off.
--
-- No RLS changes needed - visibility is filtered in the client query
-- (competitionData.js's fetchCompetitionStandings, WHERE opted_out = false),
-- same as how 019_events.sql already leaves non-sensitive row filtering to
-- the query rather than RLS. review_daily_room_log (031_daily_room_logs.sql)
-- also needs no change: it credits a row by email directly, so a pending
-- room-log submission approved after a member opts out still correctly
-- credits their (still-present, just hidden) row.

ALTER TABLE public.competition_standings
  ADD COLUMN IF NOT EXISTS opted_out BOOLEAN NOT NULL DEFAULT false;

-- Same signature and INSERT columns as 016_days_logged.sql's version (the
-- current live definition - 015_competition_standings.sql's original body
-- is stale, superseded by 016's points -> days_logged swap). Only the
-- ON CONFLICT clause changes: it was DO NOTHING, which would otherwise leave
-- a returning member stuck flagged opted_out forever, since re-RSVPing
-- would silently no-op instead of clearing the flag. rooms_completed/
-- days_logged/member_name are deliberately left untouched on conflict, same
-- as before - only opted_out flips back.
--
-- p_member_name is kept in the signature (the frontend already calls this
-- with it, no need to churn that) but is no longer trusted - it used to be
-- written straight onto competition_standings, a public leaderboard tied to
-- real prize money, so any signed-in member could call this RPC directly
-- (bypassing the UI, which only ever sends their real Google name) with an
-- arbitrary p_member_name and impersonate someone else, or post whatever
-- they wanted, in front of the whole community. Resolved server-side from
-- member_profiles instead, same pattern challenge_to_room_race()
-- (063_room_races.sql) and notify_admin_of_roadmap_completion()
-- (061_admin_notifications.sql) already use for "the caller's own real
-- name" - COALESCE to email for the rare member with no full_name set yet,
-- same fallback those use too.
CREATE OR REPLACE FUNCTION public.rsvp_for_competition(p_member_name TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_name TEXT;
BEGIN
  SELECT full_name INTO v_name FROM public.member_profiles WHERE email = v_email;

  INSERT INTO public.competition_standings (email, member_name, rooms_completed, days_logged)
  VALUES (v_email, COALESCE(v_name, v_email), 0, 0)
  ON CONFLICT (email) DO UPDATE SET opted_out = false;
END;
$$;

-- Mirrors rsvp_for_competition's own self-service, own-row-only pattern -
-- scoped to the caller's verified sign-in email, never a client-supplied one.
-- A no-op if they never RSVP'd in the first place (UPDATE matches 0 rows).
CREATE OR REPLACE FUNCTION public.opt_out_of_competition()
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.competition_standings SET opted_out = true
  WHERE email = lower(auth.jwt() ->> 'email');
$$;

GRANT EXECUTE ON FUNCTION public.opt_out_of_competition() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.opt_out_of_competition() FROM PUBLIC, anon;
