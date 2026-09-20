-- Hacking Hub Admin Dashboard - Weekly LinkedIn Post Confirmation + Reminder Cron
-- Run after 002-058 have already been applied. Safe to re-run.
--
-- Adds a one-click "Mark as Posted This Week" confirmation on the
-- roadmap's "Post once a week" item. src/lib/linkedInPlaybookData.js on
-- the client computes "which of the 12 rotating weeks is it right now"
-- from the ISO week number (`(isoWeek - 1) % 12`); this table's row key
-- uses the same ISO-week boundary from the Postgres side - the Monday of
-- the current ISO week (`date_trunc('week', now())`) - so both sides
-- always agree on "this week" without any per-member anchor date to track.
--
-- Same member-owned-but-write-sensitive pattern as member_interviews
-- (058_member_interviews.sql) and roadmap_items: members get SELECT-only
-- RLS on their own rows, admins get FOR ALL, and the only write path is a
-- SECURITY DEFINER RPC that hardcodes the caller's own email server-side.
--
-- Also schedules the weekly reminder email (was a separate
-- 060_linkedin_reminder_cron.sql, folded in here - one file for the whole
-- feature). Run this LAST within the feature: after
-- linkedin-post-reminder-email has already been deployed (see that
-- function's header comment for the secrets it needs first -
-- RESEND_API_KEY, CRON_SECRET - both can be reused from
-- roadmap-reminder-email if already set, no need for new values).
--
-- BEFORE RUNNING: replace both placeholders in the cron block at the
-- bottom of this file with real values.
--   1. <YOUR_PROJECT_REF> - your Supabase project ref, i.e. the
--      subdomain in your project URL (https://<YOUR_PROJECT_REF>.supabase.co)
--   2. <YOUR_CRON_SECRET> - the exact value you ran
--      `supabase secrets set CRON_SECRET=...` with for linkedin-post-reminder-email

CREATE TABLE IF NOT EXISTS public.linkedin_weekly_posts (
  id BIGSERIAL PRIMARY KEY,
  member_email TEXT NOT NULL,
  week_start DATE NOT NULL,
  confirmed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (member_email, week_start)
);

CREATE INDEX IF NOT EXISTS idx_linkedin_weekly_posts_member_week
  ON public.linkedin_weekly_posts(member_email, week_start);

ALTER TABLE public.linkedin_weekly_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read own linkedin posts" ON public.linkedin_weekly_posts;
CREATE POLICY "members read own linkedin posts"
  ON public.linkedin_weekly_posts FOR SELECT
  TO authenticated
  USING (
    member_email = lower(auth.jwt() ->> 'email')
    AND public.is_member_allowed(auth.jwt() ->> 'email')
  );

DROP POLICY IF EXISTS "admins manage linkedin posts" ON public.linkedin_weekly_posts;
CREATE POLICY "admins manage linkedin posts"
  ON public.linkedin_weekly_posts FOR ALL
  USING (public.is_admin(auth.uid()));

-- One-click confirmation for the *current* ISO week - upsert so clicking it
-- twice in the same week is a harmless no-op, not a duplicate-row error
-- (the UNIQUE constraint above would reject a plain second INSERT).
CREATE OR REPLACE FUNCTION public.confirm_my_linkedin_post()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.linkedin_weekly_posts (member_email, week_start)
  VALUES (lower(auth.jwt() ->> 'email'), date_trunc('week', timezone('utc'::text, now()))::date)
  ON CONFLICT (member_email, week_start) DO NOTHING;
END;
$$;
GRANT EXECUTE ON FUNCTION public.confirm_my_linkedin_post() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.confirm_my_linkedin_post() FROM PUBLIC, anon;

-- Whether the caller has already confirmed for the current week - the
-- inline roadmap widget's "already posted" state.
CREATE OR REPLACE FUNCTION public.get_my_linkedin_post_status()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.linkedin_weekly_posts
    WHERE member_email = lower(auth.jwt() ->> 'email')
      AND week_start = date_trunc('week', timezone('utc'::text, now()))::date
  );
$$;
GRANT EXECUTE ON FUNCTION public.get_my_linkedin_post_status() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_linkedin_post_status() FROM PUBLIC, anon;

-- Admin-only equivalent of get_my_linkedin_post_status(), for any member -
-- keeps "what week is it" defined in exactly this one place, so the admin
-- side (MemberProfileModal.jsx) never has to re-derive Monday-of-week math
-- in JS just to compare against a fetched row.
CREATE OR REPLACE FUNCTION public.get_member_linkedin_post_status(p_email TEXT)
RETURNS TABLE (confirmed_this_week BOOLEAN, last_confirmed_at TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE
AS $$
BEGIN
  IF auth.role() = 'authenticated' AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can view this.';
  END IF;

  RETURN QUERY
  SELECT
    EXISTS (
      SELECT 1 FROM public.linkedin_weekly_posts
      WHERE member_email = lower(p_email)
        AND week_start = date_trunc('week', timezone('utc'::text, now()))::date
    ),
    (SELECT MAX(confirmed_at) FROM public.linkedin_weekly_posts WHERE member_email = lower(p_email));
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_member_linkedin_post_status(TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_member_linkedin_post_status(TEXT) FROM PUBLIC, anon;

-- =========================================================================
-- WEEKLY REMINDER EMAIL - reaches members who haven't confirmed yet this
-- week. Sent by supabase/functions/linkedin-post-reminder-email, triggered
-- weekly by the pg_cron job scheduled at the bottom of this file. Own,
-- separate opt-out column - deliberately not shared with roadmap_reminder_opted_out
-- (028_roadmap.sql), same "one opt-out per email type" convention already
-- used throughout this project, so unsubscribing from one email never
-- silently affects the other.
-- =========================================================================

ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS linkedin_reminder_opted_out BOOLEAN NOT NULL DEFAULT false;

-- Same shape as unsubscribe_from_roadmap_reminders (028_roadmap.sql) - a
-- plain email-client click with no Supabase session, so this can't require
-- auth.jwt().
--
-- SECURITY: this used to be GRANTed to anon/authenticated directly, with
-- p_email fully trusted and no proof of ownership - since profiles.email is
-- publicly readable (schema.sql's "Allow public read-access to profile
-- metadata"), that let anyone unsubscribe any member with no auth at all.
-- Ownership is now proven one layer up: linkedin-reminder-unsubscribe (the
-- edge function) verifies an HMAC token over the email (unsubscribeToken.ts)
-- before ever calling this RPC via the service role, so this function itself
-- is service-role-only now, like every other internal-only function here.
CREATE OR REPLACE FUNCTION public.unsubscribe_from_linkedin_reminders(p_email TEXT)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.member_profiles
  SET linkedin_reminder_opted_out = true
  WHERE email = lower(p_email);
$$;
REVOKE EXECUTE ON FUNCTION public.unsubscribe_from_linkedin_reminders(TEXT) FROM PUBLIC, anon, authenticated;

-- Everyone active, opted in, with Specialization actually unlocked, who
-- hasn't confirmed for the current ISO week - a single aggregate query (an
-- anti-join against this week's confirmations), much cheaper than pulling
-- every member_profiles row into Deno and filtering there. Callable by the
-- service role (the edge function; bypasses this check entirely, same as
-- every other SECURITY DEFINER function here) or by an admin - never by an
-- ordinary member, since this reveals exactly who hasn't posted.
--
-- "Specialization unlocked" is checked the same two-part way the roadmap UI
-- does it (see MemberPortal.jsx's specializationUnlocked), not just "has a
-- track" - a coach can assign a track before a member has actually cleared
-- Core Foundations, and this reminder shouldn't nudge someone to post
-- before the item has even appeared on their roadmap (028_roadmap.sql now
-- keeps "Post once a week" pinned to the Specialization phase, which stays
-- hidden until this same condition is true). The 8 titles and the 5-count
-- threshold must be kept in sync with CORE_FOUNDATIONS_CATALOG and
-- SPECIALIZATION_UNLOCK_MIN in src/lib/memberOptions.js - same duplication
-- already accepted for assign_my_core_foundations() above.
CREATE OR REPLACE FUNCTION public.get_members_needing_linkedin_reminder()
RETURNS TABLE (email TEXT, full_name TEXT, roadmap_track TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated' AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can view this.';
  END IF;

  RETURN QUERY
  SELECT mp.email, mp.full_name, mp.roadmap_track
  FROM public.member_profiles mp
  WHERE mp.status IN ('Active', 'Active (Permanent)')
    AND mp.linkedin_reminder_opted_out = false
    AND mp.roadmap_track IS NOT NULL
    AND mp.roadmap_track != 'Not Assigned'
    AND mp.roadmap_foundations_approved_at IS NOT NULL
    AND (
      SELECT count(*) FROM public.roadmap_items ri
      WHERE ri.member_email = mp.email
        AND ri.phase = 'Core Foundations'
        AND ri.category = 'Certifications'
        AND ri.completed = true
        AND ri.title IN (
          'CISCO Junior Cyber Pathway', 'Immersive Labs', 'TryHackMe Pre-Security',
          'TryHackMe Cyber 101', 'AZ-900', 'AI-901', 'SC-900', 'CompTIA Security+'
        )
    ) >= 5
    AND NOT EXISTS (
      SELECT 1 FROM public.linkedin_weekly_posts lwp
      WHERE lwp.member_email = mp.email
        AND lwp.week_start = date_trunc('week', timezone('utc'::text, now()))::date
    );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_members_needing_linkedin_reminder() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_members_needing_linkedin_reminder() FROM PUBLIC, anon;

-- =========================================================================
-- CRON - schedules the weekly run of linkedin-post-reminder-email.
--
-- Only ever schedules this job if it doesn't already exist - NOT
-- "unschedule, then always reschedule" like this block originally did.
-- That original shape has a real, live-tested failure mode: this file's
-- own <YOUR_CRON_SECRET> placeholder below is never meant to be committed
-- as a real value (it's a secret - substitute it locally, by hand, right
-- before running this block, never in the tracked file), but the rest of
-- this migration (the table/RLS/seed content above) is genuinely safe to
-- re-run any time, e.g. to pick up a newly-added post. An unconditional
-- reschedule meant re-running the whole file for that reason silently
-- clobbered the live, already-correctly-configured cron job's real secret
-- back to the literal placeholder string - exactly the same "safe to
-- re-run" claim that turned out not to hold, same failure shape as the
-- get_stale_roadmap_members_for_reminder() incident elsewhere in this
-- project. Once this job exists with the real secret substituted in, this
-- block is now a true no-op on every future run of this file - to
-- deliberately change the schedule or secret later, run a fresh
-- cron.unschedule/cron.schedule pair by hand, not by re-running this file.
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'linkedin-post-reminder-weekly') THEN
    PERFORM cron.schedule(
      'linkedin-post-reminder-weekly',
      '0 8 * * 2', -- 08:00 UTC every Tuesday - matches the playbook's own "post Tue-Thu, 8-10am" advice, with most of the week still ahead to act on it
      $sql$
      SELECT net.http_post(
        url := 'https://kveiflphktpvsddhkspz.supabase.co/functions/v1/linkedin-post-reminder-email',
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<YOUR_CRON_SECRET>'),
        body := '{}'::jsonb
      );
      $sql$
    );
  END IF;
END $$;


-- =========================================================================
-- LinkedIn Playbook example posts - the actual content behind the 12-week
-- plan (src/lib/linkedInPlaybookData.js), moved into a real table both the
-- client and the reminder email edge function read, instead of two
-- hand-kept copies of the same 84 posts. That duplication (an edge
-- function can't import from src/, so it had its own hardcoded copy) is
-- the exact same failure shape as two other real bugs found and fixed
-- elsewhere in this app this session - one source of truth silently
-- drifting into two when only one side gets edited. Any admin-editable
-- content this specific (a real, unique post per track per week) is
-- always going to need genuine one-time seed data - that is NOT the same
-- mistake as a one-off migration written to seed a single named member's
-- personal data, which is what should go through the admin UI instead.
--
-- week_index is 0-11, same zero-based index getCurrentWeekIndex() already
-- produces client-side - no off-by-one translation needed anywhere that
-- reads this table. WEEKLY_THEMES/THEME_DESCRIPTIONS/hashtags stay as
-- plain static content in linkedInPlaybookData.js - small, structural,
-- and never duplicated anywhere else, unlike the 84 posts.
CREATE TABLE IF NOT EXISTS public.linkedin_playbook_posts (
  id BIGSERIAL PRIMARY KEY,
  roadmap_track TEXT NOT NULL,
  week_index INTEGER NOT NULL CHECK (week_index BETWEEN 0 AND 11),
  post_text TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (roadmap_track, week_index)
);

ALTER TABLE public.linkedin_playbook_posts ENABLE ROW LEVEL SECURITY;

-- Not remotely sensitive - every member already sees every track's full
-- 12-week plan today (LinkedInPlaybookModal.jsx lets you browse any
-- domain, not just your own), so any signed-in, approved member can read
-- the whole table.
DROP POLICY IF EXISTS "members read linkedin playbook posts" ON public.linkedin_playbook_posts;
CREATE POLICY "members read linkedin playbook posts"
  ON public.linkedin_playbook_posts FOR SELECT
  TO authenticated
  USING (public.is_member_allowed(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "admins manage linkedin playbook posts" ON public.linkedin_playbook_posts;
CREATE POLICY "admins manage linkedin playbook posts"
  ON public.linkedin_playbook_posts FOR ALL
  USING (public.is_admin(auth.uid()));

-- Seeded once with the real, already-written 84 posts (7 tracks x 12
-- weeks) - ON CONFLICT DO NOTHING, not DO UPDATE, since this becomes
-- live, admin-editable content the moment it's seeded; re-running this
-- migration must never clobber a real edit made after the fact.
INSERT INTO public.linkedin_playbook_posts (roadmap_track, week_index, post_text) VALUES
  ('SOC', 0, 'Started my journey into SOC analysis a few months ago - drawn to the puzzle-solving of triaging alerts and figuring out what''s actually a threat vs. noise. Currently working through TryHackMe''s SOC Level 1 path and loving how hands-on it is. If you''re a SOC analyst open to a quick chat about what a day in the role actually looks like, I''d love to connect.'),
  ('SOC', 1, 'Spent this week triaging simulated alerts in LetsDefend - walked through a suspicious PowerShell execution alert, pulled the process tree, and traced it back to a phishing payload. Wrote up my full investigation steps and what I''d flag for escalation. Link to the writeup in the comments 👇'),
  ('SOC', 2, 'Today I learned how to build a Sigma rule to detect a specific living-off-the-land technique (LOLBins abusing certutil.exe for downloads). Broke down exactly what the rule does and why it matters for cutting false positives. Detection engineering is quickly becoming my favorite part of this field.'),
  ('SOC', 3, 'Grateful for how open the SOC/blue team community is on here - in the last few weeks I''ve had some great conversations with analysts who took the time to answer my questions about their day-to-day. If you''re a SOC analyst willing to share what surprised you most about the role, I''d love to hear it in the comments.'),
  ('SOC', 4, 'Mistake I made this week: chased a false positive for way too long because I didn''t check the asset''s baseline behavior first. Lesson learned - always pull context (normal behavior, criticality, ownership) before diving deep into an alert. Small habit, big time saver.'),
  ('SOC', 5, 'Just passed my SC-200 (Security Operations Analyst) exam! 🎉 It pushed me to actually understand Microsoft Sentinel''s KQL queries instead of memorizing syntax - genuinely leveled up how I think about detection logic. On to the next one.'),
  ('SOC', 6, 'This week''s headline breach is a good reminder of why log retention and alert tuning matter so much - a SOC with the right detections in place could have caught this at initial access. What would you have flagged first?'),
  ('SOC', 7, 'Been learning a ton from other analysts'' breakdowns of real-world incident response on here - if you''re trying to break into SOC, following people who share their actual process is worth more than another course. Who else should I be learning from?'),
  ('SOC', 8, 'Full writeup: how I investigated a simulated ransomware precursor alert from initial detection to containment recommendation - the SIEM query I used, the process tree analysis, and the exact escalation criteria I applied. Closest I''ve gotten to what a real SOC shift feels like. Link below.'),
  ('SOC', 9, 'Unpopular opinion: alert fatigue isn''t a tooling problem, it''s a tuning problem. Most SOCs already have the tools to reduce noise - what''s missing is the discipline to actually tune detections instead of adding more alerts. Curious what working analysts think.'),
  ('SOC', 10, 'Free resource that''s been huge for my SOC prep: TryHackMe''s SOC Level 1 path. If you''re starting out in blue team and don''t know where to begin, start there. Happy to share my study plan if it''d help anyone else.'),
  ('SOC', 11, '3 months into focused SOC analyst prep: 4 certs down, dozens of simulated investigations completed, and a network of analysts I never would have met otherwise. Biggest lesson - consistency beats intensity. Thank you to everyone who''s engaged with my posts and offered advice along the way.'),
  ('Offensive Security', 0, 'Diving into offensive security because I love thinking like an attacker to help build better defenses. Currently working through TryHackMe and HackTheBox boxes, chasing my OSCP. If you''re in red teaming or pentesting and open to sharing what got you into it, I''d love to connect.'),
  ('Offensive Security', 1, 'Rooted a HackTheBox machine this week using a chained privilege escalation - a misconfigured sudo permission into a SUID binary exploit. Documented my full methodology, tools, and thought process (flag redacted, obviously). Link to the writeup below.'),
  ('Offensive Security', 2, 'Spent this week going deep on Kerberoasting - how it works, why weak service account passwords make it so effective, and how to actually detect it as a defender too. Understanding the attack makes you better at explaining the fix.'),
  ('Offensive Security', 3, 'The offensive security community here has been incredibly generous with knowledge - CTF writeups, tool breakdowns, real talk about what pentest reports actually look like. If you''re a pentester or red teamer willing to share war stories, I''d love to connect and learn from your experience.'),
  ('Offensive Security', 4, 'Spent 3 hours stuck on a box because I skipped basic enumeration and jumped straight to exploitation. Lesson relearned the hard way: recon thoroughly before you get clever. Slow is smooth, smooth is fast.'),
  ('Offensive Security', 5, 'Passed eJPT this week! 🎉 It forced me to actually understand the full pentest methodology end-to-end, not just memorize exploit commands. Next stop: OSCP.'),
  ('Offensive Security', 6, 'This week''s disclosed RCE in a widely-used tool is a good reminder of how much impact a single unauthenticated endpoint can have. Read through the technical writeup - the root cause was a classic deserialization flaw. What''s the best public vuln writeup you''ve read recently?'),
  ('Offensive Security', 7, 'Been learning a ton from other offensive security folks'' CTF writeups and methodology breakdowns here - way more valuable than another course module. If you write up your boxes/CTFs publicly, drop a link, I''d love to read more.'),
  ('Offensive Security', 8, 'Full writeup: how I compromised a HackTheBox machine from initial foothold to full domain admin - enumeration, exploitation of a vulnerable web app, lateral movement, and privilege escalation via a misconfigured GPO. Every step documented, flags redacted. Closest thing to a real internal pentest I''ve done.'),
  ('Offensive Security', 9, 'Hot take: OSCP being ''hard'' isn''t really about the exploits - it''s about forcing you to be methodical under pressure, which is the actual skill that transfers to real engagements. Curious if working pentesters agree.'),
  ('Offensive Security', 10, 'Free resource that''s leveled up my offensive security skills more than anything paid: HackTheBox''s free-tier boxes + writing my own reports for every one. If you''re starting out, do that before spending money on courses. Happy to share my note-taking template.'),
  ('Offensive Security', 11, '3 months deep into offensive security prep: dozens of boxes rooted, eJPT passed, and OSCP prep underway. The biggest shift wasn''t technical - it was learning to document everything like I''m writing a real client report. Grateful for everyone in this community who''s pointed me toward better resources.'),
  ('Cloud Security', 0, 'Getting into cloud security because so much of what we build now lives in AWS/Azure/GCP, and most breaches these days start with a misconfiguration, not a zero-day. Working through cloud security fundamentals right now. If you work in cloud security and are open to sharing what a typical day looks like, I''d love to connect.'),
  ('Cloud Security', 1, 'Built and then deliberately broke a small AWS environment this week - a public S3 bucket, an over-permissive IAM role, an exposed access key - then wrote up how I''d find and fix each one as a security review. Screenshots and remediation steps below.'),
  ('Cloud Security', 2, 'Today I learned how to write a proper least-privilege IAM policy instead of reaching for AdministratorAccess out of convenience. Broke down the difference between identity-based and resource-based policies and when each actually applies.'),
  ('Cloud Security', 3, 'The cloud security community here shares more real, practical config advice than most paid courses I''ve seen. If you work in cloud security/DevSecOps and are open to connecting, I''d love to learn from your experience with real-world environments.'),
  ('Cloud Security', 4, 'Spent an embarrassing amount of time debugging an IAM policy that wasn''t working - turned out I''d misunderstood how explicit Deny statements override Allow. Small detail, big consequence if you get it backwards in production.'),
  ('Cloud Security', 5, 'Passed my AWS/Azure security cert this week! 🎉 It pushed me past theory into actually configuring real controls - security groups, KMS key policies, CloudTrail logging. Feeling a lot more confident reading real cloud architecture diagrams now.'),
  ('Cloud Security', 6, 'This week''s cloud misconfiguration story (a publicly exposed storage bucket exposing sensitive data) is such a familiar pattern - it''s almost never a sophisticated attack, just a default that was never locked down. What''s the cloud misconfiguration you see most often?'),
  ('Cloud Security', 7, 'Learning a ton from cloud security practitioners sharing real remediation stories here, not just theory. If you''ve got a cloud security war story worth sharing, I''d genuinely love to hear it.'),
  ('Cloud Security', 8, 'Full writeup: hardening a vulnerable-by-design AWS environment start to finish - locked down the S3 bucket policy, tightened IAM to least privilege, enabled GuardDuty and CloudTrail, and rotated exposed credentials. Every step, every command, documented below.'),
  ('Cloud Security', 9, 'Unpopular opinion: most cloud breaches aren''t a ''cloud security'' problem, they''re an IAM problem wearing a cloud costume. Get identity and access right and half the horror stories disappear. Curious if cloud practitioners agree.'),
  ('Cloud Security', 10, 'Free resource that''s been huge for my cloud security prep: AWS''s own Well-Architected Security Pillar docs - more practical than most paid courses. If you''re starting out, read that first. Happy to share my study notes.'),
  ('Cloud Security', 11, '3 months into cloud security prep: a cert down, several hands-on hardening labs completed, and a much clearer mental model of how cloud breaches actually happen. Biggest lesson - the fundamentals (IAM, logging, least privilege) matter more than any fancy tool. Thanks to everyone who''s shared real-world advice along the way.'),
  ('DevSecOps', 0, 'Getting into DevSecOps because I want security to be baked into how software gets built, not bolted on at the end. Working through CI/CD security and container hardening right now. If you work in DevSecOps or AppSec and are open to sharing your day-to-day, I''d love to connect.'),
  ('DevSecOps', 1, 'Added a security gate to a sample CI/CD pipeline this week - dependency scanning, SAST, and secrets scanning, all failing the build on a critical finding instead of just warning. Wrote up exactly how I wired it in and what it caught.'),
  ('DevSecOps', 2, 'Today I learned the real difference between SAST and DAST and when you actually need both, not just one for a checkbox. Broke down what each catches that the other misses.'),
  ('DevSecOps', 3, 'The DevSecOps community here shares more real pipeline configs than most paid courses. If you work in DevSecOps/AppSec and are open to connecting, I''d love to learn from how you''ve actually implemented ''shift-left'' on a real team.'),
  ('DevSecOps', 4, 'Spent way too long debugging why my pipeline''s secrets scanner wasn''t catching an obvious hardcoded key - turned out the scan was running before the commit that introduced it, not after. Order of operations matters more than I expected.'),
  ('DevSecOps', 5, 'Finished a container security course this week! 🎉 Genuinely changed how I think about image hardening - minimal base images, non-root users, scanning before pushing to a registry. Small changes, real risk reduction.'),
  ('DevSecOps', 6, 'This week''s supply-chain compromise (a popular open-source package with malicious code slipped into an update) is a good reminder of why dependency pinning and SBOM tracking actually matter, not just theoretical best practice. What''s your team''s approach to dependency risk?'),
  ('DevSecOps', 7, 'Learning a lot from DevSecOps practitioners sharing real pipeline failures and fixes here, way more useful than another ''shift-left'' buzzword post. If you''ve got a real pipeline security story, I''d love to hear it.'),
  ('DevSecOps', 8, 'Full writeup: building a security-gated CI/CD pipeline from scratch - dependency scanning, SAST, container image scanning, and secrets detection, each with the exact tool and config I used. Every stage, every failure mode I hit, documented below.'),
  ('DevSecOps', 9, 'Hot take: ''shift-left'' fails on most teams not because the tooling is bad, but because developers get flooded with low-priority findings and tune it all out. Fixing signal-to-noise matters more than adding another scanner.'),
  ('DevSecOps', 10, 'Free resource that''s been huge for my DevSecOps prep: OWASP''s DevSecOps guideline docs - way more practical than most paid content. If you''re starting out, read that first. Happy to share my pipeline template.'),
  ('DevSecOps', 11, '3 months into DevSecOps prep: a container security course done, a working security-gated pipeline built from scratch, and a much better sense of where security actually fits in the SDLC. Biggest lesson - security that developers don''t fight is security that actually gets adopted. Thanks to everyone who shared real pipeline advice along the way.'),
  ('IAM', 0, 'Getting into Identity and Access Management because so many breaches trace back to identity, not malware. Working through SC-300 material right now. If you work in IAM and are open to sharing what a typical week looks like, I''d love to connect.'),
  ('IAM', 1, 'Ran a full access review on a lab Azure AD tenant this week - found and fixed several over-permissioned accounts and set up conditional access policies requiring MFA for admin roles. Wrote up my full process below.'),
  ('IAM', 2, 'Today I learned how conditional access policies in Azure AD actually evaluate (and can conflict) - broke down a real scenario where two policies interacted in a way I didn''t expect. IAM logic gets subtle fast.'),
  ('IAM', 3, 'The IAM community here has taught me more about real-world identity architecture than any course so far. If you work in IAM/identity security and are open to connecting, I''d love to learn from how you''ve handled real access reviews.'),
  ('IAM', 4, 'Spent an hour confused why a user still had access after I removed them from a group - turned out they also had a direct role assignment I''d missed. Lesson: always check both group-based AND direct assignments during a review.'),
  ('IAM', 5, 'Passed SC-300 (Identity and Access Administrator) this week! 🎉 It pushed me to actually understand hybrid identity and federation, not just the Azure AD basics. On to hands-on labs next.'),
  ('IAM', 6, 'This week''s credential-stuffing-driven breach is such a familiar pattern - MFA alone would likely have stopped it. What IAM control do you think gets underestimated most often?'),
  ('IAM', 7, 'Learning a lot from IAM practitioners sharing real access-review horror stories here - way more useful than theory alone. If you''ve got a real IAM lesson worth sharing, I''d love to hear it.'),
  ('IAM', 8, 'Full writeup: running a least-privilege access review on a lab tenant end-to-end - identifying over-permissioned accounts, tightening role assignments, enabling conditional access and MFA enforcement, and documenting the before/after risk posture. Every step below.'),
  ('IAM', 9, 'Unpopular opinion: most orgs don''t have an IAM tooling problem, they have an IAM ownership problem - nobody''s actually accountable for reviewing access regularly. Tools don''t fix that, process does.'),
  ('IAM', 10, 'Free resource that''s been huge for my IAM prep: Microsoft Learn''s free Identity and Access Administrator learning path. If you''re starting out, that''s the place to begin. Happy to share my study notes.'),
  ('IAM', 11, '3 months into IAM prep: SC-300 passed, several access-review labs completed, and a much sharper eye for spotting over-permissioned accounts. Biggest lesson - identity truly is the new perimeter. Thanks to everyone who shared real access-review advice along the way.'),
  ('AI Security', 0, 'Getting into AI security because as fast as AI is being adopted, the security thinking is playing catch-up. Working through prompt injection and LLM red-teaming fundamentals right now. If you work in AI security and are open to sharing your perspective, I''d love to connect.'),
  ('AI Security', 1, 'Ran a safe, disclosed prompt injection test against an open-source LLM demo this week - tried to get it to ignore its system prompt via an indirect injection in a document it summarized. Documented what worked, what didn''t, and why.'),
  ('AI Security', 2, 'Today I learned the real difference between prompt injection and jailbreaking - they get used interchangeably but they''re different attack classes with different mitigations. Broke down both with real examples.'),
  ('AI Security', 3, 'The AI security space is moving so fast that the community here is honestly one of my best sources of real information, faster than most papers. If you work in AI security/ML safety and are open to connecting, I''d love to learn from your perspective.'),
  ('AI Security', 4, 'Assumed a model''s system prompt was ''safe'' because it wasn''t visible in the UI - learned the hard way that a determined indirect injection can still extract it. Never assume obscurity is protection.'),
  ('AI Security', 5, 'Finished an AI security fundamentals course this week! 🎉 Genuinely reframed how I think about the AI attack surface - it''s not just the model, it''s the whole pipeline (data, prompts, tools, outputs). More to learn.'),
  ('AI Security', 6, 'This week''s disclosed AI security research (a real prompt injection chain against a production LLM tool) is a good reminder that this attack surface is very real, not hypothetical. What''s the most interesting AI security research you''ve read recently?'),
  ('AI Security', 7, 'Learning a lot from AI security researchers sharing real disclosed findings here - the field moves faster than any course can keep up with. If you''re doing AI red-teaming work, I''d love to hear what you''re seeing.'),
  ('AI Security', 8, 'Full writeup: a structured AI red-teaming exercise against an open-source LLM demo - the injection techniques I tried, which succeeded, which the model''s guardrails caught, and what that tells you about designing safer prompts and system architecture. All in a safe, disclosed test environment.'),
  ('AI Security', 9, 'Hot take: most ''AI security'' right now is really just prompt engineering wearing a security hat - the field needs a lot more focus on the surrounding system (data pipelines, tool access, output handling), not just the model itself.'),
  ('AI Security', 10, 'Free resource that''s been huge for my AI security prep: OWASP''s Top 10 for LLM Applications - clearest framework I''ve found for this space. If you''re starting out, read that first. Happy to share my notes.'),
  ('AI Security', 11, '3 months into AI security prep: a fundamentals course done, several safe red-teaming exercises completed, and a much clearer mental model of the real AI attack surface. Biggest lesson - this field is being defined right now, which makes it a genuinely exciting time to be learning it. Thanks to everyone who shared research and perspective along the way.'),
  ('GRC', 0, 'Getting into GRC because I like the side of security that''s about building systems and accountability, not just finding bugs. Working through ISO 27001 and NIST CSF fundamentals right now. If you work in GRC and are open to sharing what a typical week looks like, I''d love to connect.'),
  ('GRC', 1, 'Mapped a fictional company''s security controls to NIST CSF this week as a practice exercise - identified real gaps in their Detect and Respond functions. Wrote up my full control-mapping process and reasoning.'),
  ('GRC', 2, 'Today I learned the actual difference between a risk assessment and a risk register - they get used interchangeably but serve different purposes in a real GRC program. Broke down both with a simple example.'),
  ('GRC', 3, 'The GRC community here has taught me more about how real risk programs actually run than any textbook. If you work in GRC/compliance and are open to connecting, I''d love to learn from your experience with real audits.'),
  ('GRC', 4, 'Assumed a control being ''documented'' meant it was actually implemented - learned that a real audit tests evidence, not just policy documents. Big gap between ''written down'' and ''actually happening''.'),
  ('GRC', 5, 'Passed a GRC fundamentals cert this week! 🎉 It pushed me to actually understand how frameworks like ISO 27001 map to real operational controls, not just memorize clause numbers. Next stop: a deeper compliance cert.'),
  ('GRC', 6, 'This week''s regulatory fine (a company penalized for a data protection failure) is a good case study in what happens when governance gaps turn into real financial and reputational risk. What''s the compliance failure you find most instructive?'),
  ('GRC', 7, 'Learning a lot from GRC practitioners sharing real audit and risk-assessment stories here - way more useful than the framework docs alone. If you''ve got a real governance lesson worth sharing, I''d love to hear it.'),
  ('GRC', 8, 'Full writeup: a complete risk assessment exercise for a fictional company - identified assets, mapped threats and controls to NIST CSF, scored risk likelihood/impact, and proposed a remediation roadmap. Every step of the methodology documented below.'),
  ('GRC', 9, 'Unpopular opinion: GRC gets dismissed as ''paperwork security'' by technical folks, but a genuinely good risk program prevents more real incidents than most point-in-time technical controls. Curious what practitioners think.'),
  ('GRC', 10, 'Free resource that''s been huge for my GRC prep: NIST''s own CSF 2.0 documentation - clearer and more practical than most paid courses. If you''re starting out, read that first. Happy to share my control-mapping template.'),
  ('GRC', 11, '3 months into GRC prep: a fundamentals cert passed, a full risk assessment exercise completed, and a much better sense of how governance actually connects to real security outcomes. Biggest lesson - GRC isn''t the boring side of security, it''s the side that makes everything else sustainable. Thanks to everyone who shared real audit and risk advice along the way.')
ON CONFLICT (roadmap_track, week_index) DO NOTHING;
