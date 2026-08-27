-- Hacking Hub Admin Dashboard - Roadmap Reminder Cron
-- Run this LAST: after 028_roadmap.sql, and after roadmap-reminder-email has
-- already been deployed (see that function's header comment for the three
-- secrets it needs set first - GEMINI_API_KEY, RESEND_API_KEY, CRON_SECRET).
--
-- Schedules the daily run of the email escalation (Feature C of the roadmap
-- accountability plan). Nothing in this project runs on a schedule on its
-- own otherwise - every other backend function so far only ever fires from
-- a click or a webhook - so this is genuinely new infrastructure, not just
-- new schema, which is why it's its own file rather than folded into
-- 028_roadmap.sql.
--
-- BEFORE RUNNING: replace both placeholders below with real values.
--   1. <YOUR_PROJECT_REF> - your Supabase project ref, i.e. the
--      subdomain in your project URL (https://<YOUR_PROJECT_REF>.supabase.co)
--   2. <YOUR_CRON_SECRET> - the exact value you ran
--      `supabase secrets set CRON_SECRET=...` with for roadmap-reminder-email
--
-- Safe to re-run: the DO block below unschedules any existing job with this
-- name first, since pg_cron has no CREATE OR REPLACE for jobs.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'roadmap-reminder-email-daily') THEN
    PERFORM cron.unschedule('roadmap-reminder-email-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'roadmap-reminder-email-daily',
  '0 8 * * *', -- 08:00 UTC every day - adjust to whatever local send time makes sense
  $$
  SELECT net.http_post(
    url := 'https://kveiflphktpvsddhkspz.supabase.co/functions/v1/roadmap-reminder-email',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<YOUR_CRON_SECRET>'),
    body := '{}'::jsonb
  );
  $$
);
