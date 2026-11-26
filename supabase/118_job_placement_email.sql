-- Hacking Hub Admin Dashboard - "Congratulations on your new role" email
-- Run after 002-117, and only after the job-placement-email function has
-- been deployed. Safe to re-run: every statement is idempotent.
--
-- When a member's job_readiness becomes 'Job Placed' (on their profile in
-- the admin portal, or any other way), the trigger below stamps
-- job_placed_at. The job-placement-email-15min cron then emails them a
-- congratulations from Siya with tips for their first 90 days, and sets
-- placement_email_sent_at so it only ever goes once. Members already Job
-- Placed before this existed have no job_placed_at, so they aren't emailed.
-- job_placed_date (003) stays the admin-entered placement date used in the
-- placement stats; job_placed_at is only the moment the status changed.

ALTER TABLE public.member_profiles ADD COLUMN IF NOT EXISTS job_placed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.member_profiles ADD COLUMN IF NOT EXISTS placement_email_sent_at TIMESTAMP WITH TIME ZONE;

CREATE OR REPLACE FUNCTION public._member_stamp_job_placed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.job_readiness = 'Job Placed' AND (TG_OP = 'INSERT' OR OLD.job_readiness IS DISTINCT FROM 'Job Placed') THEN
    NEW.job_placed_at := now();
  ELSIF NEW.job_readiness IS DISTINCT FROM 'Job Placed' THEN
    NEW.job_placed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS member_stamp_job_placed_at ON public.member_profiles;
CREATE TRIGGER member_stamp_job_placed_at
  BEFORE INSERT OR UPDATE OF job_readiness ON public.member_profiles
  FOR EACH ROW EXECUTE FUNCTION public._member_stamp_job_placed_at();

-- Every 15 minutes. Same template trick as 044_community_content.sql: built
-- from the already-scheduled overdue-1on1-digest-daily job with only the
-- function name swapped, so the cron secret is never pasted here.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
DECLARE
  v_template TEXT;
BEGIN
  SELECT command INTO v_template FROM cron.job WHERE jobname = 'overdue-1on1-digest-daily';
  IF v_template IS NULL OR position('/functions/v1/overdue-1on1-digest' in v_template) = 0 THEN
    RAISE EXCEPTION 'overdue-1on1-digest-daily cron job not found (or its URL changed) - schedule 072 first, or write this job by hand.';
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'job-placement-email-15min') THEN
    PERFORM cron.unschedule('job-placement-email-15min');
  END IF;

  PERFORM cron.schedule(
    'job-placement-email-15min',
    '*/15 * * * *',
    replace(v_template, '/functions/v1/overdue-1on1-digest', '/functions/v1/job-placement-email')
  );
END $$;
