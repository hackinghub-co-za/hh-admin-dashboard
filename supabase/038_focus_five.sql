-- Hacking Hub Admin Dashboard - Focus 5
-- Run this in the Supabase SQL Editor after 002-033 have already been applied.
-- Safe to re-run: every statement is idempotent.
--
-- The 5 members getting the most attention this month, editable from the
-- admin Dashboard tab instead of a hardcoded list in the source. Admin-only,
-- same "no member-facing view" reasoning as expenses/037_expenses.sql -
-- this is purely an internal coaching-priority list, not member-submitted
-- content, so there's no member policy at all.

CREATE TABLE IF NOT EXISTS public.focus_five (
  id BIGSERIAL PRIMARY KEY,
  member_email TEXT NOT NULL UNIQUE,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.focus_five ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins manage focus five" ON public.focus_five;
CREATE POLICY "admins manage focus five"
  ON public.focus_five FOR ALL
  USING (public.is_admin(auth.uid()));

-- 2026-11-10: "WE HAVEN'T SEEN YOU" REMINDER. Every morning the
-- focus-five-absence-email function nudges any Focus 5 member who hasn't
-- signed in to the portal for 3 full days (last_login_date at least 4 days
-- before today, SAST), and emails the founder who was nudged. Once per
-- absence: nudged_for_login stores the last_login_date the nudge was about
-- (1970-01-01 for someone who has never signed in), so nobody is nudged
-- again until they sign in and then go quiet again. Leaving or Left members
-- are skipped. Both functions are for the service role only.
ALTER TABLE public.focus_five ADD COLUMN IF NOT EXISTS nudged_for_login DATE;

CREATE OR REPLACE FUNCTION public.focus_five_absent_due()
RETURNS JSONB
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  WITH today AS (SELECT (now() AT TIME ZONE 'Africa/Johannesburg')::date AS d)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'email', lower(f.member_email),
    'name', COALESCE(NULLIF(btrim(mp.full_name), ''), lower(f.member_email)),
    'last_login', mp.last_login_date,
    'days_missed', (SELECT d FROM today) - COALESCE(mp.last_login_date, DATE '1970-01-01') - 1
  ) ORDER BY mp.last_login_date NULLS FIRST), '[]'::jsonb)
  FROM public.focus_five f
  JOIN public.member_profiles mp ON mp.email = lower(f.member_email)
  WHERE mp.status IN ('Active', 'Active (Permanent)')
    AND (SELECT d FROM today) - COALESCE(mp.last_login_date, DATE '1970-01-01') >= 4
    AND f.nudged_for_login IS DISTINCT FROM COALESCE(mp.last_login_date, DATE '1970-01-01');
$$;

CREATE OR REPLACE FUNCTION public.focus_five_mark_nudged(p_email TEXT, p_last_login DATE)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.focus_five
  SET nudged_for_login = COALESCE(p_last_login, DATE '1970-01-01')
  WHERE lower(member_email) = lower(p_email);
$$;

REVOKE EXECUTE ON FUNCTION public.focus_five_absent_due() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.focus_five_mark_nudged(TEXT, DATE) FROM PUBLIC, anon, authenticated;

-- Every day at 06:00 UTC = 08:00 SAST. Same template trick as
-- 111_inactive_member_removal.sql: built from the already-scheduled
-- overdue-1on1-digest-daily job with only the function name swapped, so the
-- cron secret is reused and never pasted here. Run only after
-- focus-five-absence-email has been deployed.
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

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'focus-five-absence-email-daily') THEN
    PERFORM cron.unschedule('focus-five-absence-email-daily');
  END IF;

  PERFORM cron.schedule(
    'focus-five-absence-email-daily',
    '0 6 * * *', -- 06:00 UTC every day = 08:00 SAST
    replace(v_template, '/functions/v1/overdue-1on1-digest', '/functions/v1/focus-five-absence-email')
  );
END $$;
