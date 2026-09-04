-- Hacking Hub Admin Dashboard - Weekly LinkedIn Post Confirmation + Reminder Cron
-- Run after 002-058 have already been applied. Safe to re-run.
--
-- Adds a one-click "Mark as Posted This Week" confirmation on the
-- roadmap's "Post once a week" item. src/lib/linkedInPlaybookData.js on
-- the client computes "which of the 12 rotating weeks is it right now"
-- from the ISO week number (`(isoWeek - 1) % 12`); this table's row key
-- uses the same ISO-week boundary from the Postgres side - the Monday of
-- the current ISO week (`date_trunc('week', now())`) - so both sides
-- always agree on "this week" without any per-member anchor date to track.
--
-- Same member-owned-but-write-sensitive pattern as member_interviews
-- (058_member_interviews.sql) and roadmap_items: members get SELECT-only
-- RLS on their own rows, admins get FOR ALL, and the only write path is a
-- SECURITY DEFINER RPC that hardcodes the caller's own email server-side.
--
-- Also schedules the weekly reminder email (was a separate
-- 060_linkedin_reminder_cron.sql, folded in here - one file for the whole
-- feature). Run this LAST within the feature: after
-- linkedin-post-reminder-email has already been deployed (see that
-- function's header comment for the secrets it needs first -
-- RESEND_API_KEY, CRON_SECRET - both can be reused from
-- roadmap-reminder-email if already set, no need for new values).
--
-- BEFORE RUNNING: replace both placeholders in the cron block at the
-- bottom of this file with real values.
--   1. <YOUR_PROJECT_REF> - your Supabase project ref, i.e. the
--      subdomain in your project URL (https://<YOUR_PROJECT_REF>.supabase.co)
--   2. <YOUR_CRON_SECRET> - the exact value you ran
--      `supabase secrets set CRON_SECRET=...` with for linkedin-post-reminder-email

CREATE TABLE IF NOT EXISTS public.linkedin_weekly_posts (
  id BIGSERIAL PRIMARY KEY,
  member_email TEXT NOT NULL,
  week_start DATE NOT NULL,
  confirmed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (member_email, week_start)
);

CREATE INDEX IF NOT EXISTS idx_linkedin_weekly_posts_member_week
  ON public.linkedin_weekly_posts(member_email, week_start);

ALTER TABLE public.linkedin_weekly_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read own linkedin posts" ON public.linkedin_weekly_posts;
CREATE POLICY "members read own linkedin posts"
  ON public.linkedin_weekly_posts FOR SELECT
  TO authenticated
  USING (
    member_email = lower(auth.jwt() ->> 'email')
    AND public.is_member_allowed(auth.jwt() ->> 'email')
  );

DROP POLICY IF EXISTS "admins manage linkedin posts" ON public.linkedin_weekly_posts;
CREATE POLICY "admins manage linkedin posts"
  ON public.linkedin_weekly_posts FOR ALL
  USING (public.is_admin(auth.uid()));

-- One-click confirmation for the *current* ISO week - upsert so clicking it
-- twice in the same week is a harmless no-op, not a duplicate-row error
-- (the UNIQUE constraint above would reject a plain second INSERT).
CREATE OR REPLACE FUNCTION public.confirm_my_linkedin_post()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.linkedin_weekly_posts (member_email, week_start)
  VALUES (lower(auth.jwt() ->> 'email'), date_trunc('week', timezone('utc'::text, now()))::date)
  ON CONFLICT (member_email, week_start) DO NOTHING;
END;
$$;
GRANT EXECUTE ON FUNCTION public.confirm_my_linkedin_post() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.confirm_my_linkedin_post() FROM PUBLIC, anon;

-- Whether the caller has already confirmed for the current week - the
-- inline roadmap widget's "already posted" state.
CREATE OR REPLACE FUNCTION public.get_my_linkedin_post_status()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.linkedin_weekly_posts
    WHERE member_email = lower(auth.jwt() ->> 'email')
      AND week_start = date_trunc('week', timezone('utc'::text, now()))::date
  );
$$;
GRANT EXECUTE ON FUNCTION public.get_my_linkedin_post_status() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_linkedin_post_status() FROM PUBLIC, anon;

-- Admin-only equivalent of get_my_linkedin_post_status(), for any member -
-- keeps "what week is it" defined in exactly this one place, so the admin
-- side (MemberProfileModal.jsx) never has to re-derive Monday-of-week math
-- in JS just to compare against a fetched row.
CREATE OR REPLACE FUNCTION public.get_member_linkedin_post_status(p_email TEXT)
RETURNS TABLE (confirmed_this_week BOOLEAN, last_confirmed_at TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE
AS $$
BEGIN
  IF auth.role() = 'authenticated' AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can view this.';
  END IF;

  RETURN QUERY
  SELECT
    EXISTS (
      SELECT 1 FROM public.linkedin_weekly_posts
      WHERE member_email = lower(p_email)
        AND week_start = date_trunc('week', timezone('utc'::text, now()))::date
    ),
    (SELECT MAX(confirmed_at) FROM public.linkedin_weekly_posts WHERE member_email = lower(p_email));
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_member_linkedin_post_status(TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_member_linkedin_post_status(TEXT) FROM PUBLIC, anon;

-- =========================================================================
-- WEEKLY REMINDER EMAIL - reaches members who haven't confirmed yet this
-- week. Sent by supabase/functions/linkedin-post-reminder-email, triggered
-- weekly by the pg_cron job scheduled at the bottom of this file. Own,
-- separate opt-out column - deliberately not shared with roadmap_reminder_opted_out
-- (028_roadmap.sql), same "one opt-out per email type" convention already
-- used throughout this project, so unsubscribing from one email never
-- silently affects the other.
-- =========================================================================

ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS linkedin_reminder_opted_out BOOLEAN NOT NULL DEFAULT false;

-- Same shape/grant as unsubscribe_from_roadmap_reminders (028_roadmap.sql)
-- - a plain email-client click with no Supabase session, so anon needs to
-- be able to call this directly.
CREATE OR REPLACE FUNCTION public.unsubscribe_from_linkedin_reminders(p_email TEXT)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.member_profiles
  SET linkedin_reminder_opted_out = true
  WHERE email = lower(p_email);
$$;
GRANT EXECUTE ON FUNCTION public.unsubscribe_from_linkedin_reminders(TEXT) TO anon, authenticated;

-- Everyone active, opted in, and assigned a real track, who hasn't
-- confirmed for the current ISO week - a single aggregate query (an
-- anti-join against this week's confirmations), much cheaper than pulling
-- every member_profiles row into Deno and filtering there. Callable by the
-- service role (the edge function; bypasses this check entirely, same as
-- every other SECURITY DEFINER function here) or by an admin - never by an
-- ordinary member, since this reveals exactly who hasn't posted.
CREATE OR REPLACE FUNCTION public.get_members_needing_linkedin_reminder()
RETURNS TABLE (email TEXT, full_name TEXT, roadmap_track TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated' AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can view this.';
  END IF;

  RETURN QUERY
  SELECT mp.email, mp.full_name, mp.roadmap_track
  FROM public.member_profiles mp
  WHERE mp.status IN ('Active', 'Active (Permanent)')
    AND mp.linkedin_reminder_opted_out = false
    AND mp.roadmap_track IS NOT NULL
    AND mp.roadmap_track != 'Not Assigned'
    AND NOT EXISTS (
      SELECT 1 FROM public.linkedin_weekly_posts lwp
      WHERE lwp.member_email = mp.email
        AND lwp.week_start = date_trunc('week', timezone('utc'::text, now()))::date
    );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_members_needing_linkedin_reminder() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_members_needing_linkedin_reminder() FROM PUBLIC, anon;

-- =========================================================================
-- CRON - schedules the weekly run of linkedin-post-reminder-email. Safe to
-- re-run: the DO block below unschedules any existing job with this name
-- first, since pg_cron has no CREATE OR REPLACE for jobs. Remember to
-- replace <YOUR_PROJECT_REF> and <YOUR_CRON_SECRET> below with real values
-- before running (see this file's header comment).
-- =========================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'linkedin-post-reminder-weekly') THEN
    PERFORM cron.unschedule('linkedin-post-reminder-weekly');
  END IF;
END $$;

SELECT cron.schedule(
  'linkedin-post-reminder-weekly',
  '0 8 * * 2', -- 08:00 UTC every Tuesday - matches the playbook's own "post Tue-Thu, 8-10am" advice, with most of the week still ahead to act on it
  $$
  SELECT net.http_post(
    url := 'https://kveiflphktpvsddhkspz.supabase.co/functions/v1/linkedin-post-reminder-email',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '<YOUR_CRON_SECRET>'),
    body := '{}'::jsonb
  );
  $$
);
