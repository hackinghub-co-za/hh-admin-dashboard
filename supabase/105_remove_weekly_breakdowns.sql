-- Hacking Hub Admin Dashboard - Remove Weekly Breakdowns
-- Run this in the Supabase SQL Editor after 002-104 have already been
-- applied. Safe to re-run: every statement is idempotent.
--
-- The Weekly Breakdowns feature (068_weekly_breakdowns.sql,
-- 069_weekly_breakdown_cron.sql) is retired: the Resources tab view, the
-- admin Community Content section, the weekly-breakdown-email,
-- breakdown-nudge and breakdown-unsubscribe edge functions are all gone.
-- This stops its two cron jobs and drops everything it created. 068/069
-- stay in the repo as history and must not be re-run after this file.
--
-- IRREVERSIBLE: drops weekly_breakdowns (the archived editions) and
-- member_profiles.breakdown_email_opted_out.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'weekly-breakdown-friday') THEN
    PERFORM cron.unschedule('weekly-breakdown-friday');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'breakdown-nudge-wednesday') THEN
    PERFORM cron.unschedule('breakdown-nudge-wednesday');
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.approve_weekly_breakdown(BIGINT);
DROP FUNCTION IF EXISTS public.unapprove_weekly_breakdown(BIGINT);
DROP FUNCTION IF EXISTS public.mark_weekly_breakdown_sent(BIGINT, INTEGER, BIGINT);
DROP FUNCTION IF EXISTS public.unsubscribe_from_breakdown_emails(TEXT);
DROP FUNCTION IF EXISTS public.get_breakdown_recipients();
DROP FUNCTION IF EXISTS public.get_breakdown_facilitator_emails();
DROP FUNCTION IF EXISTS public.get_approved_breakdown_for_date(DATE);

-- Dropping the table also drops its policies and its content-edit trigger.
DROP TABLE IF EXISTS public.weekly_breakdowns CASCADE;
DROP FUNCTION IF EXISTS public._guard_breakdown_content_edit();

ALTER TABLE public.member_profiles DROP COLUMN IF EXISTS breakdown_email_opted_out;
