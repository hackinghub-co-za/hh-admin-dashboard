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
-- (PocketPrep has since gotten a real link and its own card further down;
-- Open-exam-prep hasn't, so it's still only mentioned this way)
-- inside the overview entry's description instead of getting their own card.

CREATE TABLE IF NOT EXISTS public.resources (
  id BIGSERIAL PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('Cert Prep', 'Role Roadmaps', 'Podcasts', 'Books', 'Interview Playbooks', 'CV Templates', 'LinkedIn Strategy')),
  title TEXT NOT NULL,
  format TEXT,
  description TEXT,
  link TEXT,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Widens the category CHECK for a database where this table already existed
-- before 'LinkedIn Strategy' was added - the inline CHECK above only takes
-- effect on a fresh CREATE TABLE, not an existing one.
ALTER TABLE public.resources DROP CONSTRAINT IF EXISTS resources_category_check;
ALTER TABLE public.resources ADD CONSTRAINT resources_category_check
  CHECK (category IN ('Cert Prep', 'Role Roadmaps', 'Podcasts', 'Books', 'Interview Playbooks', 'CV Templates', 'LinkedIn Strategy'));

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

-- The 3 separate Security+ cards below (official overview, Professor
-- Messer's course, ExamCompass practice tests) were consolidated into one
-- in-app guide, same move as the LinkedIn Playbook - one place with all 3
-- real links instead of 3 separate cards to click through. Removed here so a
-- database that already ran the old inserts doesn't end up with both.
DELETE FROM public.resources WHERE title IN (
  'CompTIA Security+',
  'Professor Messer — Security+ Video Course',
  'ExamCompass — Security+ Practice Tests'
);

-- Content (official overview, video course, and practice test links) is
-- hardcoded as an in-app article in MemberPortal.jsx
-- (SecurityPlusGuideModal.jsx), same pattern as the LinkedIn Playbook - this
-- row just catalogs it in Resources with a short teaser; the "Read Guide"
-- button opens the real content, with real clickable links, in-app.
INSERT INTO public.resources (category, title, format, description, link, created_by)
SELECT
  'Cert Prep',
  'CompTIA Security+ Study Guide',
  'Guide',
  'What it costs, how long to study, and every free resource members actually use - official overview, Professor Messer''s full video course, ExamCompass practice tests, and PocketPrep.',
  NULL,
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.resources WHERE title = 'CompTIA Security+ Study Guide'
);

-- Same move again for CySA+ - real content (official overview, Jason
-- Dion's course, a free YouTube alternative, OpenExamPrep, PocketPrep)
-- hardcoded as an in-app article in MemberPortal.jsx
-- (CySAPlusGuideModal.jsx). This row just catalogs it in Resources with a
-- short teaser; the "Read Guide" button opens the real content, with real
-- clickable links, in-app.
INSERT INTO public.resources (category, title, format, description, link, created_by)
SELECT
  'Cert Prep',
  'CompTIA CySA+ Study Guide',
  'Guide',
  'What it costs, how long to study, and every free resource members actually use - official overview, Jason Dion''s full course, a free YouTube alternative, OpenExamPrep, and PocketPrep.',
  NULL,
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.resources WHERE title = 'CompTIA CySA+ Study Guide'
);

-- Same move again for Terraform Associate - real content (official cert
-- page, KodeKloud's paid course, HashiCorp's own free tutorials) hardcoded
-- as an in-app article in MemberPortal.jsx
-- (TerraformAssociateGuideModal.jsx). This row just catalogs it in
-- Resources with a short teaser; the "Read Guide" button opens the real
-- content, with real clickable links, in-app.
INSERT INTO public.resources (category, title, format, description, link, created_by)
SELECT
  'Cert Prep',
  'Terraform Associate Study Guide',
  'Guide',
  'What it costs, how long to study, and every resource members actually use - official cert page, KodeKloud''s paid course, and HashiCorp''s own free tutorials.',
  NULL,
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.resources WHERE title = 'Terraform Associate Study Guide'
);

-- Same move again for SC-200 - real content (official cert page,
-- OpenExamPrep, Microsoft Learn's own training, KC7 for KQL practice)
-- hardcoded as an in-app article in MemberPortal.jsx (SC200GuideModal.jsx).
-- This row just catalogs it in Resources with a short teaser; the "Read
-- Guide" button opens the real content, with real clickable links, in-app.
INSERT INTO public.resources (category, title, format, description, link, created_by)
SELECT
  'Cert Prep',
  'SC-200 Study Guide',
  'Guide',
  'What it costs, how long to study, and every resource members actually use - official cert page, OpenExamPrep, Microsoft Learn, and KC7 for KQL practice.',
  NULL,
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.resources WHERE title = 'SC-200 Study Guide'
);

-- Same move again for the Podcasts category's recommendation list - real
-- content (why podcasts, the LinkedIn takeaway ask, CyberWire Daily, The
-- Secure Developer) hardcoded as an in-app article in MemberPortal.jsx
-- (PodcastsGuideModal.jsx). This row just catalogs it in Resources with a
-- short teaser; the "Read Guide" button opens the real content, with real
-- clickable Spotify links, in-app.
INSERT INTO public.resources (category, title, format, description, link, created_by)
SELECT
  'Podcasts',
  'Recommended Podcasts',
  'Guide',
  'An easy way to digest what''s happening in the cyber industry - listen on a commute or as background noise. CyberWire Daily and The Secure Developer.',
  NULL,
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.resources WHERE title = 'Recommended Podcasts'
);

-- Unlike every other link-less entry above, this one isn't a name with no
-- link to give it - it's an original guide with real content, so a
-- "Coming Soon" disabled button would misrepresent it as unfinished. The
-- full guide is hardcoded as an in-app article in MemberPortal.jsx
-- (LINKEDIN_PLAYBOOK_SECTIONS) rather than a Google Doc link like the HH
-- Interview Playbook above - this row just catalogs it in Resources with a
-- short teaser; the "Read Guide" button opens the real content in-app.
INSERT INTO public.resources (category, title, format, description, link, created_by)
SELECT
  'LinkedIn Strategy',
  'The Hacking Hub LinkedIn Playbook',
  'Guide',
  'Photo, banner, headline, About section, posting cadence, and what to avoid, plus a 4-week posting rotation tailored to your specialty (SOC, Offensive Security, Cloud, and more) - everything for a LinkedIn profile that actually gets you noticed.',
  NULL,
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.resources WHERE title = 'The Hacking Hub LinkedIn Playbook'
);

-- The WHERE NOT EXISTS above only fires on a fresh install - this guide's
-- description grew a second half (the domain-tailored weekly rotation)
-- after the row already existed on any install that ran this file before,
-- so keep the description itself in sync the same idempotent way every
-- other evolving value in this schema is: an UPDATE that always converges
-- to the current text, safe to re-run indefinitely.
UPDATE public.resources
SET description = 'Photo, banner, headline, About section, posting cadence, and what to avoid, plus a 4-week posting rotation tailored to your specialty (SOC, Offensive Security, Cloud, and more) - everything for a LinkedIn profile that actually gets you noticed.'
WHERE title = 'The Hacking Hub LinkedIn Playbook';

INSERT INTO public.resources (category, title, format, description, link, created_by)
SELECT
  'Cert Prep',
  'PocketPrep',
  'App',
  'Mobile and web app for studying popular ISC2, CompTIA, and Cisco exams.',
  'https://study.pocketprep.com/study',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.resources WHERE title = 'PocketPrep'
);

-- KodeKloud was already the linked course provider inside
-- TerraformAssociateGuideModal.jsx, but never had its own card explaining
-- what the platform actually is - worth one now that KCNA/KCSA (both on the
-- DevSecOps track) make it relevant beyond just Terraform. Same move as the
-- other in-app guides: real content (KodeKloudGuideModal.jsx) hardcoded in
-- MemberPortal.jsx, this row just catalogs it in Resources with a teaser.
INSERT INTO public.resources (category, title, format, description, link, created_by)
SELECT
  'Cert Prep',
  'KodeKloud',
  'Guide',
  'What KodeKloud actually is, and which of its hands-on courses are relevant to your roadmap - Terraform Associate, plus Kubernetes fundamentals (KCNA/KCSA).',
  NULL,
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.resources WHERE title = 'KodeKloud'
);
