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
--
-- Update: 6 of those 7 (ids 1,2,3,4,5,7) were made-up placeholder content that
-- was never a real event - only id 6, BSides Cape Town, is a real thing
-- happening, and even it shipped with the wrong date and no real link. Rather
-- than leave a separate cleanup file for later, this consolidates in place:
-- the seed INSERT below now only seeds the real event with correct details,
-- and an explicit DELETE + UPDATE handle correcting a database where the old
-- version of this script already ran.
--
-- Update: added a 4th event type, 'Study Session', for a co-working/study
-- block distinct from a full HH Meetup or a casual Sunday Catchup. The
-- CREATE TABLE's inline CHECK below now includes it for a fresh install; the
-- ALTER TABLE further down fixes an already-existing table, since CREATE
-- TABLE IF NOT EXISTS is a no-op against one.

CREATE TABLE IF NOT EXISTS public.community_events (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('HH Meetup', 'Industry Event', 'Sunday Catchup', 'Study Session')),
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

-- Optional seat cap - NULL (the default, and every event until the
-- Hackathon below) means unlimited, same as every event behaved before this
-- column existed. Set, rsvp_for_event() below enforces it server-side:
-- first-to-RSVP fills the seats, the (capacity+1)th caller is rejected.
ALTER TABLE public.community_events
  ADD COLUMN IF NOT EXISTS capacity INTEGER CHECK (capacity IS NULL OR capacity > 0);

-- Optional logo/cover image - most events don't set one and the member/
-- public cards render fine without it; useful for an external community's
-- own branding (e.g. a partner meetup's logo) or a hero image for HH's own
-- bigger events. Just a URL, not an upload path itself - see the
-- event-images bucket below for where an uploaded file's public URL
-- actually comes from.
ALTER TABLE public.community_events
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- EVENT IMAGE STORAGE - a dedicated public bucket for the optional image
-- above. Unlike member-headshots (010_member_directory.sql, member-owned,
-- one file per member's own email-prefixed folder), events aren't
-- member-owned content - an admin curates them, so write access here is
-- staff-only rather than scoped by folder. Public read, same as headshots.
-- Admin-only here, same as "admins manage community events" originally was
-- below - is_community_manager() doesn't exist yet at this point on a fresh
-- install (it's defined in 067_permission_scopes.sql, which runs later and
-- is what widens this same policy to community_manager too, the same
-- pattern it already uses for the table's own RLS).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('event-images', 'event-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "public read event images" ON storage.objects;
CREATE POLICY "public read event images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'event-images');

DROP POLICY IF EXISTS "staff manage event images" ON storage.objects;
CREATE POLICY "staff manage event images"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'event-images' AND public.is_admin(auth.uid()))
  WITH CHECK (bucket_id = 'event-images' AND public.is_admin(auth.uid()));

-- Fixes up a table that already existed before 'Study Session' was added to
-- the CREATE TABLE's inline CHECK above - a no-op on a fresh install where
-- the constraint was already created correctly.
ALTER TABLE public.community_events DROP CONSTRAINT IF EXISTS community_events_type_check;
ALTER TABLE public.community_events
  ADD CONSTRAINT community_events_type_check
  CHECK (type IN ('HH Meetup', 'Industry Event', 'Sunday Catchup', 'Study Session'));

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
  (6, 'Industry Event', 'BSides Cape Town', 'Community-run infosec conference in Cape Town.', '2026-12-05', '09:00', 'Cape Town', 'https://www.quicket.co.za/events/384815-bsides-cape-town-5th-december-2026/#/', NULL)
ON CONFLICT (id) DO NOTHING;

-- ids 1,2,3,4,5,7 were made-up placeholder events, never real - remove them
-- from any database where the earlier version of this script already ran.
DELETE FROM public.community_events WHERE id IN (1, 2, 3, 4, 5, 7);

-- id 6 (BSides Cape Town) shipped with the wrong date and no link on an
-- earlier run of this script - ON CONFLICT DO NOTHING above won't touch an
-- already-existing row, so correct it explicitly here.
UPDATE public.community_events SET
  description = 'Community-run infosec conference in Cape Town.',
  date = '2026-12-05',
  time = '09:00',
  location = 'Cape Town',
  link = 'https://www.quicket.co.za/events/384815-bsides-cape-town-5th-december-2026/#/'
WHERE id = 6;

-- The seeded event above was never actually "reviewed" - it's launch-day
-- content, not a member submission - so it's marked Approved explicitly by id
-- rather than a blanket "every Pending row" backfill, which would incorrectly
-- approve a real member's still-pending submission if this script is ever
-- re-run after real submissions exist.
UPDATE public.community_events SET status = 'Approved' WHERE id = 6;

-- The HH Hackathon ('Capture, Build, Ship') was added directly via SQL, not
-- by the seed block above, so it's capped here by title instead - a no-op on
-- a fresh install where that event doesn't exist yet. 25 seats, first come
-- first served, per the founder.
UPDATE public.community_events SET capacity = 25 WHERE title = 'HH Hackathon: Capture, Build, Ship';

-- Keep the auto-increment sequence ahead of the manually-seeded ids above, so
-- the first member-created event gets id 8, not a collision with 1-7. GREATEST
-- against the table's real current max(id), not a bare 7 - a bare 7 is only
-- correct on a fresh install; re-running this idempotent script against a
-- live database that has since accumulated real rows past id 7 would rewind
-- the sequence backward, and the next insert would collide with an existing
-- row (hit in practice: id 8 already existed, `duplicate key value violates
-- unique constraint "community_events_pkey"`, from re-running this file long
-- after real events existed).
SELECT setval(pg_get_serial_sequence('public.community_events', 'id'), GREATEST((SELECT COALESCE(max(id), 0) FROM public.community_events), 7), true);

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
--
-- Events with a capacity set (see the column above) are enforced here,
-- server-side, not just in the UI - a member hitting this RPC directly can't
-- take a 26th seat on a 25-cap event. Someone re-RSVPing to an event they're
-- already in is always let through regardless of capacity, since they're not
-- taking a new seat. LANGUAGE plpgsql (not the original sql) because the cap
-- check needs a conditional before the insert.
CREATE OR REPLACE FUNCTION public.rsvp_for_event(p_event_id INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_capacity INTEGER;
  v_caller_email TEXT := lower(auth.jwt() ->> 'email');
BEGIN
  SELECT capacity INTO v_capacity FROM public.community_events WHERE id = p_event_id;

  IF v_capacity IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.event_rsvps WHERE event_id = p_event_id AND email = v_caller_email)
     AND (SELECT count(*) FROM public.event_rsvps WHERE event_id = p_event_id) >= v_capacity
  THEN
    RAISE EXCEPTION 'This event is full - all % seats are taken', v_capacity;
  END IF;

  INSERT INTO public.event_rsvps (event_id, email)
  VALUES (p_event_id, v_caller_email)
  ON CONFLICT (event_id, email) DO NOTHING;
END;
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

-- =========================================================================
-- SUNDAY CATCHUP RECORDINGS + SUMMARY NOTES
-- =========================================================================
-- A Sunday Catchup happens live (Google Meet), and the recording/summary
-- only exist afterward - the founder adds both links by hand once they're
-- ready (no auto-upload integration exists). recording_url is time-boxed:
-- members should only see it for 14 days after it's actually added, not 14
-- days from the event date itself (a catchup that happened on the 7th with
-- a recording only posted on the 10th should give members 14 days from the
-- 10th, not the 7th). summary_notes_url has no such window - meeting notes
-- don't go stale as fast as a full video recording, so once posted it just
-- stays up.
ALTER TABLE public.community_events ADD COLUMN IF NOT EXISTS recording_url TEXT;
ALTER TABLE public.community_events ADD COLUMN IF NOT EXISTS recording_added_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.community_events ADD COLUMN IF NOT EXISTS summary_notes_url TEXT;

-- Stamps recording_added_at the moment recording_url actually transitions
-- from unset to set (whoever writes it - the admin UI's direct table
-- update, same is_admin()/is_community_manager() RLS every other event
-- edit already goes through), so the 14-day clock always reflects when the
-- recording genuinely became available, not when the row happened to be
-- touched for something else. Clearing the link (set back to NULL, e.g. a
-- bad link posted by mistake) clears the timestamp too, so re-adding it
-- later starts a fresh 14-day window rather than reusing a stale one.
CREATE OR REPLACE FUNCTION public._stamp_event_recording_added_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.recording_url IS NOT NULL AND OLD.recording_url IS NULL THEN
    NEW.recording_added_at := timezone('utc'::text, now());
  ELSIF NEW.recording_url IS NULL THEN
    NEW.recording_added_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_event_recording_added_at ON public.community_events;
CREATE TRIGGER trg_stamp_event_recording_added_at
  BEFORE UPDATE ON public.community_events
  FOR EACH ROW EXECUTE FUNCTION public._stamp_event_recording_added_at();

-- =========================================================================
-- SUNDAY CATCHUP AGENDA (staff-only)
-- =========================================================================
-- Free-form prep notes for a Sunday Catchup - announcements (new joiners,
-- new jobs, cert passes, THM weekly challenge winner), plus the loose
-- run-of-show items (spin the wheel, who's presenting, who to pick for next
-- week). One big text field, not structured sub-fields - matches how the
-- founder actually writes these (a real example, 2026-09-20, mixed bullets
-- and action items under one "Announcements:" header), and a rigid schema
-- would fight that instead of just holding it.
--
-- Genuinely staff-only, not just hidden in the UI: unlike recording_url/
-- summary_notes_url above (member-facing, so a plain column + the app's own
-- column-limited SELECT is enough), agenda_notes is exposed ONLY through
-- two narrow RPCs, never a raw column selectable via the existing "members
-- read community events" row-level policy - that policy filters ROWS
-- (approved + allowed), not COLUMNS, so relying on it here would still let
-- a member who called the table directly (bypassing the app's own
-- column-whitelisted fetch) read it. Same reasoning already documented in
-- 052_public_events.sql's own header for why a public RPC hand-picks
-- columns instead of trusting a row-level policy alone.
ALTER TABLE public.community_events ADD COLUMN IF NOT EXISTS agenda_notes TEXT;

CREATE OR REPLACE FUNCTION public.get_event_agenda(p_event_id BIGINT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notes TEXT;
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_community_manager(auth.uid())) THEN
    RAISE EXCEPTION 'Only the founder or a Community Manager can view the agenda.';
  END IF;
  SELECT agenda_notes INTO v_notes FROM public.community_events WHERE id = p_event_id;
  RETURN v_notes;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_event_agenda(BIGINT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_event_agenda(BIGINT) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.set_event_agenda(p_event_id BIGINT, p_agenda_notes TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_community_manager(auth.uid())) THEN
    RAISE EXCEPTION 'Only the founder or a Community Manager can edit the agenda.';
  END IF;
  UPDATE public.community_events SET agenda_notes = p_agenda_notes WHERE id = p_event_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_event_agenda(BIGINT, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.set_event_agenda(BIGINT, TEXT) FROM PUBLIC, anon;
