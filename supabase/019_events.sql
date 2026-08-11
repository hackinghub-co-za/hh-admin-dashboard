-- Hacking Hub Admin Dashboard - Events & RSVPs (member-submitted events + persisted attendance)
-- Run this in the Supabase SQL Editor after 002-016 have already been applied.
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
-- Any approved member can add an event (self-attributed via created_by, same
-- "member owns their own submission" pattern as reviews/005_reviews.sql) and
-- can read every event. Only admins can edit or remove one that isn't theirs -
-- deliberately no member-facing edit/delete yet, only add.
--
-- community_events is seeded with the 7 events that were previously hardcoded
-- in MemberPortal.jsx, using the exact same ids, so event_rsvps (created right
-- after, in this same script) can reference them with a real foreign key from
-- the start - no "add the constraint after the fact" step needed.

CREATE TABLE public.community_events (
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

ALTER TABLE public.community_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read community events"
  ON public.community_events FOR SELECT
  TO authenticated
  USING (public.is_member_allowed(auth.jwt() ->> 'email'));

-- Self-service creation, same pattern as reviews: a member can only ever
-- attribute a new event to their own verified sign-in email, never someone
-- else's, and only if they're an actual approved member.
CREATE POLICY "members add community events"
  ON public.community_events FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = lower(auth.jwt() ->> 'email')
    AND public.is_member_allowed(auth.jwt() ->> 'email')
  );

-- Admins manage everything directly (editing/removing any event), same
-- is_admin() pattern as every other table.
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

-- Keep the auto-increment sequence ahead of the manually-seeded ids above, so
-- the first member-created event gets id 8, not a collision with 1-7.
SELECT setval(pg_get_serial_sequence('public.community_events', 'id'), 7, true);

CREATE TABLE public.event_rsvps (
  event_id INTEGER NOT NULL REFERENCES public.community_events(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  rsvped_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (event_id, email)
);

ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

-- Every approved member can see all RSVPs - needed to compute real attendance
-- counts and to know which events they've personally RSVP'd to. No sensitive
-- data here, just an event id + email + timestamp.
CREATE POLICY "members read event rsvps"
  ON public.event_rsvps FOR SELECT
  TO authenticated
  USING (public.is_member_allowed(auth.jwt() ->> 'email'));

-- Admins manage everything directly, same is_admin() pattern as every other table.
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
