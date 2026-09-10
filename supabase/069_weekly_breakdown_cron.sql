-- Hacking Hub Admin Dashboard - Weekly Breakdown Cron
-- Run this LAST for the feature: after 068_weekly_breakdowns.sql is applied
-- AND after both edge functions are deployed:
--   supabase functions deploy weekly-breakdown-email --no-verify-jwt
--   supabase functions deploy breakdown-nudge --no-verify-jwt
--   supabase functions deploy breakdown-unsubscribe --no-verify-jwt
-- (RESEND_API_KEY and CRON_SECRET are already set from the other email
-- functions - no new secrets needed.)
--
-- Two jobs:
--   weekly-breakdown-friday   0 6 * * 5   06:00 UTC Friday  = 08:00 SAST
--   breakdown-nudge-wednesday  0 13 * * 3  13:00 UTC Wednesday = 15:00 SAST
--
-- SAST is UTC+2 with no daylight saving, so these local times are stable
-- year-round. pg_cron itself runs in UTC - the cron expressions above are
-- UTC, deliberately offset by two hours from the intended local time.
--
-- BEFORE RUNNING: replace <YOUR_CRON_SECRET> in both blocks below with the
-- exact value already set via `supabase secrets set CRON_SECRET=...`.
--
-- Safe to re-run: each job is unscheduled by name first (pg_cron has no
-- CREATE OR REPLACE for jobs).

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-breakdown-friday') THEN
    PERFORM cron.unschedule('weekly-breakdown-friday');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'breakdown-nudge-wednesday') THEN
    PERFORM cron.unschedule('breakdown-nudge-wednesday');
  END IF;
END $$;

SELECT cron.schedule(
  'weekly-breakdown-friday',
  '0 6 * * 5', -- 06:00 UTC Friday = 08:00 SAST
  $$
  SELECT net.http_post(
    url := 'https://kveiflphktpvsddhkspz.supabase.co/functions/v1/weekly-breakdown-email',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<YOUR_CRON_SECRET>'),
    body := '{}'::jsonb
  );
  $$
);

SELECT cron.schedule(
  'breakdown-nudge-wednesday',
  '0 13 * * 3', -- 13:00 UTC Wednesday = 15:00 SAST
  $$
  SELECT net.http_post(
    url := 'https://kveiflphktpvsddhkspz.supabase.co/functions/v1/breakdown-nudge',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<YOUR_CRON_SECRET>'),
    body := '{}'::jsonb
  );
  $$
);
