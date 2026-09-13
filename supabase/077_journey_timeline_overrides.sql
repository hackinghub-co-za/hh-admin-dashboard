-- Hacking Hub Admin Dashboard - My Journey Timeline Date Overrides
-- Run this in the Supabase SQL Editor after 002-076 have already been
-- applied. Safe to re-run: every statement is idempotent.
--
-- "My Journey So Far" (MemberPortal.jsx's computeJourneyStory) is a
-- read-only storyline synthesized entirely from real records elsewhere
-- (member_profiles.start_date, roadmap_items.updated_at, daily_room_logs,
-- community_events RSVPs) - a member has never been able to touch any of
-- the dates it shows. Some of those source dates are only approximations
-- of the moment they'd actually pick (a cert's updated_at is just "the
-- last time that row changed," not a real "completed on" date; a member
-- who logged a cert weeks after actually passing it gets the wrong date
-- in their own story).
--
-- Rather than let a member rewrite the real underlying record (which
-- would also feed tenure math, competition eligibility windows, and
-- other real business logic that must stay accurate), this is a
-- narrow, purely cosmetic override layer: one optional date per
-- timeline entry, keyed by a stable entry_key the client already knows
-- how to build from that entry's real data. The real records (and
-- everything else that reads them) are completely untouched - this
-- table only changes what a member sees printed on their own story.
--
-- entry_key shapes the client builds and matches against:
--   'joined'                     - the single "Joined Hacking Hub" entry
--   'cert:<roadmap_items.id>'    - one entry per completed cert
--   'rooms:<YYYY-MM>'            - one entry per month of approved room logs
--   'event:<community_events.id>' - one entry per RSVP'd event
CREATE TABLE IF NOT EXISTS public.journey_timeline_overrides (
  id BIGSERIAL PRIMARY KEY,
  member_email TEXT NOT NULL,
  entry_key TEXT NOT NULL,
  override_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (member_email, entry_key)
);

CREATE INDEX IF NOT EXISTS idx_journey_timeline_overrides_member ON public.journey_timeline_overrides(member_email);

ALTER TABLE public.journey_timeline_overrides ENABLE ROW LEVEL SECURITY;

-- Same "member reads/writes only their own rows" shape as
-- job_applications (075_job_application_tracker.sql) - purely personal,
-- cosmetic data, no admin verification needed.
DROP POLICY IF EXISTS "members manage own journey overrides" ON public.journey_timeline_overrides;
CREATE POLICY "members manage own journey overrides"
  ON public.journey_timeline_overrides FOR ALL
  USING (member_email = lower(auth.jwt() ->> 'email'))
  WITH CHECK (member_email = lower(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "admins manage journey overrides" ON public.journey_timeline_overrides;
CREATE POLICY "admins manage journey overrides"
  ON public.journey_timeline_overrides FOR ALL
  USING (public.is_admin(auth.uid()));
