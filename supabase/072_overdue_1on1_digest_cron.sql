-- Hacking Hub Admin Dashboard - Overdue 1-on-1 Digest Cron
-- Run this LAST for the feature: after 071_overdue_1on1_digest.sql is
-- applied AND after the edge function is deployed:
--   supabase functions deploy overdue-1on1-digest --no-verify-jwt
-- (RESEND_API_KEY and CRON_SECRET are already set from the other email
-- functions - no new secrets needed.)
--
-- Daily at 06:00 UTC = 08:00 SAST (SAST is UTC+2, no daylight saving, so
-- this local time is stable year-round) - the same "start of the day"
-- send time used elsewhere in this project for a founder-facing digest.
--
-- BEFORE RUNNING: replace <YOUR_CRON_SECRET> below with the exact value
-- already set via `supabase secrets set CRON_SECRET=...` (same value used
-- by every other cron in this project).
--
-- Safe to re-run: the job is unscheduled by name first (pg_cron has no
-- CREATE OR REPLACE for jobs).

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'overdue-1on1-digest-daily') THEN
    PERFORM cron.unschedule('overdue-1on1-digest-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'overdue-1on1-digest-daily',
  '0 6 * * *', -- 06:00 UTC every day = 08:00 SAST
  $$
  SELECT net.http_post(
    url := 'https://kveiflphktpvsddhkspz.supabase.co/functions/v1/overdue-1on1-digest',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<YOUR_CRON_SECRET>'),
    body := '{}'::jsonb
  );
  $$
);
