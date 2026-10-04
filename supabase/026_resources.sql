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
  category TEXT NOT NULL CHECK (category IN ('Cert Prep', 'Role Roadmaps', 'Podcasts', 'Books', 'Interview Playbooks', 'CV Templates', 'LinkedIn Strategy', 'Cyber Platforms', 'Soft Skills')),
  title TEXT NOT NULL,
  format TEXT,
  description TEXT,
  link TEXT,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Widens the category CHECK for a database where this table already existed
-- before 'LinkedIn Strategy'/'Cyber Platforms'/'Soft Skills' were added -
-- the inline CHECK above only takes effect on a fresh CREATE TABLE, not an
-- existing one.
ALTER TABLE public.resources DROP CONSTRAINT IF EXISTS resources_category_check;
ALTER TABLE public.resources ADD CONSTRAINT resources_category_check
  CHECK (category IN ('Cert Prep', 'Role Roadmaps', 'Podcasts', 'Books', 'Interview Playbooks', 'CV Templates', 'LinkedIn Strategy', 'Cyber Platforms', 'Soft Skills'));

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
  'Guide',
  'Real interview questions to write real answers to, two playlists to watch first, and questions to ask them back.',
  NULL,
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.resources WHERE title = 'HH Interview Playbook'
);

-- Moved from an external Google Doc link to real content hardcoded in-app
-- (InterviewPlaybookGuideModal.jsx, same move already made for the
-- LinkedIn Playbook/cert study guides/Podcasts/Soft Skills) - members no
-- longer need doc access shared with them individually, and the content
-- can't drift out of sync with what the doc actually says. Corrects a row
-- seeded by an earlier run of this file, before that move - the INSERT's
-- WHERE NOT EXISTS above only ever fires once, so a live database that
-- already has this row needs its own fix-up.
UPDATE public.resources
SET format = 'Guide',
    description = 'Real interview questions to write real answers to, two playlists to watch first, and questions to ask them back.',
    link = NULL
WHERE title = 'HH Interview Playbook' AND format = 'Doc';

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

-- CompTIA Security+ study guide - real content (official cert overview,
-- price, recommended study duration) hardcoded as an in-app article in
-- MemberPortal.jsx (SecurityPlusGuideModal.jsx). This row just catalogs
-- it in Resources with a short teaser; the "Read Guide" button opens the
-- real content in-app.
INSERT INTO public.resources (category, title, format, description, link, created_by)
SELECT
  'Cert Prep',
  'CompTIA Security+ Study Guide',
  'Guide',
  'A vendor-neutral entry point into cybersecurity - what it costs, how long to study, and the official CompTIA overview.',
  NULL,
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.resources WHERE title = 'CompTIA Security+ Study Guide'
);

-- CompTIA CySA+ study guide - real content (official cert overview,
-- price, recommended study duration) hardcoded as an in-app article in
-- MemberPortal.jsx (CySAPlusGuideModal.jsx). This row just catalogs it
-- in Resources with a short teaser; the "Read Guide" button opens the
-- real content in-app.
INSERT INTO public.resources (category, title, format, description, link, created_by)
SELECT
  'Cert Prep',
  'CompTIA CySA+ Study Guide',
  'Guide',
  'The intermediate step up from Security+ into proactive defensive operations - threat intelligence, log analysis, incident response. What it costs and how long to study.',
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

-- Free Microsoft certification vouchers for South Africans, via a YES
-- (Youth Employment Service) x Microsoft partnership - relevant because
-- it's a real, no-cost path to AZ-900 and SC-900 specifically, both on the
-- Elite Operative sponsorship list (see 028_roadmap.sql's Cloud Security /
-- IAM catalogs). Capped at 50,000 vouchers total, first-registered-first-
-- served, so this is worth surfacing over the paid Elite Operative
-- sponsorship route while it's still running.
INSERT INTO public.resources (category, title, format, description, link, created_by)
SELECT
  'Cert Prep',
  'YES x Microsoft AI Skills Initiative',
  'Course',
  'Free AZ-900 (Azure Fundamentals) and SC-900 (Security, Compliance & Identity Fundamentals) certification vouchers for South Africans - complete the free Microsoft Learn modules, pass the practice exam at 70%+, and claim your voucher. Also covers DP-900 and, at intermediate level, AZ-500. Limited to 50,000 vouchers total.',
  'https://yes-aiskills.co.za/',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.resources WHERE title = 'YES x Microsoft AI Skills Initiative'
);

-- REVISION (2026-09-13): the 2026.09.13 release notes/CHANGELOG both
-- promised "CISCO Cybersecurity Defense Analyst course added to Resources
-- and to the SOC Specialization track" - it landed in the SOC
-- Specialization catalog (SPECIALIZATION_CATALOGS.SOC in memberOptions.js)
-- the same day, but was never actually added *here*, in a migration file -
-- it only exists live because it was added by hand through the admin Add
-- Resource form (id 17, title 'Cisco Cybersecurity Defense Analyst' -
-- title-case, matching this file's own existing 'Cisco Junior
-- Cybersecurity Analyst Career Path' row rather than the all-caps 'CISCO'
-- used in memberOptions.js's roadmap catalog). Guarded on that exact
-- existing title so this is a no-op against the live database and only
-- ever fires on a fresh install rebuilt from these migrations alone.
INSERT INTO public.resources (category, title, format, description, link, created_by)
SELECT
  'Cert Prep',
  'Cisco Cybersecurity Defense Analyst',
  'Course',
  'Splunk-powered SOC detection & response career path from Cisco Networking Academy - the same course now on the SOC Specialization roadmap track.',
  'https://www.netacad.com/career-paths/splunk-cybersecurity-defense-analyst?courseLang=en-US',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.resources WHERE title = 'Cisco Cybersecurity Defense Analyst'
);

-- BreachLab - a free, persistent SSH server of real vulnerable Linux boxes
-- to root, no multiple-choice quizzes and no cert fee (an account is
-- optional, only for scoring/certificates) - same "Labs" format as
-- PortSwigger Web Security Academy above, for the same reason: hands-on
-- practice, not a course to work through.
INSERT INTO public.resources (category, title, format, description, link, created_by)
SELECT
  'Cyber Platforms',
  'BreachLab',
  'Labs',
  'Free, no-paywall SSH server of real vulnerable Linux boxes to root - no multiple-choice quizzes, no walkthroughs, no certification fee. 13 tracks, scored, with an "operatives" community rather than a customer base.',
  'https://breachlab.org/manifesto',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.resources WHERE title = 'BreachLab'
);

-- Blue Team Labs Online (BTLO) - a gamified, hands-on cyber range for
-- defenders specifically (SOC/blue team scenario challenges), the blue-
-- team counterpart to offense-focused practice platforms.
INSERT INTO public.resources (category, title, format, description, link, created_by)
SELECT
  'Cyber Platforms',
  'Blue Team Labs Online',
  'Labs',
  'A gamified cyber range for defenders - hands-on SOC/blue team scenario challenges (log analysis, digital forensics, malware analysis) to test and showcase real defensive skills.',
  'https://blueteamlabs.online/home/challenges',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.resources WHERE title = 'Blue Team Labs Online'
);

-- New "Cyber Platforms" group - the well-known, general-purpose hands-on
-- practice platforms every track eventually points to, gathered under
-- their own category instead of scattered across 'Cert Prep'. Immersive
-- Labs already had its own tile (id 2, seeded above under 'Cert Prep') -
-- moved here rather than re-inserted, so this doesn't create a duplicate.
-- TryHackMe, HackTheBox, and LetsDefend never had a Resources tile of
-- their own before (only referenced inside roadmap items/links), so
-- those are new inserts.
UPDATE public.resources SET category = 'Cyber Platforms' WHERE title = 'Immersive Labs — Cyber Million';

INSERT INTO public.resources (category, title, format, description, link, created_by)
SELECT
  'Cyber Platforms',
  'TryHackMe',
  'Labs',
  'Guided, browser-based hands-on cybersecurity labs - structured learning paths from networking fundamentals through advanced offensive and defensive security, no local setup required.',
  'https://tryhackme.com/',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.resources WHERE title = 'TryHackMe'
);

INSERT INTO public.resources (category, title, format, description, link, created_by)
SELECT
  'Cyber Platforms',
  'HackTheBox',
  'Labs',
  'Hands-on penetration testing platform - realistic vulnerable machines and challenges spanning beginner to advanced, for practicing real-world offensive security skills.',
  'https://www.hackthebox.com/',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.resources WHERE title = 'HackTheBox'
);

INSERT INTO public.resources (category, title, format, description, link, created_by)
SELECT
  'Cyber Platforms',
  'LetsDefend',
  'Labs',
  'Blue-team-focused SOC training platform - real SIEM alerts, phishing analysis, and incident response simulations for practicing actual defensive analyst work.',
  'https://letsdefend.io/',
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.resources WHERE title = 'LetsDefend'
);

-- New 'Soft Skills' category - real content (curated TED talks and
-- workplace-communication guides on communication, public speaking,
-- presence, feedback, and email/workplace etiquette) hardcoded as an
-- in-app article in MemberPortal.jsx (SoftSkillsGuideModal.jsx). This row
-- just catalogs it in Resources with a short teaser; the "Read Guide"
-- button opens the real content, with real clickable links, in-app - same
-- move already made for the Podcasts/LinkedIn Playbook/cert study guides.
INSERT INTO public.resources (category, title, format, description, link, created_by)
SELECT
  'Soft Skills',
  'Soft Skills Playlist',
  'Guide',
  'Technical skill gets you the interview - communication, presence, and workplace etiquette are what get you hired and promoted. A curated playlist on conversation, public speaking, feedback, and email/workplace etiquette.',
  NULL,
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM public.resources WHERE title = 'Soft Skills Playlist'
);

-- =========================================================================
-- STEPS + PER-MEMBER COMPLETION
-- =========================================================================
-- A resource can carry an ordered list of sub-tasks ("steps"), each with an
-- optional link of its own: [{"id":"lp1","title":"...","link":"https://..."}].
-- Members tick steps off, or mark the whole resource completed, and see their
-- own progress on the Resources tab. Step ids are short stable strings so a
-- later edit to a step's wording never orphans anyone's progress.
ALTER TABLE public.resources ADD COLUMN IF NOT EXISTS steps JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.resources DROP CONSTRAINT IF EXISTS resources_steps_check;
ALTER TABLE public.resources ADD CONSTRAINT resources_steps_check
  CHECK (jsonb_typeof(steps) = 'array' AND jsonb_array_length(steps) <= 20);

-- One row per thing a member has finished. step_id = '' is the resource as a
-- whole; anything else is one of its steps. Members can read their own rows
-- but never write them directly - set_my_resource_progress() below is the
-- only way in, so a step id that doesn't exist (or a resource they can't see)
-- can't be recorded, and "all steps done = resource done" can't drift.
CREATE TABLE IF NOT EXISTS public.resource_progress (
  member_email TEXT NOT NULL,
  resource_id BIGINT NOT NULL REFERENCES public.resources(id) ON DELETE CASCADE,
  step_id TEXT NOT NULL DEFAULT '',
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (member_email, resource_id, step_id)
);
CREATE INDEX IF NOT EXISTS idx_resource_progress_resource ON public.resource_progress(resource_id);

ALTER TABLE public.resource_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read own resource progress" ON public.resource_progress;
CREATE POLICY "members read own resource progress"
  ON public.resource_progress FOR SELECT
  TO authenticated
  USING (member_email = lower(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "admins manage resource progress" ON public.resource_progress;
CREATE POLICY "admins manage resource progress"
  ON public.resource_progress FOR ALL
  USING (public.is_admin(auth.uid()));

-- Marks a step (p_step_id) or the whole resource (p_step_id NULL/empty) done
-- or not done for the caller, and returns where that leaves them:
--   {"completed": bool, "done_steps": ["lp1", ...]}
-- Rules: completing the resource ticks every step; ticking the last step
-- completes the resource; un-ticking any step un-completes the resource;
-- un-completing the resource on its own leaves the steps as they were.
CREATE OR REPLACE FUNCTION public.set_my_resource_progress(p_resource_id BIGINT, p_step_id TEXT, p_done BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_steps JSONB;
  v_step_ids TEXT[];
  v_step TEXT := NULLIF(trim(COALESCE(p_step_id, '')), '');
  v_done_steps INTEGER;
BEGIN
  IF v_email IS NULL OR NOT public.is_member_allowed(v_email) THEN
    RAISE EXCEPTION 'Not allowed.';
  END IF;

  SELECT r.steps INTO v_steps FROM public.resources r WHERE r.id = p_resource_id;
  IF v_steps IS NULL THEN
    RAISE EXCEPTION 'Resource not found.';
  END IF;
  SELECT COALESCE(array_agg(s ->> 'id'), '{}'::text[]) INTO v_step_ids FROM jsonb_array_elements(v_steps) s;

  IF v_step IS NULL THEN
    IF p_done THEN
      INSERT INTO public.resource_progress (member_email, resource_id, step_id)
      SELECT v_email, p_resource_id, x FROM unnest(v_step_ids || ARRAY['']::text[]) x
      ON CONFLICT DO NOTHING;
    ELSE
      DELETE FROM public.resource_progress WHERE member_email = v_email AND resource_id = p_resource_id AND step_id = '';
    END IF;
  ELSE
    IF NOT (v_step = ANY(v_step_ids)) THEN
      RAISE EXCEPTION 'Unknown step.';
    END IF;
    IF p_done THEN
      INSERT INTO public.resource_progress (member_email, resource_id, step_id)
      VALUES (v_email, p_resource_id, v_step) ON CONFLICT DO NOTHING;
      SELECT count(*) INTO v_done_steps FROM public.resource_progress
      WHERE member_email = v_email AND resource_id = p_resource_id AND step_id = ANY(v_step_ids);
      IF v_done_steps >= cardinality(v_step_ids) THEN
        INSERT INTO public.resource_progress (member_email, resource_id, step_id)
        VALUES (v_email, p_resource_id, '') ON CONFLICT DO NOTHING;
      END IF;
    ELSE
      DELETE FROM public.resource_progress
      WHERE member_email = v_email AND resource_id = p_resource_id AND step_id IN (v_step, '');
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'completed', EXISTS (SELECT 1 FROM public.resource_progress WHERE member_email = v_email AND resource_id = p_resource_id AND step_id = ''),
    'done_steps', COALESCE((SELECT jsonb_agg(step_id ORDER BY step_id) FROM public.resource_progress WHERE member_email = v_email AND resource_id = p_resource_id AND step_id <> ''), '[]'::jsonb)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_my_resource_progress(BIGINT, TEXT, BOOLEAN) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.set_my_resource_progress(BIGINT, TEXT, BOOLEAN) FROM PUBLIC, anon;

-- =========================================================================
-- AZ-900 (Microsoft Azure Fundamentals) RESOURCES
-- =========================================================================
-- Every link below was opened and checked against Microsoft's own pages: the
-- three learning paths map one-to-one onto the exam's three skills-measured
-- domains (with the weightings from the current study guide, skills measured
-- as of July 20, 2026), and the study guide, free Practice Assessment, exam
-- sandbox and Exam Readiness Zone are all Microsoft-published. No third-party
-- video course is included on purpose - the popular ones pre-date the
-- July 2026 exam update. Seeded with WHERE NOT EXISTS + a converging UPDATE
-- (same pattern as the LinkedIn Playbook above) so editing the wording here
-- and re-running stays safe; step ids are fixed and never reused.

-- The in-app guide (AZ900GuideModal.jsx, same pattern as the SC-200 and
-- Security+ guides): price, study time, playlist, practice and Microsoft
-- Learn. This row just catalogs it with a teaser; "Read Guide" opens it.
INSERT INTO public.resources (category, title, format, description, link, created_by)
SELECT
  'Cert Prep',
  'AZ-900 Study Guide',
  'Guide',
  'What it costs (around R700), how long to study (1 to 4 weeks), and the resources members actually use - official certification page, a video playlist, free practice questions, and Microsoft Learn.',
  NULL,
  NULL
WHERE NOT EXISTS (SELECT 1 FROM public.resources WHERE title = 'AZ-900 Study Guide');

INSERT INTO public.resources (category, title, format, description, link, created_by)
SELECT
  'Cert Prep',
  'AZ-900: Microsoft Learn Learning Paths',
  'Course',
  'Microsoft''s own free, self-paced training for Azure Fundamentals - four short paths that cover the three exam domains and finish with hands-on guided projects. Work through them in order; each path is a few hours.',
  'https://learn.microsoft.com/en-us/credentials/certifications/azure-fundamentals/',
  NULL
WHERE NOT EXISTS (SELECT 1 FROM public.resources WHERE title = 'AZ-900: Microsoft Learn Learning Paths');

UPDATE public.resources
SET steps = '[
  {"id":"lp1","title":"Part 1: Describe cloud concepts (25-30% of the exam)","link":"https://learn.microsoft.com/en-us/training/paths/microsoft-azure-fundamentals-describe-cloud-concepts/"},
  {"id":"lp2","title":"Part 2: Describe Azure architecture and services (35-40%)","link":"https://learn.microsoft.com/en-us/training/paths/azure-fundamentals-describe-azure-architecture-services/"},
  {"id":"lp3","title":"Part 3: Describe Azure management and governance (30-35%)","link":"https://learn.microsoft.com/en-us/training/paths/describe-azure-management-governance/"},
  {"id":"lp4","title":"Part 4: Apply Azure skills in guided projects (hands-on)","link":"https://learn.microsoft.com/en-us/training/paths/introduction-cloud-infrastructure-apply-azure-skills-guided-projects/"}
]'::jsonb
WHERE title = 'AZ-900: Microsoft Learn Learning Paths';

INSERT INTO public.resources (category, title, format, description, link, created_by)
SELECT
  'Cert Prep',
  'AZ-900: Exam Prep Checklist',
  'Guide',
  'The exam-side of the plan: read what is actually measured, watch Microsoft''s exam-readiness videos, then test yourself with the free Practice Assessment and the exam sandbox before you book. A score of 700 or more passes.',
  'https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/az-900',
  NULL
WHERE NOT EXISTS (SELECT 1 FROM public.resources WHERE title = 'AZ-900: Exam Prep Checklist');

UPDATE public.resources
SET steps = '[
  {"id":"ep1","title":"Read the official study guide and its skills-measured outline","link":"https://learn.microsoft.com/en-us/credentials/certifications/resources/study-guides/az-900"},
  {"id":"ep2","title":"Watch the Exam Readiness Zone videos","link":"https://learn.microsoft.com/en-us/shows/exam-readiness-zone/"},
  {"id":"ep7","title":"Watch the recommended AZ-900 video playlist","link":"https://www.youtube.com/playlist?list=PLZCHR_fccEf8zN6UB8JOK2Y6l5DVqAcyc"},
  {"id":"ep3","title":"Take the free Practice Assessment and note your weak domains","link":"https://learn.microsoft.com/en-us/credentials/certifications/exams/az-900/practice/assessment?assessment-type=practice&assessmentId=23"},
  {"id":"ep4","title":"Revisit the learning-path modules for those weak domains","link":null},
  {"id":"ep5","title":"Retake the Practice Assessment until you are comfortably above 70%","link":null},
  {"id":"ep6","title":"Try the exam sandbox so the exam interface is familiar","link":"https://aka.ms/examdemo"}
]'::jsonb
WHERE title = 'AZ-900: Exam Prep Checklist';

INSERT INTO public.resources (category, title, format, description, link, created_by)
SELECT
  'Cert Prep',
  'AZ-900: Hands-on Azure Practice',
  'Labs',
  'Reading about Azure only goes so far - build a few small things in a free Azure account so the exam''s services and terms mean something. Delete what you create when you are done, and set a budget alert first so there are no surprise charges.',
  'https://azure.microsoft.com/pricing/purchase-options/azure-account',
  NULL
WHERE NOT EXISTS (SELECT 1 FROM public.resources WHERE title = 'AZ-900: Hands-on Azure Practice');

UPDATE public.resources
SET steps = '[
  {"id":"hp1","title":"Create a free Azure account","link":"https://azure.microsoft.com/pricing/purchase-options/azure-account"},
  {"id":"hp2","title":"Set a budget alert in Cost Management so you never overspend","link":null},
  {"id":"hp3","title":"Create a resource group and add a tag to it","link":null},
  {"id":"hp4","title":"Create a storage account and upload a file","link":null},
  {"id":"hp5","title":"Deploy a small virtual machine, then look at its networking","link":null},
  {"id":"hp6","title":"Open Azure Monitor and Advisor and see what they report","link":null},
  {"id":"hp7","title":"Delete the resource group to clean everything up","link":null}
]'::jsonb
WHERE title = 'AZ-900: Hands-on Azure Practice';

-- Microsoft's official free lab exercises for AZ-900, published from
-- github.com/MicrosoftLearning/AZ-900-Microsoft-Azure-Fundamentals (the five
-- exercises under Instructions/Labs, each checked to have a live published
-- page). NOTE: Microsoft retired the free Learn sandboxes (their own FAQ:
-- "Sandboxes are no longer available"), so every hands-on exercise now needs
-- an Azure subscription - the free 30-day trial counts. Said plainly in the
-- descriptions so nobody expects a no-signup lab.
INSERT INTO public.resources (category, title, format, description, link, created_by)
SELECT
  'Cert Prep',
  'AZ-900: Official Microsoft Labs',
  'Labs',
  'The five lab exercises Microsoft publishes for AZ-900 - 15 to 20 minutes each. Microsoft has retired its free Learn sandboxes, so these need an Azure subscription (the free 30-day trial works). Delete what you create afterwards.',
  'https://microsoftlearning.github.io/AZ-900-Microsoft-Azure-Fundamentals/',
  NULL
WHERE NOT EXISTS (SELECT 1 FROM public.resources WHERE title = 'AZ-900: Official Microsoft Labs');

UPDATE public.resources
SET steps = '[
  {"id":"ol1","title":"Create an Azure resource (15 min) - watch a resource group fill up","link":"https://microsoftlearning.github.io/AZ-900-Microsoft-Azure-Fundamentals/Instructions/Labs/02-exercise-create-azure-resource.html"},
  {"id":"ol2","title":"Create a virtual machine and configure it as a web host (20 min)","link":"https://microsoftlearning.github.io/AZ-900-Microsoft-Azure-Fundamentals/Instructions/Labs/03-exercise-create-azure-virtual-machine.html"},
  {"id":"ol3","title":"Create a storage blob and share a file (15 min)","link":"https://microsoftlearning.github.io/AZ-900-Microsoft-Azure-Fundamentals/Instructions/Labs/05-exercise-create-storage-blob.html"},
  {"id":"ol4","title":"Estimate workload costs with the Pricing calculator (15 min)","link":"https://microsoftlearning.github.io/AZ-900-Microsoft-Azure-Fundamentals/Instructions/Labs/06-exercise-estimate-workload-costs-use-pricing-calculator.html"},
  {"id":"ol5","title":"Configure resource locks (15 min)","link":"https://microsoftlearning.github.io/AZ-900-Microsoft-Azure-Fundamentals/Instructions/Labs/08-exercise-configure-resource-lock.html"}
]'::jsonb
WHERE title = 'AZ-900: Official Microsoft Labs';

-- The eight step-by-step guided projects from Microsoft Learn (Part 4 of the
-- Introduction to Cloud Infrastructure series). Optional - Microsoft says
-- "complete as many or as few as you like" - but they are the closest thing
-- to real portfolio-style practice for the exam topics.
INSERT INTO public.resources (category, title, format, description, link, created_by)
SELECT
  'Cert Prep',
  'AZ-900: Microsoft Guided Projects',
  'Labs',
  'Eight end-to-end guided projects from Microsoft Learn - host a static site, apply tags and locks, set up least-privilege access, share files securely, add cost guardrails, monitor service health, and more. Pick as many as you like; they need an Azure subscription (the free 30-day trial works).',
  'https://learn.microsoft.com/en-us/training/paths/introduction-cloud-infrastructure-apply-azure-skills-guided-projects/',
  NULL
WHERE NOT EXISTS (SELECT 1 FROM public.resources WHERE title = 'AZ-900: Microsoft Guided Projects');

UPDATE public.resources
SET steps = '[
  {"id":"gp1","title":"Deploy a static website with Azure Blob Storage","link":"https://learn.microsoft.com/en-us/training/modules/guided-project-deploy-static-website-blob-storage/"},
  {"id":"gp2","title":"Organize and protect resources with tags and locks","link":"https://learn.microsoft.com/en-us/training/modules/guided-project-organize-resources-tags-locks/"},
  {"id":"gp3","title":"Build a simple website endpoint with Azure Functions","link":"https://learn.microsoft.com/en-us/training/modules/guided-project-build-basic-website-endpoint-with-functions/"},
  {"id":"gp4","title":"Set up new employee access (Entra ID and RBAC)","link":"https://learn.microsoft.com/en-us/training/modules/guided-project-new-employee-access/"},
  {"id":"gp5","title":"Share files securely (SAS tokens and access policies)","link":"https://learn.microsoft.com/en-us/training/modules/guided-project-share-files-securely/"},
  {"id":"gp6","title":"Set up cost guardrails in Azure","link":"https://learn.microsoft.com/en-us/training/modules/guided-project-cost-guardrails/"},
  {"id":"gp7","title":"Monitor Azure with Service Health and Activity Log alerts","link":"https://learn.microsoft.com/en-us/training/modules/guided-project-monitor-service-health-activity-alerts/"},
  {"id":"gp8","title":"Manage Azure resources with Cloud Shell and the Azure CLI","link":"https://learn.microsoft.com/en-us/training/modules/guided-project-manage-resources-cloud-shell-cli/"}
]'::jsonb
WHERE title = 'AZ-900: Microsoft Guided Projects';

-- The Hands-on card's own text should be upfront about the same thing.
UPDATE public.resources
SET description = 'Reading about Azure only goes so far - build a few small things in your own Azure account so the exam''s services and terms mean something. Microsoft has retired its free Learn sandboxes, so use the free 30-day trial. Set a budget alert first so there are no surprise charges, and delete what you create when you are done.'
WHERE title = 'AZ-900: Hands-on Azure Practice';

-- The existing YES x Microsoft card (above) already describes the voucher
-- route in its text; give it the same steps so a member can track it.
UPDATE public.resources
SET steps = '[
  {"id":"yes1","title":"Register on the YES AI Skills site","link":"https://yes-aiskills.co.za/"},
  {"id":"yes2","title":"Complete the free Microsoft Learn modules","link":null},
  {"id":"yes3","title":"Pass the practice exam at 70% or more","link":null},
  {"id":"yes4","title":"Claim your free certification voucher","link":null},
  {"id":"yes5","title":"Book and sit your exam","link":null}
]'::jsonb
WHERE title = 'YES x Microsoft AI Skills Initiative';
