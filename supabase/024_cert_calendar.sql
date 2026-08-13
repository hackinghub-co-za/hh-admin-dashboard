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

CREATE TABLE IF NOT EXISTS public.cert_calendar (
  id BIGSERIAL PRIMARY KEY,
  member TEXT NOT NULL,
  cert_name TEXT NOT NULL,
  date DATE NOT NULL,
  cohort TEXT,
  result TEXT NOT NULL DEFAULT 'Pending' CHECK (result IN ('Pending', 'Passed', 'Failed')),
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.cert_calendar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read cert calendar" ON public.cert_calendar;
CREATE POLICY "members read cert calendar"
  ON public.cert_calendar FOR SELECT
  TO authenticated
  USING (public.is_member_allowed(auth.jwt() ->> 'email'));

-- Self-service creation, same pattern as reviews/events: a member can only
-- ever attribute a new entry to their own verified sign-in email, and result
-- always starts Pending regardless of what the client sends.
DROP POLICY IF EXISTS "members add cert calendar entries" ON public.cert_calendar;
CREATE POLICY "members add cert calendar entries"
  ON public.cert_calendar FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = lower(auth.jwt() ->> 'email')
    AND public.is_member_allowed(auth.jwt() ->> 'email')
    AND result = 'Pending'
  );

-- Admins manage everything directly (editing/removing any entry, updating
-- pass/fail results), same is_admin() pattern as every other table.
DROP POLICY IF EXISTS "admins manage cert calendar" ON public.cert_calendar;
CREATE POLICY "admins manage cert calendar"
  ON public.cert_calendar FOR ALL
  USING (public.is_admin(auth.uid()));

-- Seed with the entries that were previously hardcoded (reconciled - the
-- admin and member arrays had drifted to slightly different lists), plus the
-- two new real target dates.
INSERT INTO public.cert_calendar (id, member, cert_name, date, cohort, result) VALUES
  (1, 'Sanele Khumalo', 'OSCP Penetration Tester', '2026-09-12', 'OSCP-26B', 'Pending'),
  (2, 'Nonhlanhla Sindane', 'CompTIA Security+', '2026-08-28', 'SecPlus-Aug', 'Pending'),
  (3, 'Khody Netshifhefhe', 'eLearnSecurity eCPPT', '2026-10-05', 'eCPPT-Intro', 'Pending'),
  (4, 'Joshua Harrop', 'Microsoft Azure Security (AZ-500)', '2026-09-01', 'Azure-Q3', 'Pending'),
  (5, 'Thando Mandondo', 'CompTIA Network+', '2026-09-20', 'NetPlus-Q3', 'Pending'),
  (6, 'Thabo Ndlovu', 'OSCP Penetration Tester', '2026-08-02', 'OSCP-26A', 'Passed'),
  (7, 'Palesa Dlamini', 'CompTIA Security+', '2026-07-15', 'SecPlus-Jul', 'Passed'),
  (8, 'Siya', 'KCSA (Kubernetes and Cloud Native Security Associate)', '2026-09-17', 'General', 'Pending'),
  (9, 'Siya', 'Microsoft Security Operations Analyst (SC-500)', '2026-08-20', 'General', 'Pending')
ON CONFLICT (id) DO NOTHING;

-- Keep the auto-increment sequence ahead of the manually-seeded ids above, so
-- the first member-added entry gets id 10, not a collision with 1-9.
SELECT setval(pg_get_serial_sequence('public.cert_calendar', 'id'), 9, true);
