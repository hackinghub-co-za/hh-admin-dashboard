-- Hacking Hub Admin Dashboard - Daily Calendar Sync Cron
-- Run this LAST for the feature: after 073_admin_calendar_sync.sql is
-- applied AND after the edge function is deployed:
--   supabase functions deploy sync-last-1on1-dates --no-verify-jwt
-- New secrets needed (CRON_SECRET is already set from the other crons):
--   supabase secrets set GOOGLE_TOKEN_ENCRYPTION_KEY=<a long random string you make up>
--   supabase secrets set GOOGLE_OAUTH_CLIENT_ID=<the Client ID from Supabase Dashboard > Authentication > Providers > Google>
--   supabase secrets set GOOGLE_OAUTH_CLIENT_SECRET=<the Client Secret from that same screen>
--
-- Runs at 05:30 UTC = 07:30 SAST, 30 minutes before overdue-1on1-digest-daily
-- (072_overdue_1on1_digest_cron.sql, 06:00 UTC) so that email always reflects
-- the same morning's fresh sync, not yesterday's.
--
-- BEFORE RUNNING: replace <YOUR_CRON_SECRET> below with the exact value
-- already set via `supabase secrets set CRON_SECRET=...`.
--
-- Safe to re-run: the job is unscheduled by name first (pg_cron has no
-- CREATE OR REPLACE for jobs).

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'calendar-sync-last-1on1-daily') THEN
    PERFORM cron.unschedule('calendar-sync-last-1on1-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'calendar-sync-last-1on1-daily',
  '30 5 * * *', -- 05:30 UTC every day = 07:30 SAST
  $$
  SELECT net.http_post(
    url := 'https://kveiflphktpvsddhkspz.supabase.co/functions/v1/sync-last-1on1-dates',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<YOUR_CRON_SECRET>'),
    body := '{}'::jsonb
  );
  $$
);
