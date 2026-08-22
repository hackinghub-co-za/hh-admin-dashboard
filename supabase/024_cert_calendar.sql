-- Hacking Hub Admin Dashboard - Cert Calendar (persisted, member-submitted)
-- Run this in the Supabase SQL Editor after 002-021 have already been applied.
-- Safe to re-run: every statement is idempotent, in case an earlier partial
-- run left the database in a mixed state.
--
-- The Cert Calendar (target exam dates + countdowns) was hardcoded local
-- React state on both the admin and member side - two separate arrays that
-- had already drifted out of sync with each other, reset on every page
-- reload, and had no way for a member to add their own target exam date. Now
-- a real table both sides read from, same "member owns their own submission"
-- pattern as reviews/005_reviews.sql and events/019_events.sql: any approved
-- member can add an entry (self-attributed via created_by) and read every
-- entry; only admins can edit/delete one that isn't theirs, or update the
-- pass/fail result. No moderation/approval step here, unlike community
-- events - member-submitted cert entries go live immediately.
--
-- Seeded rows use explicit ids (rather than leaving id to the SERIAL default)
-- so the ON CONFLICT (id) DO NOTHING seed insert below is itself idempotent,
-- same pattern as the seeded rows in 019_events.sql.
--
-- member_email was added later: `member` is a free-text name, which made
-- Insights' "time to first cert" stat only able to match members by name -
-- approximate, and it undercounts anyone whose name is formatted
-- differently between the two tables. A member's own self-submitted entry
-- now records their real email automatically (enforced below, same as
-- created_by); admins get an optional member_email field for entries added
-- on someone else's behalf, since that's exactly the case where created_by
-- can't be trusted to identify the certified member.

CREATE TABLE IF NOT EXISTS public.cert_calendar (
  id BIGSERIAL PRIMARY KEY,
  member TEXT NOT NULL,
  cert_name TEXT NOT NULL,
  date DATE NOT NULL,
  cohort TEXT,
  result TEXT NOT NULL DEFAULT 'Pending' CHECK (result IN ('Pending', 'Passed', 'Failed')),
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  member_email TEXT
);

ALTER TABLE public.cert_calendar
  ADD COLUMN IF NOT EXISTS member_email TEXT;

ALTER TABLE public.cert_calendar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read cert calendar" ON public.cert_calendar;
CREATE POLICY "members read cert calendar"
  ON public.cert_calendar FOR SELECT
  TO authenticated
  USING (public.is_member_allowed(auth.jwt() ->> 'email'));

-- Self-service creation, same pattern as reviews/events: a member can only
-- ever attribute a new entry to their own verified sign-in email (both as
-- created_by and as member_email - always the same person for a
-- self-submission), and result always starts Pending regardless of what the
-- client sends. Admins bypass this policy entirely via their own broader
-- FOR ALL policy below, so an admin adding/editing an entry on someone
-- else's behalf is free to set member_email to a different real member.
DROP POLICY IF EXISTS "members add cert calendar entries" ON public.cert_calendar;
CREATE POLICY "members add cert calendar entries"
  ON public.cert_calendar FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = lower(auth.jwt() ->> 'email')
    AND member_email = lower(auth.jwt() ->> 'email')
    AND public.is_member_allowed(auth.jwt() ->> 'email')
    AND result = 'Pending'
  );

-- Admins manage everything directly (editing/removing any entry, updating
-- pass/fail results), same is_admin() pattern as every other table.
DROP POLICY IF EXISTS "admins manage cert calendar" ON public.cert_calendar;
CREATE POLICY "admins manage cert calendar"
  ON public.cert_calendar FOR ALL
  USING (public.is_admin(auth.uid()));

-- Seed with only the real target dates - ids 1-7 below were placeholder
-- entries (reconciled from two hardcoded arrays that predated this table),
-- never real member exam dates.
INSERT INTO public.cert_calendar (id, member, cert_name, date, cohort, result, member_email) VALUES
  (8, 'Siya', 'KCSA (Kubernetes and Cloud Native Security Associate)', '2026-09-17', 'General', 'Pending', 'siya@hackinghub.co.za'),
  (9, 'Siya', 'Microsoft Security Operations Analyst (SC-500)', '2026-08-20', 'General', 'Pending', 'siya@hackinghub.co.za')
ON CONFLICT (id) DO NOTHING;

-- member_email backfill for a database where this file already ran before
-- the column existed: any row with created_by set gets member_email copied
-- from it - a real member's own past self-submission is reliably their own
-- email. Rows with no created_by (admin-seeded, e.g. ids 8/9 above on an
-- older run) are left NULL rather than guessed at, except ids 8/9
-- themselves, which are explicitly known to be Siya's.
UPDATE public.cert_calendar
  SET member_email = created_by
  WHERE member_email IS NULL AND created_by IS NOT NULL;

UPDATE public.cert_calendar
  SET member_email = 'siya@hackinghub.co.za'
  WHERE id IN (8, 9) AND member_email IS NULL;

-- Removes the placeholder rows (ids 1-7) if an earlier run of this file ever
-- seeded them - naturally idempotent, a second run just deletes zero rows.
DELETE FROM public.cert_calendar WHERE id IN (1, 2, 3, 4, 5, 6, 7);

-- Keep the auto-increment sequence ahead of the manually-seeded ids above, so
-- the first member-added entry gets id 10, not a collision with 1-9.
SELECT setval(pg_get_serial_sequence('public.cert_calendar', 'id'), 9, true);
