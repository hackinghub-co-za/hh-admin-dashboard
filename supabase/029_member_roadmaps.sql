-- Hacking Hub Admin Dashboard - Member Roadmaps (batch import)
-- Run this in the Supabase SQL Editor after 028_roadmap.sql has been applied.
-- Safe to re-run: see the idempotency note below - it's a bit different from
-- most migrations in this project because of the standard-catalog retrofit.
--
-- One running file for roadmaps handed over as real, individually-written
-- coaching docs (Google Docs, pasted in one at a time) - NOT a new migration
-- per person going forward. Every future member's roadmap should be entered
-- directly through the Roadmaps admin tab (it's built for exactly this);
-- this file exists only to bulk-seed the ones that already existed as docs
-- before that tab did, appending one block per member as each doc comes in.
--
-- Every assigned roadmap's Core Foundations phase now draws its
-- Certifications from one standard 8-item catalog (CORE_FOUNDATIONS_CATALOG
-- in src/lib/memberOptions.js) - a member needs at least 4 of the 8 done.
-- Whatever a member's doc originally listed under Core Foundations
-- Certifications that ISN'T one of these 8 (e.g. a THM room-count goal, a
-- second SOC/CySA+ cert) has been dropped from Certifications - real
-- progress on the 8 that do match is preserved. This was a deliberate,
-- explicitly confirmed retrofit, not an oversight: existing per-member
-- variation gave way to one consistent baseline. Networking/Other/
-- Specialization items are untouched.
--
-- Idempotency: each person's Core Foundations Certifications rows are
-- unconditionally replaced (DELETE then INSERT) every time this file runs,
-- so re-running it re-applies the standard catalog even if an earlier
-- version of this file already ran. Their Networking/Other/Specialization
-- rows are only inserted the first time (guarded on whether any row OTHER
-- than Core Foundations Certifications already exists for that member), so
-- a re-run never duplicates those.

-- [REDACTED] ([REDACTED]) - Offensive Security track, Pen Testing
-- specialization.
UPDATE public.member_profiles SET roadmap_track = 'Offensive Security' WHERE email = '[REDACTED]';

DELETE FROM public.roadmap_items WHERE member_email = '[REDACTED]' AND phase = 'Core Foundations' AND category = 'Certifications';
INSERT INTO public.roadmap_items (member_email, phase, category, title, detail, completed, sort_order) VALUES
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'CISCO Junior Cyber Pathway', '0/6 courses', false, 10),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'Immersive Labs', '0/20 collections', false, 20),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'TryHackMe Pre-Security', '87% complete', false, 30),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'TryHackMe Cyber 101', '47% complete · by end of August', false, 40),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'AZ-900', '', false, 50),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'AI-901', '', false, 60),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'SC-900', '', false, 70),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'CompTIA Security+', 'by end of September', false, 80);

-- Offensive Security's standard Specialization catalog (SPECIALIZATION_CATALOGS
-- in src/lib/memberOptions.js), same unconditional-replace idempotency as
-- Core Foundations Certifications above.
DELETE FROM public.roadmap_items WHERE member_email = '[REDACTED]' AND phase = 'Specialization' AND category = 'Pen Testing';
INSERT INTO public.roadmap_items (member_email, phase, category, title, detail, completed, sort_order) VALUES
  ('[REDACTED]', 'Specialization', 'Pen Testing', 'eJPT', '', false, 10),
  ('[REDACTED]', 'Specialization', 'Pen Testing', 'THM Junior Pentester', '% complete not yet tracked', false, 20),
  ('[REDACTED]', 'Specialization', 'Pen Testing', 'THM Offensive Pentesting', '% complete not yet tracked', false, 30),
  ('[REDACTED]', 'Specialization', 'Pen Testing', 'Burp Suite Certified Practitioner', '', false, 40),
  ('[REDACTED]', 'Specialization', 'Pen Testing', 'OSCP', '', false, 50);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.roadmap_items
    WHERE member_email = '[REDACTED]'
      AND NOT (phase = 'Core Foundations' AND category = 'Certifications')
      AND NOT (phase = 'Specialization' AND category = 'Pen Testing')
  ) THEN
    INSERT INTO public.roadmap_items (member_email, phase, category, title, detail, completed, sort_order) VALUES
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Remove OTW banner, change headline', '', true, 10),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Remove "unemployed" experience', '', true, 20),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Get to 5k followers', '349/5000', false, 30),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Studying', 'Final year IT student at TUT', true, 10),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Current role: Cyber Security Analyst at Hosi Technologies', 'R2.5k', true, 20),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Location', 'Pretoria', true, 30),
      ('[REDACTED]', 'Specialization', 'Performance Incentive', 'Complete THM Offensive Pentesting pathway to obtain eJPT voucher', '', false, 50);
  END IF;
END $$;

-- [REDACTED] ([REDACTED]) - Cloud Security track,
-- Cloud Security specialization.
UPDATE public.member_profiles SET roadmap_track = 'Cloud Security' WHERE email = '[REDACTED]';

DELETE FROM public.roadmap_items WHERE member_email = '[REDACTED]' AND phase = 'Core Foundations' AND category = 'Certifications';
INSERT INTO public.roadmap_items (member_email, phase, category, title, detail, completed, sort_order) VALUES
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'CISCO Junior Cyber Pathway', '', false, 10),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'Immersive Labs', '12/20 collections · by 20th of August', false, 20),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'TryHackMe Pre-Security', '100% complete · by 29th of May', true, 30),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'TryHackMe Cyber 101', '60% complete · by 14th of August', false, 40),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'AZ-900', '', false, 50),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'AI-901', '', false, 60),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'SC-900', '', false, 70),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'CompTIA Security+', '', false, 80);

-- Cloud Security's standard Specialization catalog (SPECIALIZATION_CATALOGS
-- in src/lib/memberOptions.js), same unconditional-replace idempotency as
-- Core Foundations Certifications above. Her old 'SC-500 (AZ-500)' item
-- doesn't exact-match the catalog's 'SC-500' title, so it's dropped along
-- with the rest of the non-matching old items - same accepted-loss pattern
-- already applied to Core Foundations and to SOC/Offensive Security.
DELETE FROM public.roadmap_items WHERE member_email = '[REDACTED]' AND phase = 'Specialization' AND category = 'Cloud Security';
INSERT INTO public.roadmap_items (member_email, phase, category, title, detail, completed, sort_order) VALUES
  ('[REDACTED]', 'Specialization', 'Cloud Security', 'AZ-104', '', false, 10),
  ('[REDACTED]', 'Specialization', 'Cloud Security', 'SC-200', '', false, 20),
  ('[REDACTED]', 'Specialization', 'Cloud Security', 'SC-500', '', false, 30),
  ('[REDACTED]', 'Specialization', 'Cloud Security', 'Terraform Associate', '', false, 40),
  ('[REDACTED]', 'Specialization', 'Cloud Security', 'SC-100', '', false, 50),
  ('[REDACTED]', 'Specialization', 'Cloud Security', 'AZ-305', '', false, 60);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.roadmap_items
    WHERE member_email = '[REDACTED]'
      AND NOT (phase = 'Core Foundations' AND category = 'Certifications')
      AND NOT (phase = 'Specialization' AND category = 'Cloud Security')
  ) THEN
    INSERT INTO public.roadmap_items (member_email, phase, category, title, detail, completed, sort_order) VALUES
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Get to 5000 followers', '2612/5000', false, 10),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Post everyday', '', false, 20),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Attend webinars', '', false, 30),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Studying', 'Final-year law student at Rhodes University · R5.5k per month', true, 10),
      ('[REDACTED]', 'Specialization', 'Performance Incentive', 'Complete roadmap up to SC-200 to obtain Security+ voucher', '', false, 60);
  END IF;
END $$;

-- [REDACTED] ([REDACTED]) - SOC track.
UPDATE public.member_profiles SET roadmap_track = 'SOC' WHERE email = '[REDACTED]';

DELETE FROM public.roadmap_items WHERE member_email = '[REDACTED]' AND phase = 'Core Foundations' AND category = 'Certifications';
INSERT INTO public.roadmap_items (member_email, phase, category, title, detail, completed, sort_order) VALUES
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'CISCO Junior Cyber Pathway', '', false, 10),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'Immersive Labs', '', false, 20),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'TryHackMe Pre-Security', '', false, 30),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'TryHackMe Cyber 101', '', false, 40),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'AZ-900', '', false, 50),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'AI-901', '', false, 60),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'SC-900', '', false, 70),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'CompTIA Security+', 'by April 20th', false, 80);

-- SOC's standard Specialization catalog (SPECIALIZATION_CATALOGS in
-- src/lib/memberOptions.js), same unconditional-replace idempotency as
-- Core Foundations Certifications above.
DELETE FROM public.roadmap_items WHERE member_email = '[REDACTED]' AND phase = 'Specialization' AND category = 'SOC';
INSERT INTO public.roadmap_items (member_email, phase, category, title, detail, completed, sort_order) VALUES
  ('[REDACTED]', 'Specialization', 'SOC', 'CySA+', '~R7k · by 17th of July', false, 10),
  ('[REDACTED]', 'Specialization', 'SOC', 'SC-200', '', false, 20),
  ('[REDACTED]', 'Specialization', 'SOC', 'THM SOC Level 1', '42% complete', false, 30),
  ('[REDACTED]', 'Specialization', 'SOC', 'Blue Team Level 1', '', false, 40);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.roadmap_items
    WHERE member_email = '[REDACTED]'
      AND NOT (phase = 'Core Foundations' AND category = 'Certifications')
      AND NOT (phase = 'Specialization' AND category = 'SOC')
  ) THEN
    INSERT INTO public.roadmap_items (member_email, phase, category, title, detail, completed, sort_order) VALUES
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Get to 5000 LinkedIn followers', '1,894/5,000', false, 10),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Post at least once a week', '', false, 20),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Attend webinars/events', '', false, 30),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Current role: IT Support Engineer', 'R29k gross per month · based in JHB, open to CPT roles', true, 10),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Job tracker', '', false, 20),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Apply to roles', 'LinkedIn, PNet, Indeed, Glassdoor', false, 30);
  END IF;
END $$;

-- [REDACTED] ([REDACTED]) - no track/specialization given
-- in his doc yet, so roadmap_track is left as-is rather than guessed at.
DELETE FROM public.roadmap_items WHERE member_email = '[REDACTED]' AND phase = 'Core Foundations' AND category = 'Certifications';
INSERT INTO public.roadmap_items (member_email, phase, category, title, detail, completed, sort_order) VALUES
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'CISCO Junior Cyber Pathway', '', false, 10),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'Immersive Labs', '0/20 collections', false, 20),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'TryHackMe Pre-Security', '', false, 30),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'TryHackMe Cyber 101', '', false, 40),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'AZ-900', '', false, 50),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'AI-901', '', false, 60),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'SC-900', '', false, 70),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'CompTIA Security+', '', false, 80);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.roadmap_items
    WHERE member_email = '[REDACTED]' AND NOT (phase = 'Core Foundations' AND category = 'Certifications')
  ) THEN
    INSERT INTO public.roadmap_items (member_email, phase, category, title, detail, completed, sort_order) VALUES
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Post once a week', 'e.g. IL room, cert, podcast, article, event/webinar', false, 10),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Get to 5000 followers', 'Connect with cyber space folks', false, 20),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Location', 'Cape Town', true, 10),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Current status', 'R2k per month · unemployed', true, 20);
  END IF;
END $$;

-- Sabelo ([REDACTED]) - no track/specialization given in his doc
-- yet, so roadmap_track is left as-is rather than guessed at.
DELETE FROM public.roadmap_items WHERE member_email = '[REDACTED]' AND phase = 'Core Foundations' AND category = 'Certifications';
INSERT INTO public.roadmap_items (member_email, phase, category, title, detail, completed, sort_order) VALUES
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'CISCO Junior Cyber Pathway', '', false, 10),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'Immersive Labs', 'Target: 20 collections · by mid August', false, 20),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'TryHackMe Pre-Security', '100% complete', true, 30),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'TryHackMe Cyber 101', '21% complete', false, 40),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'AZ-900', '', false, 50),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'AI-901', '', false, 60),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'SC-900', '', false, 70),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'CompTIA Security+', 'By November', false, 80);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.roadmap_items
    WHERE member_email = '[REDACTED]' AND NOT (phase = 'Core Foundations' AND category = 'Certifications')
  ) THEN
    INSERT INTO public.roadmap_items (member_email, phase, category, title, detail, completed, sort_order) VALUES
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Get to 1000 LinkedIn followers', '242/1000 as of 31 July 2026', false, 10),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Post at least once a week', 'Posted twice this week (27 July – 2 August 2026)', false, 20),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Plan for BSides 2027', '', false, 30),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Talk to SOC Analysts (HH members or LinkedIn contacts)', 'Get insight on what worked / didn''t · set up an appointment with Dilemo', false, 40),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Location', 'Johannesburg', true, 10),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Current salary', '~R12k', true, 20);
  END IF;
END $$;

-- Sibo ([REDACTED]) - no track/specialization given in his doc
-- yet, so roadmap_track is left as-is rather than guessed at.
DELETE FROM public.roadmap_items WHERE member_email = '[REDACTED]' AND phase = 'Core Foundations' AND category = 'Certifications';
INSERT INTO public.roadmap_items (member_email, phase, category, title, detail, completed, sort_order) VALUES
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'CISCO Junior Cyber Pathway', '1/6 courses · by end of August', false, 10),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'Immersive Labs', '3/20 collections · by end of September', false, 20),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'TryHackMe Pre-Security', '', false, 30),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'TryHackMe Cyber 101', '', false, 40),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'AZ-900', '', false, 50),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'AI-901', '', false, 60),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'SC-900', '', false, 70),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'CompTIA Security+', '', false, 80);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.roadmap_items
    WHERE member_email = '[REDACTED]' AND NOT (phase = 'Core Foundations' AND category = 'Certifications')
  ) THEN
    INSERT INTO public.roadmap_items (member_email, phase, category, title, detail, completed, sort_order) VALUES
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Get to 5000 LinkedIn followers', '', false, 10),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Attend events/webinars once a month', '', false, 20),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Current role: Call Centre', 'R10k per month', true, 10),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Location', 'Cape Town', true, 20);
  END IF;
END $$;

-- [REDACTED] ([REDACTED]) - no track/specialization given
-- in his doc yet, so roadmap_track is left as-is rather than guessed at.
DELETE FROM public.roadmap_items WHERE member_email = '[REDACTED]' AND phase = 'Core Foundations' AND category = 'Certifications';
INSERT INTO public.roadmap_items (member_email, phase, category, title, detail, completed, sort_order) VALUES
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'CISCO Junior Cyber Pathway', '', false, 10),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'Immersive Labs', '', false, 20),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'TryHackMe Pre-Security', '', false, 30),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'TryHackMe Cyber 101', '', false, 40),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'AZ-900', '', false, 50),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'AI-901', '', false, 60),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'SC-900', 'by 7th of August', false, 70),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'CompTIA Security+', '', false, 80);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.roadmap_items
    WHERE member_email = '[REDACTED]' AND NOT (phase = 'Core Foundations' AND category = 'Certifications')
  ) THEN
    INSERT INTO public.roadmap_items (member_email, phase, category, title, detail, completed, sort_order) VALUES
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Get to 3000 LinkedIn followers', '1,106/3,000', false, 10),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Post once a week', '', false, 20),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Attend events/webinars', '', false, 30),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Location', 'Johannesburg', true, 10),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Current role: Platform and Compute Engineer', 'R38k per month', true, 20);
  END IF;
END $$;

-- [REDACTED] ([REDACTED]) - DevSecOps track. No catalog
-- retrofit needed for her Specialization phase - she has none yet, and
-- DevSecOps's standard catalog can be added via the admin "Add Standard
-- Specialization" quick-fill whenever she's ready for it.
UPDATE public.member_profiles SET roadmap_track = 'DevSecOps' WHERE email = '[REDACTED]';

DELETE FROM public.roadmap_items WHERE member_email = '[REDACTED]' AND phase = 'Core Foundations' AND category = 'Certifications';
INSERT INTO public.roadmap_items (member_email, phase, category, title, detail, completed, sort_order) VALUES
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'CISCO Junior Cyber Pathway', '0/6 courses · before end of August', false, 10),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'Immersive Labs', '0/20 collections · by end of September', false, 20),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'TryHackMe Pre-Security', '100% complete · before end of July', true, 30),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'TryHackMe Cyber 101', '85% complete · before end of August', false, 40),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'AZ-900', '', false, 50),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'AI-901', '', false, 60),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'SC-900', '', false, 70),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'CompTIA Security+', '', false, 80);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.roadmap_items
    WHERE member_email = '[REDACTED]' AND NOT (phase = 'Core Foundations' AND category = 'Certifications')
  ) THEN
    INSERT INTO public.roadmap_items (member_email, phase, category, title, detail, completed, sort_order) VALUES
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Get to 5000 LinkedIn followers', '994/5,000', false, 10),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Post at least once a week', '', false, 20),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Attend events/webinars', '', false, 30),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Studying', 'Final year Computer Science student at UCT · R3k-R4k per month', true, 10),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Location', 'Cape Town · open to roles in Johannesburg', true, 20);
  END IF;
END $$;

-- [REDACTED] ([REDACTED]) - no track/specialization given in
-- her doc yet, so roadmap_track is left as-is rather than guessed at.
DELETE FROM public.roadmap_items WHERE member_email = '[REDACTED]' AND phase = 'Core Foundations' AND category = 'Certifications';
INSERT INTO public.roadmap_items (member_email, phase, category, title, detail, completed, sort_order) VALUES
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'CISCO Junior Cyber Pathway', '4/6 courses · by mid August', false, 10),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'Immersive Labs', '', false, 20),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'TryHackMe Pre-Security', '', false, 30),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'TryHackMe Cyber 101', '', false, 40),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'AZ-900', '', false, 50),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'AI-901', '', false, 60),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'SC-900', '', false, 70),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'CompTIA Security+', '', false, 80);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.roadmap_items
    WHERE member_email = '[REDACTED]' AND NOT (phase = 'Core Foundations' AND category = 'Certifications')
  ) THEN
    INSERT INTO public.roadmap_items (member_email, phase, category, title, detail, completed, sort_order) VALUES
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Post once a week', 'e.g. THM room, article, event/webinar, certs/courses', false, 10),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Attend a webinar/event once a month', '', false, 20),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Current role: IT Intern', 'R8.2k per month', true, 10),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Location', 'Pretoria', true, 20);
  END IF;
END $$;

-- Lutendo ([REDACTED]) - no track/specialization given in
-- his doc yet, so roadmap_track is left as-is rather than guessed at.
DELETE FROM public.roadmap_items WHERE member_email = '[REDACTED]' AND phase = 'Core Foundations' AND category = 'Certifications';
INSERT INTO public.roadmap_items (member_email, phase, category, title, detail, completed, sort_order) VALUES
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'CISCO Junior Cyber Pathway', '', false, 10),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'Immersive Labs', '0/20 collections · by end of September', false, 20),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'TryHackMe Pre-Security', '% complete not yet tracked · by end of August', false, 30),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'TryHackMe Cyber 101', '% complete not yet tracked · by end of August', false, 40),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'AZ-900', '', false, 50),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'AI-901', '', false, 60),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'SC-900', '', false, 70),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'CompTIA Security+', '', false, 80);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.roadmap_items
    WHERE member_email = '[REDACTED]' AND NOT (phase = 'Core Foundations' AND category = 'Certifications')
  ) THEN
    INSERT INTO public.roadmap_items (member_email, phase, category, title, detail, completed, sort_order) VALUES
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Post once a week', 'e.g. THM rooms, articles, podcasts, events', false, 10),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Attend webinars/events', '', false, 20),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Location', 'Johannesburg', true, 10),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Current role: IT Intern', 'R8k per month', true, 20);
  END IF;
END $$;

-- Bongani ([REDACTED]) - no track/specialization given in his
-- doc yet, so roadmap_track is left as-is rather than guessed at.
DELETE FROM public.roadmap_items WHERE member_email = '[REDACTED]' AND phase = 'Core Foundations' AND category = 'Certifications';
INSERT INTO public.roadmap_items (member_email, phase, category, title, detail, completed, sort_order) VALUES
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'CISCO Junior Cyber Pathway', '6/6 courses · by end of June', true, 10),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'Immersive Labs', '20/20 collections · by end of July', true, 20),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'TryHackMe Pre-Security', '', false, 30),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'TryHackMe Cyber 101', '', false, 40),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'AZ-900', 'by end of August', false, 50),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'AI-901', '', false, 60),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'SC-900', 'by end of August', false, 70),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'CompTIA Security+', '', false, 80);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.roadmap_items
    WHERE member_email = '[REDACTED]' AND NOT (phase = 'Core Foundations' AND category = 'Certifications')
  ) THEN
    INSERT INTO public.roadmap_items (member_email, phase, category, title, detail, completed, sort_order) VALUES
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Get to 5000 LinkedIn followers', '32/5,000', false, 10),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Post once a week', '', false, 20),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Location', 'Pretoria', true, 10),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Current status', 'Unemployed', true, 20);
  END IF;
END $$;

-- [REDACTED] ([REDACTED]) - Cloud Security track.
UPDATE public.member_profiles SET roadmap_track = 'Cloud Security' WHERE email = '[REDACTED]';

DELETE FROM public.roadmap_items WHERE member_email = '[REDACTED]' AND phase = 'Core Foundations' AND category = 'Certifications';
INSERT INTO public.roadmap_items (member_email, phase, category, title, detail, completed, sort_order) VALUES
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'CISCO Junior Cyber Pathway', '4/6 courses · by end of August', false, 10),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'Immersive Labs', '20/20 collections · by end of July', true, 20),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'TryHackMe Pre-Security', '', false, 30),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'TryHackMe Cyber 101', '', false, 40),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'AZ-900', 'by end of July', false, 50),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'AI-901', '', false, 60),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'SC-900', '', false, 70),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'CompTIA Security+', '~R4.5k', false, 80);

-- Cloud Security's standard Specialization catalog (SPECIALIZATION_CATALOGS
-- in src/lib/memberOptions.js), same unconditional-replace idempotency as
-- Core Foundations Certifications above. His old 'AZ-500' item doesn't match
-- anything in the standard catalog (it's AZ-305, not AZ-500), so it's
-- dropped along with 'Learn2Cloud' and 'SC-900' - same accepted-loss pattern
-- already applied elsewhere. 'AZ-104' and 'SC-200' match exactly and keep
-- their (blank) detail.
DELETE FROM public.roadmap_items WHERE member_email = '[REDACTED]' AND phase = 'Specialization' AND category = 'Cloud Security';
INSERT INTO public.roadmap_items (member_email, phase, category, title, detail, completed, sort_order) VALUES
  ('[REDACTED]', 'Specialization', 'Cloud Security', 'AZ-104', '', false, 10),
  ('[REDACTED]', 'Specialization', 'Cloud Security', 'SC-200', '', false, 20),
  ('[REDACTED]', 'Specialization', 'Cloud Security', 'SC-500', '', false, 30),
  ('[REDACTED]', 'Specialization', 'Cloud Security', 'Terraform Associate', '', false, 40),
  ('[REDACTED]', 'Specialization', 'Cloud Security', 'SC-100', '', false, 50),
  ('[REDACTED]', 'Specialization', 'Cloud Security', 'AZ-305', '', false, 60);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.roadmap_items
    WHERE member_email = '[REDACTED]'
      AND NOT (phase = 'Core Foundations' AND category = 'Certifications')
      AND NOT (phase = 'Specialization' AND category = 'Cloud Security')
  ) THEN
    INSERT INTO public.roadmap_items (member_email, phase, category, title, detail, completed, sort_order) VALUES
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Get to 1000 LinkedIn connections', '1,000/1,000', true, 10),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Post at least once a week', '', false, 20),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Attend a webinar/event a month', '', false, 30),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Current role: Travel Specialist', 'R7k per month', true, 10),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Location', 'Pretoria', true, 20);
  END IF;
END $$;

-- [REDACTED] ([REDACTED]) - no track/specialization given in
-- his doc yet, so roadmap_track is left as-is rather than guessed at.
DELETE FROM public.roadmap_items WHERE member_email = '[REDACTED]' AND phase = 'Core Foundations' AND category = 'Certifications';
INSERT INTO public.roadmap_items (member_email, phase, category, title, detail, completed, sort_order) VALUES
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'CISCO Junior Cyber Pathway', '', false, 10),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'Immersive Labs', '', false, 20),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'TryHackMe Pre-Security', '', false, 30),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'TryHackMe Cyber 101', '', false, 40),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'AZ-900', '', false, 50),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'AI-901', '', false, 60),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'SC-900', '', false, 70),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'CompTIA Security+', '', false, 80);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.roadmap_items
    WHERE member_email = '[REDACTED]' AND NOT (phase = 'Core Foundations' AND category = 'Certifications')
  ) THEN
    INSERT INTO public.roadmap_items (member_email, phase, category, title, detail, completed, sort_order) VALUES
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Post once a week', '', false, 10),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Get to 5000 followers', '1,614/5,000', false, 20),
      ('[REDACTED]', 'Core Foundations', 'Projects', 'Azure SOC lab', 'Built with Terraform', true, 10);
  END IF;
END $$;

-- [REDACTED] ([REDACTED]) - Offensive Security track,
-- Pen Testing specialization.
UPDATE public.member_profiles SET roadmap_track = 'Offensive Security' WHERE email = '[REDACTED]';

DELETE FROM public.roadmap_items WHERE member_email = '[REDACTED]' AND phase = 'Core Foundations' AND category = 'Certifications';
INSERT INTO public.roadmap_items (member_email, phase, category, title, detail, completed, sort_order) VALUES
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'CISCO Junior Cyber Pathway', '1/6 courses · by end of June', false, 10),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'Immersive Labs', '0/20 collections', false, 20),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'TryHackMe Pre-Security', '', false, 30),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'TryHackMe Cyber 101', '', false, 40),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'AZ-900', '', false, 50),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'AI-901', '', false, 60),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'SC-900', '', false, 70),
  ('[REDACTED]', 'Core Foundations', 'Certifications', 'CompTIA Security+', '', false, 80);

-- Offensive Security's standard Specialization catalog (SPECIALIZATION_CATALOGS
-- in src/lib/memberOptions.js), same unconditional-replace idempotency as
-- Core Foundations Certifications above.
DELETE FROM public.roadmap_items WHERE member_email = '[REDACTED]' AND phase = 'Specialization' AND category = 'Pen Testing';
INSERT INTO public.roadmap_items (member_email, phase, category, title, detail, completed, sort_order) VALUES
  ('[REDACTED]', 'Specialization', 'Pen Testing', 'eJPT', '', false, 10),
  ('[REDACTED]', 'Specialization', 'Pen Testing', 'THM Junior Pentester', '', false, 20),
  ('[REDACTED]', 'Specialization', 'Pen Testing', 'THM Offensive Pentesting', '', false, 30),
  ('[REDACTED]', 'Specialization', 'Pen Testing', 'Burp Suite Certified Practitioner', '', false, 40),
  ('[REDACTED]', 'Specialization', 'Pen Testing', 'OSCP', '', false, 50);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.roadmap_items
    WHERE member_email = '[REDACTED]'
      AND NOT (phase = 'Core Foundations' AND category = 'Certifications')
      AND NOT (phase = 'Specialization' AND category = 'Pen Testing')
  ) THEN
    INSERT INTO public.roadmap_items (member_email, phase, category, title, detail, completed, sort_order) VALUES
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Post at least once a week', 'Lab, course, room, etc.', false, 10),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Current role: Mechanical Fitter', 'R37k per month', true, 10),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Location', 'Witbank (open to JHB and CPT)', true, 20);
  END IF;
END $$;
