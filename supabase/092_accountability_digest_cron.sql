-- Hacking Hub Admin Dashboard - Accountability Check-ins Digest Cron
-- Run this LAST for the feature: after 091_accountability_checkins.sql is
-- applied AND after the edge function is deployed:
--   supabase functions deploy accountability-digest --no-verify-jwt
--
-- Daily at 05:00 UTC = 07:00 SAST (no daylight saving, so stable
-- year-round) - the time shown on the admin tab's Daily Email card.
--
-- No <YOUR_CRON_SECRET> placeholder to fill in, unlike the older cron
-- files: the job's command is built from the already-scheduled
-- overdue-1on1-digest-daily job's command, with only the function name
-- swapped, so the cron secret is reused server-side and never has to be
-- pasted or seen. That job must exist first (072_overdue_1on1_digest_cron.sql).
--
-- Safe to re-run: the job is unscheduled by name first.

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

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'accountability-digest-daily') THEN
    PERFORM cron.unschedule('accountability-digest-daily');
  END IF;

  PERFORM cron.schedule(
    'accountability-digest-daily',
    '0 5 * * *', -- 05:00 UTC every day = 07:00 SAST
    replace(v_template, '/functions/v1/overdue-1on1-digest', '/functions/v1/accountability-digest')
  );
END $$;
