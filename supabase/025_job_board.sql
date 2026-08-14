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
DROP POLICY IF EXISTS "admins manage job board" ON public.job_board;
CREATE POLICY "admins manage job board"
  ON public.job_board FOR ALL
  USING (public.is_admin(auth.uid()));

-- Seed with the 5 roles that were previously hardcoded.
INSERT INTO public.job_board (id, title, company, location, type, salary, description, tags, posted_date) VALUES
  (1, 'SOC Analyst (Junior)', 'Nclose', 'Johannesburg (Hybrid)', 'Full-Time', 'R18,000 – R25,000 / month', 'Entry-level SOC role monitoring alerts, triaging incidents, and escalating to senior analysts. Great fit for members who''ve completed Security+.', 'Blue Team,Security+,Entry Level', '2026-08-01'),
  (2, 'Junior Penetration Tester', 'Telspace Systems', 'Cape Town (Onsite)', 'Full-Time', 'R22,000 – R30,000 / month', 'Assist senior consultants on web and network penetration tests. OSCP in progress or completed strongly preferred.', 'Red Team,OSCP,Junior', '2026-07-28'),
  (3, 'GRC Analyst Intern', 'Standard Bank', 'Johannesburg (Onsite)', 'Internship', 'R8,000 / month stipend', '6-month internship supporting risk assessments and compliance documentation within the group security office.', 'GRC,Internship', '2026-08-05'),
  (4, 'Cloud Security Engineer', 'Entelect', 'Remote (SA)', 'Full-Time', 'R45,000 – R60,000 / month', 'Own security posture for AWS and Azure workloads. AZ-500 or equivalent cloud security cert required.', 'Cloud Security,AZ-500,Mid-Level', '2026-07-20'),
  (5, 'Vulnerability Assessment Contractor', 'Private Client (via HH Network)', 'Remote', 'Contract', 'Project-based', 'Short-term engagement running external vulnerability scans and reporting for a mid-size fintech. Referred through the Hacking Hub network.', 'Red Team,Contract', '2026-08-06')
ON CONFLICT (id) DO NOTHING;

-- Keep the auto-increment sequence ahead of the manually-seeded ids above, so
-- the first member-added listing gets id 6, not a collision with 1-5.
SELECT setval(pg_get_serial_sequence('public.job_board', 'id'), 5, true);
