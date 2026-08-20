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
--
-- PortSwigger Web Security Academy and the HH Interview Playbook were added
-- later, consolidated in here rather than left in a separate
-- 036_more_resources.sql. Unlike the first 2, they're seeded without explicit
-- ids and guarded by title instead of ON CONFLICT (id) - the Resources tab
-- has had a live "Add Resource" button since this file first shipped, so a
-- real member may already have a submission sitting at id 3+, and hardcoding
-- an id here could collide with it.
--
-- CompTIA Security+ prep (official overview, Professor Messer's free video
-- course, and ExamCompass practice tests) was added the same way. Two other
-- resources were named (Open-exam-prep, PocketPrep) but no link was ever
-- given for them, and a resource card with no link renders as a disabled
-- "Coming Soon" button - so rather than publish a broken-looking card for
-- content that's actually available, they're just named as further reading
-- inside the overview entry's description instead of getting their own card.

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
-- the first member-added resource gets id 3, not a collision with 1-2. Uses
-- GREATEST against the table's real current max id, not a bare 2 - a bare
-- value here would rewind the sequence backward on a re-run after real
-- members have already added resources past id 2, causing the next
-- id-less INSERT below to collide with one of their rows.
SELECT setval(
  pg_get_serial_sequence('public.resources', 'id'),
  GREATEST(2, (SELECT COALESCE(MAX(id), 0) FROM public.resources)),
  true
);

INSERT INTO public.resources (category, title, format, description, link, created_by)
SELECT
  'Cert Prep',
  'PortSwigger Web Security Academy',
  'Labs',
  'Free, hands-on web security training from the makers of Burp Suite - hundreds of interactive labs covering web app vulnerabilities from XSS through request smuggling.',
  'https://portswigger.net/web-security',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.resources WHERE title = 'PortSwigger Web Security Academy'
);

INSERT INTO public.resources (category, title, format, description, link, created_by)
SELECT
  'Interview Playbooks',
  'HH Interview Playbook',
  'Doc',
  'Hacking Hub''s own interview prep playbook.',
  'https://docs.google.com/document/d/1mqgfhSXH1U8NVwzBs4yVen9eBTHrFcflu9N9kWuvSJI/edit?tab=t.0',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.resources WHERE title = 'HH Interview Playbook'
);

INSERT INTO public.resources (category, title, format, description, link, created_by)
SELECT
  'Cert Prep',
  'CompTIA Security+',
  'Certification',
  'A highly recognized, vendor-neutral certification for starting a career in cybersecurity - covers core security principles, concepts, and best practices without tying you to one specific technology or platform. Price: R5,412. Recommended study duration: 4 to 12 weeks. Members have also used Open-exam-prep and PocketPrep for extra practice questions.',
  'https://www.comptia.org/en-us/certifications/security/#overview',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.resources WHERE title = 'CompTIA Security+'
);

INSERT INTO public.resources (category, title, format, description, link, created_by)
SELECT
  'Cert Prep',
  'Professor Messer — Security+ Video Course',
  'Video Playlist',
  'Free, full-length CompTIA Security+ video course covering every exam objective, taught by Professor Messer.',
  'https://www.youtube.com/playlist?list=PLG49S3nxzAnl4QDVqK-hOnoqcSKEIDDuv',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.resources WHERE title = 'Professor Messer — Security+ Video Course'
);

INSERT INTO public.resources (category, title, format, description, link, created_by)
SELECT
  'Cert Prep',
  'ExamCompass — Security+ Practice Tests',
  'Practice Test',
  'Free Security+ practice tests to check exam readiness before booking the real thing.',
  'https://www.examcompass.com/comptia/security-plus-certification/free-security-plus-practice-tests',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.resources WHERE title = 'ExamCompass — Security+ Practice Tests'
);
