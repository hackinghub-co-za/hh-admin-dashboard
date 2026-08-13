-- Hacking Hub Admin Dashboard - Events, RSVPs & Moderation
-- Run this in the Supabase SQL Editor after 002-016 have already been applied.
-- Safe to re-run: every statement is idempotent, in case an earlier partial run
-- left the database in a mixed state.
--
-- Events were previously hardcoded in MemberPortal.jsx (communityEvents) - now a
-- real table so members can add their own, not just view a fixed admin-set
-- list. RSVPs ("Yes I'm There") were previously local-only React state that
-- reset on every page reload and showed made-up attendance numbers - both are
-- real, persisted tables now. Real attendance starts at 0 for every event and
-- only grows as real members actually RSVP - no fake baseline blended in, same
-- principle already applied to the Competitions leaderboard
-- (015_competition_standings.sql).
--
-- This file is the consolidated, current source of truth for the whole Events
-- feature - it originally shipped without moderation or the ability to
-- un-RSVP, which were then added in separate 022_event_moderation.sql and
-- 023_event_unrsvp.sql. Rather than leave those spread across later files -
-- which would silently regress this file back to an outdated state if it were
-- ever re-run on its own - every change has been folded back in here, and
-- 022/023 have been deleted.
--
-- Any approved member can add an event (self-attributed via created_by, same
-- "member owns their own submission" pattern as reviews/005_reviews.sql). New
-- submissions always start 'Pending' and are only visible to their own
-- submitter until approved - approval is deliberately narrower than the
-- general is_admin() check: only siya@hackinghub.co.za can approve, enforced
-- via a dedicated RPC (which can check an exact email) rather than a broad
-- RLS policy (which can only check the is_admin() role). Only admins can edit
-- or remove an event that isn't theirs - deliberately no member-facing
-- edit/delete yet, only add (and un-RSVP from one they'd previously joined).
--
-- community_events is seeded with the 7 events that were previously hardcoded
-- in MemberPortal.jsx, using the exact same ids, so event_rsvps rows already
-- collected against those ids stay correctly linked. The FK from event_rsvps to
-- community_events is added via a separate ALTER TABLE (rather than inline on
-- CREATE TABLE) so this script works regardless of which table already exists.

CREATE TABLE IF NOT EXISTS public.community_events (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('HH Meetup', 'Industry Event', 'Sunday Catchup')),
  title TEXT NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  time TEXT,
  location TEXT,
  link TEXT,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.community_events
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Pending'
    CHECK (status IN ('Pending', 'Approved'));

ALTER TABLE public.community_events ENABLE ROW LEVEL SECURITY;

-- Members can see approved events, plus their own submissions regardless of
-- status (so they can see their own pending event). Admins see everything
-- through the separate FOR ALL policy below regardless of this one.
DROP POLICY IF EXISTS "members read community events" ON public.community_events;
CREATE POLICY "members read community events"
  ON public.community_events FOR SELECT
  TO authenticated
  USING (
    public.is_member_allowed(auth.jwt() ->> 'email')
    AND (status = 'Approved' OR created_by = lower(auth.jwt() ->> 'email'))
  );

-- Self-service creation, same pattern as reviews: a member can only ever
-- attribute a new event to their own verified sign-in email, never someone
-- else's, and only if they're an actual approved member. New submissions
-- always start Pending regardless of what the client sends - WITH CHECK
-- enforces this server-side so a member can't insert an already-'Approved'
-- event by crafting the request directly.
DROP POLICY IF EXISTS "members add community events" ON public.community_events;
CREATE POLICY "members add community events"
  ON public.community_events FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = lower(auth.jwt() ->> 'email')
    AND public.is_member_allowed(auth.jwt() ->> 'email')
    AND status = 'Pending'
  );

-- Admins manage everything directly (editing/removing/approving any event),
-- same is_admin() pattern as every other table.
DROP POLICY IF EXISTS "admins manage community events" ON public.community_events;
CREATE POLICY "admins manage community events"
  ON public.community_events FOR ALL
  USING (public.is_admin(auth.uid()));

INSERT INTO public.community_events (id, type, title, description, date, time, location, link, created_by) VALUES
  (1, 'HH Meetup', 'Cyber War Games: Capture The Flag', 'Team-based CTF night with prizes for the top 3 teams.', '2026-08-16', '18:00', 'HH Discord & Hybrid JHB', NULL, NULL),
  (2, 'Sunday Catchup', 'Sunday Coffee & Code Catchup', 'Casual weekly hangout — share wins, ask questions, no agenda.', '2026-08-17', '10:00', 'Google Meet', NULL, NULL),
  (3, 'HH Meetup', 'OSINT Fundamentals Workshop', 'Hands-on open-source recon workshop led by Jaco.', '2026-08-23', '17:30', 'Online (Zoom)', NULL, NULL),
  (4, 'Industry Event', 'ITWeb Security Summit 2026', 'Industry conference — HH is attending as a group, ask in the community for details.', '2026-08-25', '08:00', 'Sandton Convention Centre', NULL, NULL),
  (5, 'Sunday Catchup', 'Sunday Coffee & Code Catchup', 'Casual weekly hangout — share wins, ask questions, no agenda.', '2026-08-24', '10:00', 'Google Meet', NULL, NULL),
  (6, 'Industry Event', 'BSides Cape Town', 'Community-run infosec conference — group discount code shared in the community.', '2026-09-05', '09:00', 'Cape Town', NULL, NULL),
  (7, 'Sunday Catchup', 'HH S4 Kickoff', 'Kicking off Season 4 — what''s new this quarter, the TryHackMe competition, and a chance to meet the rest of the community.', '2026-08-23', '17:00', 'Google Meet', 'https://meet.google.com/pce-rcrd-xmk', NULL)
ON CONFLICT (id) DO NOTHING;

-- The 7 seeded events above were never actually "reviewed" - they're
-- launch-day content, not a member submission - so they're marked Approved
-- explicitly by id rather than a blanket "every Pending row" backfill, which
-- would incorrectly approve a real member's still-pending submission if this
-- script is ever re-run after real submissions exist.
UPDATE public.community_events SET status = 'Approved' WHERE id IN (1, 2, 3, 4, 5, 6, 7);

-- Keep the auto-increment sequence ahead of the manually-seeded ids above, so
-- the first member-created event gets id 8, not a collision with 1-7.
SELECT setval(pg_get_serial_sequence('public.community_events', 'id'), 7, true);

-- Approval is intentionally scoped to one specific person, not every admin -
-- a SECURITY DEFINER RPC rather than a broader RLS policy, so it can check an
-- exact email rather than the general is_admin() role. SECURITY DEFINER
-- functions bypass RLS on the tables they touch, which is exactly why this
-- explicit in-body check is required, not just a stylistic choice.
DROP FUNCTION IF EXISTS public.approve_community_event(BIGINT);
CREATE FUNCTION public.approve_community_event(p_event_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(auth.jwt() ->> 'email') != 'siya@hackinghub.co.za' THEN
    RAISE EXCEPTION 'Only siya@hackinghub.co.za can approve events';
  END IF;
  UPDATE public.community_events SET status = 'Approved' WHERE id = p_event_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_community_event(BIGINT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.approve_community_event(BIGINT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.approve_community_event(BIGINT) FROM anon;

CREATE TABLE IF NOT EXISTS public.event_rsvps (
  event_id INTEGER NOT NULL,
  email TEXT NOT NULL,
  rsvped_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (event_id, email)
);

ALTER TABLE public.event_rsvps DROP CONSTRAINT IF EXISTS event_rsvps_event_id_fkey;
ALTER TABLE public.event_rsvps
  ADD CONSTRAINT event_rsvps_event_id_fkey FOREIGN KEY (event_id) REFERENCES public.community_events(id) ON DELETE CASCADE;

ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

-- Every approved member can see all RSVPs - needed to compute real attendance
-- counts and to know which events they've personally RSVP'd to. No sensitive
-- data here, just an event id + email + timestamp.
DROP POLICY IF EXISTS "members read event rsvps" ON public.event_rsvps;
CREATE POLICY "members read event rsvps"
  ON public.event_rsvps FOR SELECT
  TO authenticated
  USING (public.is_member_allowed(auth.jwt() ->> 'email'));

-- Admins manage everything directly, same is_admin() pattern as every other table.
DROP POLICY IF EXISTS "admins manage event rsvps" ON public.event_rsvps;
CREATE POLICY "admins manage event rsvps"
  ON public.event_rsvps FOR ALL
  USING (public.is_admin(auth.uid()));

-- Self-service RSVP, scoped to only the caller's own row, keyed off their
-- verified sign-in email - never a client-supplied one. ON CONFLICT DO NOTHING
-- makes re-RSVPing (e.g. a double click) a harmless no-op instead of an error.
CREATE OR REPLACE FUNCTION public.rsvp_for_event(p_event_id INTEGER)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.event_rsvps (event_id, email)
  VALUES (p_event_id, lower(auth.jwt() ->> 'email'))
  ON CONFLICT (event_id, email) DO NOTHING;
$$;

GRANT EXECUTE ON FUNCTION public.rsvp_for_event(INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.rsvp_for_event(INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rsvp_for_event(INTEGER) FROM anon;

-- Mirror-image of rsvp_for_event - lets a member undo their own RSVP, scoped
-- to only their own row via the same auth.jwt() email pattern. A no-op if
-- they hadn't RSVP'd in the first place, same "harmless if called
-- redundantly" spirit as rsvp_for_event's ON CONFLICT DO NOTHING.
CREATE OR REPLACE FUNCTION public.unrsvp_from_event(p_event_id INTEGER)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.event_rsvps
  WHERE event_id = p_event_id AND email = lower(auth.jwt() ->> 'email');
$$;

GRANT EXECUTE ON FUNCTION public.unrsvp_from_event(INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.unrsvp_from_event(INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.unrsvp_from_event(INTEGER) FROM anon;
