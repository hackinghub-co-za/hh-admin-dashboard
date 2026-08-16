-- Hacking Hub Admin Dashboard - Member Roadmaps (batch import)
-- Run this in the Supabase SQL Editor after 028_roadmap.sql has been applied.
-- Safe to re-run: each member's block is guarded so a second run never
-- overwrites real progress they or an admin have since recorded through the
-- Roadmaps admin tab.
--
-- One running file for roadmaps handed over as real, individually-written
-- coaching docs (Google Docs, pasted in one at a time) - NOT a new migration
-- per person going forward. Every future member's roadmap should be entered
-- directly through the Roadmaps admin tab (it's built for exactly this);
-- this file exists only to bulk-seed the ones that already existed as docs
-- before that tab did, appending one block per member as each doc comes in.

-- [REDACTED] ([REDACTED]) - Offensive Security track, Pen Testing
-- specialization.
UPDATE public.member_profiles SET roadmap_track = 'Offensive Security' WHERE email = '[REDACTED]';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.roadmap_items WHERE member_email = '[REDACTED]') THEN
    INSERT INTO public.roadmap_items (member_email, phase, category, title, detail, completed, sort_order) VALUES
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'CISCO Junior Cyber Pathway', '0/6 courses', false, 10),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'Get to 30 rooms completed on THM', '30/30', true, 20),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'TryHackMe Pre-Security', '87% complete', false, 30),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'TryHackMe Cyber 101', '47% complete · by end of August', false, 40),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'AI-901', '', false, 50),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'Immersive Labs', '0/20 collections', false, 60),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'CompTIA Security+', 'by end of September', false, 70),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Remove OTW banner, change headline', '', true, 10),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Remove "unemployed" experience', '', true, 20),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Get to 5k followers', '349/5000', false, 30),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Studying', 'Final year IT student at TUT', true, 10),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Current role: Cyber Security Analyst at Hosi Technologies', 'R2.5k', true, 20),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Location', 'Pretoria', true, 30),
      ('[REDACTED]', 'Specialization', 'Pen Testing', 'TryHackMe Junior Pentester', '% complete not yet tracked', false, 10),
      ('[REDACTED]', 'Specialization', 'Pen Testing', 'TryHackMe Offensive Pentesting', '% complete not yet tracked', false, 20),
      ('[REDACTED]', 'Specialization', 'Pen Testing', 'eJPT', '', false, 30),
      ('[REDACTED]', 'Specialization', 'Pen Testing', 'OSCP', '', false, 40),
      ('[REDACTED]', 'Specialization', 'Performance Incentive', 'Complete THM Offensive Pentesting pathway to obtain eJPT voucher', '', false, 50);
  END IF;
END $$;

-- [REDACTED] ([REDACTED]) - Cloud Security track,
-- Cloud Security specialization.
UPDATE public.member_profiles SET roadmap_track = 'Cloud Security' WHERE email = '[REDACTED]';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.roadmap_items WHERE member_email = '[REDACTED]') THEN
    INSERT INTO public.roadmap_items (member_email, phase, category, title, detail, completed, sort_order) VALUES
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'Immersive Labs', '12/20 collections · by 20th of August', false, 10),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'CompTIA Security+', '', false, 20),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'TryHackMe Pre-Security', '100% complete · by 29th of May', true, 30),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'TryHackMe Cyber 101', '60% complete · by 14th of August', false, 40),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'TryHackMe SOC Level 1', '% complete not yet tracked · by 7th of September', false, 50),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Get to 5000 followers', '2612/5000', false, 10),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Post everyday', '', false, 20),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Attend webinars', '', false, 30),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Studying', 'Final-year law student at Rhodes University · R5.5k per month', true, 10),
      ('[REDACTED]', 'Specialization', 'Cloud Security', 'AZ-900', 'by 18th of June', false, 10),
      ('[REDACTED]', 'Specialization', 'Cloud Security', 'SC-900', '', false, 20),
      ('[REDACTED]', 'Specialization', 'Cloud Security', 'DevSec Blueprint', '', false, 30),
      ('[REDACTED]', 'Specialization', 'Cloud Security', 'SC-200', '', false, 40),
      ('[REDACTED]', 'Specialization', 'Cloud Security', 'SC-500 (AZ-500)', '', false, 50),
      ('[REDACTED]', 'Specialization', 'Performance Incentive', 'Complete roadmap up to SC-200 to obtain Security+ voucher', '', false, 60);
  END IF;
END $$;

-- [REDACTED] ([REDACTED]) - SOC track.
UPDATE public.member_profiles SET roadmap_track = 'SOC' WHERE email = '[REDACTED]';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.roadmap_items WHERE member_email = '[REDACTED]') THEN
    INSERT INTO public.roadmap_items (member_email, phase, category, title, detail, completed, sort_order) VALUES
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'CompTIA Security+', 'by April 20th', false, 10),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Get to 5000 LinkedIn followers', '1,894/5,000', false, 10),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Post at least once a week', '', false, 20),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Attend webinars/events', '', false, 30),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Current role: IT Support Engineer', 'R29k gross per month · based in JHB, open to CPT roles', true, 10),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Job tracker', '', false, 20),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Apply to roles', 'LinkedIn, PNet, Indeed, Glassdoor', false, 30),
      ('[REDACTED]', 'Specialization', 'SOC', 'CySA+', '~R7k · by 17th of July', false, 10),
      ('[REDACTED]', 'Specialization', 'SOC', 'TryHackMe SOC Level 1', '42% complete', false, 20),
      ('[REDACTED]', 'Specialization', 'SOC', 'THM SAL1', '', false, 30);
  END IF;
END $$;

-- [REDACTED] ([REDACTED]) - no track/specialization given
-- in his doc yet, so roadmap_track is left as-is rather than guessed at.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.roadmap_items WHERE member_email = '[REDACTED]') THEN
    INSERT INTO public.roadmap_items (member_email, phase, category, title, detail, completed, sort_order) VALUES
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'Immersive Labs', '0/20 collections', false, 10),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'AZ-900', '', false, 20),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'SC-200', '', false, 30),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'CompTIA Security+', '', false, 40),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Post once a week', 'e.g. IL room, cert, podcast, article, event/webinar', false, 10),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Get to 5000 followers', 'Connect with cyber space folks', false, 20),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Location', 'Cape Town', true, 10),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Current status', 'R2k per month · unemployed', true, 20);
  END IF;
END $$;

-- Sabelo ([REDACTED]) - no track/specialization given in his doc
-- yet, so roadmap_track is left as-is rather than guessed at.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.roadmap_items WHERE member_email = '[REDACTED]') THEN
    INSERT INTO public.roadmap_items (member_email, phase, category, title, detail, completed, sort_order) VALUES
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'Immersive Labs', 'Target: 20 collections · by mid August', false, 10),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'CompTIA Security+', 'By November', false, 20),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'TryHackMe Pre-Security', '100% complete', true, 30),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'TryHackMe Cyber 101', '21% complete', false, 40),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'TryHackMe SOC Level 1', '0% complete', false, 50),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'CompTIA CySA+', '', false, 60),
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
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.roadmap_items WHERE member_email = '[REDACTED]') THEN
    INSERT INTO public.roadmap_items (member_email, phase, category, title, detail, completed, sort_order) VALUES
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'CompTIA Security+', '', false, 10),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'TryHackMe SOC Level 1', '% complete not yet tracked', false, 20),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'CISCO Junior Cyber Analyst Pathway', '1/6 courses · by end of August', false, 30),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'Immersive Labs', '3/20 collections · by end of September', false, 40),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'CompTIA CySA+', '', false, 50),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Get to 5000 LinkedIn followers', '', false, 10),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Attend events/webinars once a month', '', false, 20),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Current role: Call Centre', 'R10k per month', true, 10),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Location', 'Cape Town', true, 20);
  END IF;
END $$;

-- [REDACTED] ([REDACTED]) - no track/specialization given
-- in his doc yet, so roadmap_track is left as-is rather than guessed at.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.roadmap_items WHERE member_email = '[REDACTED]') THEN
    INSERT INTO public.roadmap_items (member_email, phase, category, title, detail, completed, sort_order) VALUES
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'SC-900', 'by 7th of August', false, 10),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'CompTIA Security+', '', false, 20),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'SC-200', '', false, 30),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'KodeKloud Azure 50 Days', '0/50 days', false, 40),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'SC-500', '', false, 50),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Get to 3000 LinkedIn followers', '1,106/3,000', false, 10),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Post once a week', '', false, 20),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Attend events/webinars', '', false, 30),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Location', 'Johannesburg', true, 10),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Current role: Platform and Compute Engineer', 'R38k per month', true, 20);
  END IF;
END $$;

-- [REDACTED] ([REDACTED]) - no track/specialization
-- given in her doc yet, so roadmap_track is left as-is rather than guessed at.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.roadmap_items WHERE member_email = '[REDACTED]') THEN
    INSERT INTO public.roadmap_items (member_email, phase, category, title, detail, completed, sort_order) VALUES
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'TryHackMe Pre-Security', '100% complete · before end of July', true, 10),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'TryHackMe Cyber 101', '85% complete · before end of August', false, 20),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'Immersive Labs', '0/20 collections · by end of September', false, 30),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'TryHackMe Junior Pentester', '4% complete · by end of September', false, 40),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'CISCO Junior Cyber Pathway', '0/6 courses · before end of August', false, 50),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'CompTIA Security+', '', false, 60),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'AZ-900', '', false, 70),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Get to 5000 LinkedIn followers', '994/5,000', false, 10),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Post at least once a week', '', false, 20),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Attend events/webinars', '', false, 30),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Studying', 'Final year Computer Science student at UCT · R3k-R4k per month', true, 10),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Location', 'Cape Town · open to roles in Johannesburg', true, 20);
  END IF;
END $$;

-- [REDACTED] ([REDACTED]) - no track/specialization given in
-- her doc yet, so roadmap_track is left as-is rather than guessed at.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.roadmap_items WHERE member_email = '[REDACTED]') THEN
    INSERT INTO public.roadmap_items (member_email, phase, category, title, detail, completed, sort_order) VALUES
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'CISCO Junior Cyber Pathway', '4/6 courses · by mid August', false, 10),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'CompTIA Security+', '', false, 20),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'CompTIA CySA+', '', false, 30),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'TryHackMe SOC Level 1 Pathway', '0% complete', false, 40),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Post once a week', 'e.g. THM room, article, event/webinar, certs/courses', false, 10),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Attend a webinar/event once a month', '', false, 20),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Current role: IT Intern', 'R8.2k per month', true, 10),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Location', 'Pretoria', true, 20);
  END IF;
END $$;

-- Lutendo ([REDACTED]) - no track/specialization given in
-- his doc yet, so roadmap_track is left as-is rather than guessed at.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.roadmap_items WHERE member_email = '[REDACTED]') THEN
    INSERT INTO public.roadmap_items (member_email, phase, category, title, detail, completed, sort_order) VALUES
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'TryHackMe Pre-Security', '% complete not yet tracked · by end of August', false, 10),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'TryHackMe Cyber 101', '% complete not yet tracked · by end of August', false, 20),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'Immersive Labs', '0/20 collections · by end of September', false, 30),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'CompTIA Security+', '', false, 40),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Post once a week', 'e.g. THM rooms, articles, podcasts, events', false, 10),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Attend webinars/events', '', false, 20),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Location', 'Johannesburg', true, 10),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Current role: IT Intern', 'R8k per month', true, 20);
  END IF;
END $$;

-- Bongani ([REDACTED]) - no track/specialization given in his
-- doc yet, so roadmap_track is left as-is rather than guessed at.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.roadmap_items WHERE member_email = '[REDACTED]') THEN
    INSERT INTO public.roadmap_items (member_email, phase, category, title, detail, completed, sort_order) VALUES
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'CompTIA Security+', '', false, 10),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'CISCO Junior Cyber Pathway', '6/6 courses · by end of June', true, 20),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'Immersive Labs', '20/20 collections · by end of July', true, 30),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'AZ-900', 'by end of August', false, 40),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'SC-900', 'by end of August', false, 50),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'SC-200', '', false, 60),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Get to 5000 LinkedIn followers', '32/5,000', false, 10),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Post once a week', '', false, 20),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Location', 'Pretoria', true, 10),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Current status', 'Unemployed', true, 20);
  END IF;
END $$;

-- [REDACTED] ([REDACTED]) - Cloud Security track.
UPDATE public.member_profiles SET roadmap_track = 'Cloud Security' WHERE email = '[REDACTED]';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.roadmap_items WHERE member_email = '[REDACTED]') THEN
    INSERT INTO public.roadmap_items (member_email, phase, category, title, detail, completed, sort_order) VALUES
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'CISCO Junior Cyber Analyst Pathway', '4/6 courses · by end of August', false, 10),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'Immersive Labs', '20/20 collections · by end of July', true, 20),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'AZ-900', 'by end of July', false, 30),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'CompTIA Security+', '~R4.5k', false, 40),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Get to 1000 LinkedIn connections', '1,000/1,000', true, 10),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Post at least once a week', '', false, 20),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Attend a webinar/event a month', '', false, 30),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Current role: Travel Specialist', 'R7k per month', true, 10),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Location', 'Pretoria', true, 20),
      ('[REDACTED]', 'Specialization', 'Cloud Security', 'Learn2Cloud', '', false, 10),
      ('[REDACTED]', 'Specialization', 'Cloud Security', 'SC-900', '', false, 20),
      ('[REDACTED]', 'Specialization', 'Cloud Security', 'AZ-104', '', false, 30),
      ('[REDACTED]', 'Specialization', 'Cloud Security', 'SC-200', '', false, 40),
      ('[REDACTED]', 'Specialization', 'Cloud Security', 'AZ-500', '', false, 50);
  END IF;
END $$;

-- [REDACTED] ([REDACTED]) - no track/specialization given in
-- his doc yet, so roadmap_track is left as-is rather than guessed at.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.roadmap_items WHERE member_email = '[REDACTED]') THEN
    INSERT INTO public.roadmap_items (member_email, phase, category, title, detail, completed, sort_order) VALUES
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'Terraform Associate 004', '', false, 10),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'CompTIA Security+', '', false, 20),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'KCNA', '', false, 30),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'KCSA', '', false, 40),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'SC-500', '', false, 50),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'AI-900', '', false, 60),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Post once a week', '', false, 10),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Get to 5000 followers', '1,614/5,000', false, 20),
      ('[REDACTED]', 'Core Foundations', 'Projects', 'Azure SOC lab', 'Built with Terraform', true, 10);
  END IF;
END $$;

-- [REDACTED] ([REDACTED]) - Offensive Security track,
-- Pen Testing specialization.
UPDATE public.member_profiles SET roadmap_track = 'Offensive Security' WHERE email = '[REDACTED]';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.roadmap_items WHERE member_email = '[REDACTED]') THEN
    INSERT INTO public.roadmap_items (member_email, phase, category, title, detail, completed, sort_order) VALUES
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'CISCO Junior Cyber Pathway', '1/6 courses · by end of June', false, 10),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'Immersive Labs', '0/20 collections', false, 20),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'CompTIA Security+', '', false, 30),
      ('[REDACTED]', 'Core Foundations', 'Certifications', 'AZ-900', '', false, 40),
      ('[REDACTED]', 'Core Foundations', 'Networking', 'Post at least once a week', 'Lab, course, room, etc.', false, 10),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Current role: Mechanical Fitter', 'R37k per month', true, 10),
      ('[REDACTED]', 'Core Foundations', 'Other', 'Location', 'Witbank (open to JHB and CPT)', true, 20),
      ('[REDACTED]', 'Specialization', 'Pen Testing', 'eJPT', '', false, 10);
  END IF;
END $$;
