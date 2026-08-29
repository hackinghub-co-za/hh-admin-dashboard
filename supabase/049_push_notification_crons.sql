-- Hacking Hub Admin Dashboard - Push Notification Crons
-- Run this LAST: after 048_push_notifications.sql, and after
-- push-streak-alert and push-1on1-reminder have already been deployed (see
-- each function's own header comment for the secrets it needs set first).
--
-- push-new-job isn't scheduled here - it's triggered directly by hh-app
-- right after a member posts a listing, same "fires from a click" shape as
-- everything else in this project except roadmap-reminder-email. These two
-- are the only push notifications that need to run on a timer, same exact
-- pattern as 047_roadmap_reminder_cron.sql.
--
-- BEFORE RUNNING: replace both placeholders below with real values.
--   1. <YOUR_PROJECT_REF> - your Supabase project ref, i.e. the
--      subdomain in your project URL (https://<YOUR_PROJECT_REF>.supabase.co)
--   2. <YOUR_CRON_SECRET> - the exact value you ran
--      `supabase secrets set CRON_SECRET=...` with (same value both
--      functions and roadmap-reminder-email already use)
--
-- Safe to re-run: each DO block below unschedules its existing job first,
-- since pg_cron has no CREATE OR REPLACE for jobs.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Streak-lapse check: once a day is enough - a member's last_login_date
-- only changes once daily, so running this more often would just resend
-- the same evening's push were mark_streak_push_sent's dedup ever to fail.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'push-streak-alert-daily') THEN
    PERFORM cron.unschedule('push-streak-alert-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'push-streak-alert-daily',
  '0 18 * * *', -- 18:00 UTC (20:00 SAST) every day - evening nudge, adjust to taste
  $$
  SELECT net.http_post(
    url := 'https://kveiflphktpvsddhkspz.supabase.co/functions/v1/push-streak-alert',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<YOUR_CRON_SECRET>'),
    body := '{}'::jsonb
  );
  $$
);

-- 1-on-1 reminder: needs to run often enough to reliably catch a 30-minute
-- window without missing it between runs - every 15 minutes means the
-- window is checked twice before it closes, and push_1on1_sent (048 PART
-- 4) stops that from becoming a duplicate push.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'push-1on1-reminder-15min') THEN
    PERFORM cron.unschedule('push-1on1-reminder-15min');
  END IF;
END $$;

SELECT cron.schedule(
  'push-1on1-reminder-15min',
  '*/15 * * * *', -- every 15 minutes
  $$
  SELECT net.http_post(
    url := 'https://kveiflphktpvsddhkspz.supabase.co/functions/v1/push-1on1-reminder',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<YOUR_CRON_SECRET>'),
    body := '{}'::jsonb
  );
  $$
);
