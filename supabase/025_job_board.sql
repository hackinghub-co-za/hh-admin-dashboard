-- Hacking Hub Admin Dashboard - Job Board (persisted, member-submitted)
-- Run this in the Supabase SQL Editor after 002-021 have already been applied.
-- Safe to re-run: every statement is idempotent.
--
-- The Job Board was hardcoded local React state on the member side only - 5
-- roles that never changed and had a dead "Apply" button (no real link ever
-- existed). Now a real table members read from and can add to, same "member
-- owns their own submission" pattern as reviews/005_reviews.sql,
-- events/019_events.sql, and cert_calendar/024_cert_calendar.sql: any
-- approved member can post a listing (self-attributed via created_by, with a
-- real apply link) and read every listing; only admins can edit/delete one
-- that isn't theirs. No moderation/approval step here, same as the cert
-- calendar - member-submitted listings go live immediately.
--
-- tags is a single comma-separated TEXT column rather than a TEXT[] array -
-- simpler to bind to a plain text input client-side, split into a list only
-- for display.

CREATE TABLE IF NOT EXISTS public.job_board (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT,
  type TEXT NOT NULL CHECK (type IN ('Full-Time', 'Contract', 'Internship')),
  salary TEXT,
  description TEXT,
  tags TEXT,
  link TEXT,
  posted_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

-- track: which roadmap track this role is actually a fit for, so it can be
-- matched against a member's own coach-assigned roadmapTrack (029_member_roadmaps.sql)
-- for a simple rule-based "recommended for you" on the Job Board tab - no
-- LLM call needed, just a direct equality match. Same vocabulary as
-- ROADMAP_TRACKS/SPECIALTIES (memberOptions.js) minus the 'Not Assigned'
-- placeholder, since a listing is either a fit for one specific track or
-- it's cross-track/general (left NULL - e.g. a broad IT role) - never
-- "not assigned" the way a member's own track can be.
ALTER TABLE public.job_board ADD COLUMN IF NOT EXISTS track TEXT;

ALTER TABLE public.job_board DROP CONSTRAINT IF EXISTS job_board_track_check;
ALTER TABLE public.job_board ADD CONSTRAINT job_board_track_check
  CHECK (track IS NULL OR track IN ('SOC', 'Offensive Security', 'Cloud Security', 'DevSecOps', 'IAM', 'AI Security', 'GRC'));

ALTER TABLE public.job_board ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read job board" ON public.job_board;
CREATE POLICY "members read job board"
  ON public.job_board FOR SELECT
  TO authenticated
  USING (public.is_member_allowed(auth.jwt() ->> 'email'));

-- Self-service creation, same pattern as reviews/events/cert_calendar: a
-- member can only ever attribute a new listing to their own verified sign-in
-- email, never someone else's.
DROP POLICY IF EXISTS "members add job listings" ON public.job_board;
CREATE POLICY "members add job listings"
  ON public.job_board FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = lower(auth.jwt() ->> 'email')
    AND public.is_member_allowed(auth.jwt() ->> 'email')
  );

-- Admins manage everything directly (editing/removing any listing), same
-- is_admin() pattern as every other table.
--
-- WARNING - do not re-run this file alone against a database that has
-- already run 067_permission_scopes.sql: that later file widens this same
-- policy to also allow community_manager, and re-running just this file
-- afterward silently reverts it back to admin-only. Not fixed by widening
-- here directly - is_community_manager() isn't defined until 067, so a
-- fresh sequential bootstrap would fail on this exact line if it were
-- widened this early. Real live incident, 2026-09-16 - see
-- daily_room_logs' identical warning in 031_daily_room_logs.sql for the
-- full story. If this file ever needs to be re-run in isolation again,
-- re-run 067_permission_scopes.sql immediately after to restore the
-- widened policy.
DROP POLICY IF EXISTS "admins manage job board" ON public.job_board;
CREATE POLICY "admins manage job board"
  ON public.job_board FOR ALL
  USING (public.is_admin(auth.uid()));

-- =========================================================================
-- JOB RECOMMENDATION EMAIL OPT-OUT
-- =========================================================================
-- A track-matched job now gets a "Matches your track" badge and sorts to
-- the top on the member's own Job Board tab (rule-based, job_board.track =
-- member_profiles.roadmap_track), but that's silent - a member has no way
-- to know a new match exists unless they happen to reopen the tab. The
-- job-recommendation-email Edge Function closes that gap: fired
-- fire-and-forget right after a job is posted (same trigger point as
-- logPortalEvent('job_posted') in MemberPortal.jsx/AdminDashboard.jsx),
-- it emails every member whose roadmap_track matches the new listing's
-- track.
--
-- Same "one opt-out per email type" convention as roadmap_reminder_opted_out
-- (028_roadmap.sql), linkedin_reminder_opted_out (059_linkedin_weekly_post.sql),
-- and breakdown_email_opted_out (068_weekly_breakdowns.sql) - a member who
-- doesn't want job-match emails can still want every other email type, so
-- this is its own column, not a shared "opted out of everything" flag.
ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS job_recommendation_opted_out BOOLEAN NOT NULL DEFAULT false;

-- Same anonymous, no-token unsubscribe as unsubscribe_from_linkedin_reminders
-- (059) and unsubscribe_from_breakdown_emails (068) - a cold click from an
-- email client with no Supabase session, so this can't require auth.jwt().
CREATE OR REPLACE FUNCTION public.unsubscribe_from_job_recommendations(p_email TEXT)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.member_profiles
  SET job_recommendation_opted_out = true
  WHERE email = lower(p_email);
$$;
GRANT EXECUTE ON FUNCTION public.unsubscribe_from_job_recommendations(TEXT) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.unsubscribe_from_job_recommendations(TEXT) FROM PUBLIC;

-- Seed with the 5 roles that were previously hardcoded.
INSERT INTO public.job_board (id, title, company, location, type, salary, description, tags, track, posted_date) VALUES
  (1, 'SOC Analyst (Junior)', 'Nclose', 'Johannesburg (Hybrid)', 'Full-Time', 'R18,000 – R25,000 / month', 'Entry-level SOC role monitoring alerts, triaging incidents, and escalating to senior analysts. Great fit for members who''ve completed Security+.', 'Blue Team,Security+,Entry Level', 'SOC', '2026-08-01'),
  (2, 'Junior Penetration Tester', 'Telspace Systems', 'Cape Town (Onsite)', 'Full-Time', 'R22,000 – R30,000 / month', 'Assist senior consultants on web and network penetration tests. OSCP in progress or completed strongly preferred.', 'Red Team,OSCP,Junior', 'Offensive Security', '2026-07-28'),
  (3, 'GRC Analyst Intern', 'Standard Bank', 'Johannesburg (Onsite)', 'Internship', 'R8,000 / month stipend', '6-month internship supporting risk assessments and compliance documentation within the group security office.', 'GRC,Internship', 'GRC', '2026-08-05'),
  (4, 'Cloud Security Engineer', 'Entelect', 'Remote (SA)', 'Full-Time', 'R45,000 – R60,000 / month', 'Own security posture for AWS and Azure workloads. AZ-500 or equivalent cloud security cert required.', 'Cloud Security,AZ-500,Mid-Level', 'Cloud Security', '2026-07-20'),
  (5, 'Vulnerability Assessment Contractor', 'Private Client (via HH Network)', 'Remote', 'Contract', 'Project-based', 'Short-term engagement running external vulnerability scans and reporting for a mid-size fintech. Referred through the Hacking Hub network.', 'Red Team,Contract', 'Offensive Security', '2026-08-06')
ON CONFLICT (id) DO NOTHING;

-- Backfill track for the 5 seed rows above on a database where this file
-- already ran before the track column existed.
UPDATE public.job_board SET track = 'SOC' WHERE id = 1 AND track IS NULL;
UPDATE public.job_board SET track = 'Offensive Security' WHERE id = 2 AND track IS NULL;
UPDATE public.job_board SET track = 'GRC' WHERE id = 3 AND track IS NULL;
UPDATE public.job_board SET track = 'Cloud Security' WHERE id = 4 AND track IS NULL;
UPDATE public.job_board SET track = 'Offensive Security' WHERE id = 5 AND track IS NULL;

-- Keep the auto-increment sequence ahead of the manually-seeded ids above, so
-- the first member-added listing gets id 6, not a collision with 1-5.
-- GREATEST against the real current max, not a bare 5 - a bare value here
-- silently rewinds the sequence backward past every real member-posted job
-- every time this file gets safely re-run for an unrelated later change
-- (e.g. adding the track column above), which then makes every subsequent
-- "Add Job" fail with a primary-key collision until the sequence catches
-- back up on its own through repeated failures. Same real regression this
-- fixed in cert_calendar (024_cert_calendar.sql) on 2026-09-15.
SELECT setval(pg_get_serial_sequence('public.job_board', 'id'), GREATEST((SELECT COALESCE(max(id), 0) FROM public.job_board), 5), true);
