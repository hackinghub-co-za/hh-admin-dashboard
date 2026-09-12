-- Hacking Hub Admin Dashboard - Job Application Tracker
-- Run this in the Supabase SQL Editor after 002-074 have already been
-- applied. Safe to re-run: every statement is idempotent.
--
-- Member-facing tool on the Resources tab: a personal log of jobs applied
-- to (title, company, location, date applied, salary range, which CV
-- version was used, and status). Purely personal data, same trust level as
-- exam_readiness's self-reported checklist/score - no admin verification
-- or server-side validation needed beyond the status CHECK constraint, so
-- the client reads/writes directly through RLS with no RPC layer.

CREATE TABLE IF NOT EXISTS public.job_applications (
  id BIGSERIAL PRIMARY KEY,
  member_email TEXT NOT NULL,
  job_title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT,
  application_date DATE NOT NULL DEFAULT CURRENT_DATE,
  salary_range TEXT,
  cv_used TEXT,
  status TEXT NOT NULL DEFAULT 'Applied' CHECK (status IN ('Applied', 'Interview', 'Offer', 'Rejected', 'Withdrawn')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_job_applications_member ON public.job_applications(member_email, application_date DESC);

ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

-- Unique to the member, as asked: a member reads/writes only their own
-- applications - nobody else's are ever visible to them, same shape as
-- exam_readiness/quiz_attempts' "members manage own X" policy.
DROP POLICY IF EXISTS "members manage own job applications" ON public.job_applications;
CREATE POLICY "members manage own job applications"
  ON public.job_applications FOR ALL
  USING (member_email = lower(auth.jwt() ->> 'email'))
  WITH CHECK (member_email = lower(auth.jwt() ->> 'email'));

-- Same "admins manage X" escape hatch every other member-owned table in
-- this schema has (exam_readiness, cv_reviews, quiz_attempts) - lets a
-- founder/mentor help a member troubleshoot their own tracker without
-- needing direct SQL access.
DROP POLICY IF EXISTS "admins manage job applications" ON public.job_applications;
CREATE POLICY "admins manage job applications"
  ON public.job_applications FOR ALL
  USING (public.is_admin(auth.uid()));
