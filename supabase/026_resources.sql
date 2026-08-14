-- Hacking Hub Admin Dashboard - Resources (persisted, member-submitted)
-- Run this in the Supabase SQL Editor after 002-021 have already been applied.
-- Safe to re-run: every statement is idempotent.
--
-- The Resources tab was hardcoded local React state - 15 placeholder entries
-- with no real link behind any of them, plus 2 real ones (Cisco Junior
-- Cybersecurity Analyst, Immersive Labs Cyber Million) added afterward. Now a
-- real table members read from and can add to, same "member owns their own
-- submission" pattern as reviews/005_reviews.sql, events/019_events.sql,
-- cert_calendar/024_cert_calendar.sql, and job_board/025_job_board.sql: any
-- approved member can add a resource (self-attributed via created_by, with a
-- real link) and read every resource; only admins can edit/delete one that
-- isn't theirs. No moderation/approval step here, same as the cert calendar
-- and job board - member-submitted resources go live immediately.
--
-- Seeded with only the 2 real resources that already existed - the 15
-- placeholder entries (dead "Open Resource" links, never real content) are
-- deliberately not carried over.

CREATE TABLE IF NOT EXISTS public.resources (
  id BIGSERIAL PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('Cert Prep', 'Role Roadmaps', 'Podcasts', 'Books', 'Interview Playbooks', 'CV Templates')),
  title TEXT NOT NULL,
  format TEXT,
  description TEXT,
  link TEXT,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read resources" ON public.resources;
CREATE POLICY "members read resources"
  ON public.resources FOR SELECT
  TO authenticated
  USING (public.is_member_allowed(auth.jwt() ->> 'email'));

-- Self-service creation, same pattern as reviews/events/cert_calendar/job_board:
-- a member can only ever attribute a new resource to their own verified
-- sign-in email, never someone else's.
DROP POLICY IF EXISTS "members add resources" ON public.resources;
CREATE POLICY "members add resources"
  ON public.resources FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = lower(auth.jwt() ->> 'email')
    AND public.is_member_allowed(auth.jwt() ->> 'email')
  );

-- Admins manage everything directly (editing/removing any resource), same
-- is_admin() pattern as every other table.
DROP POLICY IF EXISTS "admins manage resources" ON public.resources;
CREATE POLICY "admins manage resources"
  ON public.resources FOR ALL
  USING (public.is_admin(auth.uid()));

-- Seed with only the 2 real resources that already existed.
INSERT INTO public.resources (id, category, title, format, description, link) VALUES
  (1, 'Cert Prep', 'Cisco Junior Cybersecurity Analyst Career Path', 'Course', 'Free Cisco Networking Academy course covering cybersecurity operations fundamentals, from networking basics through to SOC-analyst-level skills.', 'https://www.netacad.com/career-paths/cybersecurity?courseLang=en-US'),
  (2, 'Cert Prep', 'Immersive Labs — Cyber Million', 'Course', 'Free, hands-on cybersecurity skills platform for building foundational, job-ready skills through guided labs.', 'https://www.immersivelabs.com/resources/cybermillion')
ON CONFLICT (id) DO NOTHING;

-- Keep the auto-increment sequence ahead of the manually-seeded ids above, so
-- the first member-added resource gets id 3, not a collision with 1-2.
SELECT setval(pg_get_serial_sequence('public.resources', 'id'), 2, true);
