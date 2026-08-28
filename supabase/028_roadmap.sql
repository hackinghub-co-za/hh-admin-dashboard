-- Hacking Hub Admin Dashboard - Role-Specific Roadmap Checklists
-- Run this in the Supabase SQL Editor after 002-027 have already been applied.
-- Safe to re-run: every statement is idempotent.
--
-- Replaces the hardcoded, blurred "My Roadmap" dashboard tile with a real,
-- coach-curated checklist per member. Each member is assigned a track
-- (roadmap_track on member_profiles - SOC, Offensive Security, Cloud
-- Security, DevSecOps) and a set of roadmap_items, grouped into a "Core
-- Foundations" phase and a "Specialization" phase, further grouped by a
-- free-text category (e.g. "Certifications", "Networking", "Red Teaming").
--
-- Admins fully author the checklist (title, phase, category, ordering) - a
-- member can mark their own items done/not done and self-report progress
-- (detail) and a due_date on them, but never touch the plan itself (title,
-- phase, category, or anyone else's row). A member's row-level UPDATE policy
-- can't express "these columns only" - authenticated already has full table
-- privileges by Supabase's own default, same as every other table in this
-- project, so a plain RLS UPDATE policy here would let a member rewrite
-- their own title/phase/category too, not just completed/detail/due_date.
-- Instead both writes go through SECURITY DEFINER functions below
-- (toggle_my_roadmap_item, update_my_roadmap_item_progress), the same
-- explicit-ownership-check pattern already used for rsvp_for_event() and
-- submit_exit_feedback() - each only ever touches its own specific columns,
-- no matter what a client sends.
--
-- member_profiles.specialty (a member's self-described "about me" badge,
-- SPECIALTIES in src/lib/memberOptions.js) is kept in the same vocabulary as
-- roadmap_track below, so assigning one always matches the other - it used
-- to diverge (Red Team/Blue Team there vs Offensive Security/SOC here). Any
-- already-stored 'Red Team'/'Blue Team' rows are renamed below so no
-- existing member's profile silently shows a value that's no longer a valid
-- dropdown option.

ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS roadmap_track TEXT;

UPDATE public.member_profiles SET specialty = 'Offensive Security' WHERE specialty = 'Red Team';
UPDATE public.member_profiles SET specialty = 'SOC' WHERE specialty = 'Blue Team';

CREATE TABLE IF NOT EXISTS public.roadmap_items (
  id BIGSERIAL PRIMARY KEY,
  member_email TEXT NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('Core Foundations', 'Specialization')),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT,
  due_date DATE,
  completed BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Adds due_date to a database where this table already existed - the inline
-- column above only takes effect on a fresh CREATE TABLE.
ALTER TABLE public.roadmap_items ADD COLUMN IF NOT EXISTS due_date DATE;

ALTER TABLE public.roadmap_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read own roadmap" ON public.roadmap_items;
CREATE POLICY "members read own roadmap"
  ON public.roadmap_items FOR SELECT
  TO authenticated
  USING (
    member_email = lower(auth.jwt() ->> 'email')
    AND public.is_member_allowed(auth.jwt() ->> 'email')
  );

-- No member INSERT/UPDATE/DELETE policy - the plan is admin-authored only.
-- Members mark items done via toggle_my_roadmap_item() below, not a direct
-- table write.
DROP POLICY IF EXISTS "admins manage roadmap" ON public.roadmap_items;
CREATE POLICY "admins manage roadmap"
  ON public.roadmap_items FOR ALL
  USING (public.is_admin(auth.uid()));

-- Lets a member flip completion on exactly one of their own items - never
-- the title, detail, phase, or anyone else's row, regardless of what a
-- crafted request tries to pass.
CREATE OR REPLACE FUNCTION public.toggle_my_roadmap_item(p_item_id BIGINT, p_completed BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.roadmap_items
  SET completed = p_completed, updated_at = timezone('utc'::text, now())
  WHERE id = p_item_id AND member_email = lower(auth.jwt() ->> 'email');
END;
$$;
GRANT EXECUTE ON FUNCTION public.toggle_my_roadmap_item(BIGINT, BOOLEAN) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.toggle_my_roadmap_item(BIGINT, BOOLEAN) FROM PUBLIC, anon;

-- Same pattern as toggle_my_roadmap_item() above, widened to also let a
-- member self-report how far along one of their own items is (a number or
-- percentage, e.g. "3/6" or "45%" - reuses the existing `detail` column
-- rather than adding a second free-text field for the same idea) and set its
-- due date. Still never touches title/phase/category/completed, and still
-- only ever the caller's own row.
CREATE OR REPLACE FUNCTION public.update_my_roadmap_item_progress(p_item_id BIGINT, p_detail TEXT, p_due_date DATE)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.roadmap_items
  SET detail = p_detail, due_date = p_due_date, updated_at = timezone('utc'::text, now())
  WHERE id = p_item_id AND member_email = lower(auth.jwt() ->> 'email');
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_my_roadmap_item_progress(BIGINT, TEXT, DATE) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.update_my_roadmap_item_progress(BIGINT, TEXT, DATE) FROM PUBLIC, anon;

-- member_profiles has no member-facing SELECT policy at all (see
-- 010_member_directory.sql's get_member_directory() for why - the table
-- holds money_owed, phone, offboarding notes, etc. that a member should
-- never read even about themselves via a broad policy). This is the same
-- narrow-exposure pattern as has_completed_onboarding(): one column, one
-- row, the caller's own.
CREATE OR REPLACE FUNCTION public.get_my_roadmap_track()
RETURNS TEXT
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT roadmap_track FROM public.member_profiles WHERE email = lower(auth.jwt() ->> 'email');
$$;
GRANT EXECUTE ON FUNCTION public.get_my_roadmap_track() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_roadmap_track() FROM PUBLIC, anon;

-- =========================================================================
-- "GONE QUIET" EMAIL REMINDER (Feature C of the roadmap accountability
-- plan) - reaches a member who's stopped opening the portal entirely, which
-- the in-app banner above structurally can't do. Sent by
-- supabase/functions/roadmap-reminder-email, triggered daily by pg_cron
-- (see 047_roadmap_reminder_cron.sql).
-- =========================================================================

-- sent_at now just gates against sending more than once on the same
-- calendar day (the checkpoint logic below already decides *which* days
-- qualify) - not a fixed N-day cooldown like the first version of this
-- feature had. disengagement_alert_sent_at is the same idea for the
-- separate admin-facing alert. opted_out is a one-click, no-login-required
-- unsubscribe.
ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS roadmap_reminder_sent_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS roadmap_reminder_opted_out BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS roadmap_disengagement_alert_sent_at TIMESTAMP WITH TIME ZONE;

-- Anonymous, no-token unsubscribe - has to work from a cold click in an
-- email client with no Supabase session at all, unlike every other write in
-- this project. Skips the usual ownership-token dance deliberately: the
-- worst case of someone unsubscribing a member they don't own is that
-- member keeps getting nudged via the in-app banner instead of email - no
-- security or financial exposure, so the extra complexity isn't worth it.
CREATE OR REPLACE FUNCTION public.unsubscribe_from_roadmap_reminders(p_email TEXT)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.member_profiles
  SET roadmap_reminder_opted_out = true
  WHERE email = lower(p_email);
$$;
GRANT EXECUTE ON FUNCTION public.unsubscribe_from_roadmap_reminders(TEXT) TO anon, authenticated;

-- Everything the reminder function needs to decide who to email, computed
-- server-side rather than joined client-side in Deno - much cheaper than
-- fetching every member_profiles row plus every roadmap_items row and
-- joining them in JS for what's really a single aggregate query. Callable by
-- the service role (the edge function; bypasses this check entirely, same
-- as every other SECURITY DEFINER function in this project once called via
-- the service-role client) or by an admin - never by an ordinary member,
-- since this reveals exactly who's struggling.
--
-- Cadence (founder-specified, 2026-08):
--   - A member in their first 30 days ("newcomer" - manual_start_date or
--     onboarded_at, whichever's on file, within the last 30 days) gets
--     checked every 3 days: day 3, 6, 9, ... up to day 30. New members lose
--     momentum fast, so this checks in far more often than the standard
--     cadence below.
--   - Everyone else gets exactly 4 touches: day 7, 14, 21, and 30.
--   - Both are exact-day matches, not "at least N days" - since
--     days_since_touch increments by exactly 1 per day and this runs once
--     daily (047_roadmap_reminder_cron.sql), each checkpoint fires on
--     exactly one calendar day, which is what naturally makes this
--     idempotent without needing to remember "which checkpoint was this
--     already sent for". roadmap_reminder_sent_at only needs to block a
--     second send on that same day (e.g. the cron firing twice by
--     accident), not track cadence itself.
--   - needs_disengagement_alert flags day 21 specifically, for both
--     populations (21 is also a multiple of 3, so a newcomer hits it too) -
--     the point in either cadence where "just remind them" stops being
--     enough and a human should know.
CREATE OR REPLACE FUNCTION public.get_stale_roadmap_members_for_reminder()
RETURNS TABLE (
  email TEXT,
  full_name TEXT,
  job_readiness TEXT,
  days_since_touch INT,
  is_newcomer BOOLEAN,
  needs_disengagement_alert BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated' AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can view this.';
  END IF;

  RETURN QUERY
  WITH touches AS (
    SELECT
      mp.email,
      mp.full_name,
      mp.job_readiness,
      EXTRACT(DAY FROM (timezone('utc'::text, now()) - MAX(ri.updated_at)))::INT AS days_since_touch,
      (
        COALESCE(mp.manual_start_date, mp.onboarded_at::date) IS NOT NULL
        AND COALESCE(mp.manual_start_date, mp.onboarded_at::date) > (timezone('utc'::text, now())::date - 30)
      ) AS is_newcomer,
      mp.roadmap_reminder_sent_at,
      mp.roadmap_disengagement_alert_sent_at
    FROM public.member_profiles mp
    JOIN public.roadmap_items ri ON ri.member_email = mp.email
    WHERE mp.status IN ('Active', 'Active (Permanent)')
      AND mp.roadmap_reminder_opted_out = false
    GROUP BY mp.email, mp.full_name, mp.job_readiness, mp.manual_start_date, mp.onboarded_at,
      mp.roadmap_reminder_sent_at, mp.roadmap_disengagement_alert_sent_at
  )
  SELECT
    t.email,
    t.full_name,
    t.job_readiness,
    t.days_since_touch,
    t.is_newcomer,
    (
      t.days_since_touch = 21
      AND (t.roadmap_disengagement_alert_sent_at IS NULL OR t.roadmap_disengagement_alert_sent_at::date < timezone('utc'::text, now())::date)
    ) AS needs_disengagement_alert
  FROM touches t
  WHERE (t.roadmap_reminder_sent_at IS NULL OR t.roadmap_reminder_sent_at::date < timezone('utc'::text, now())::date)
    AND t.days_since_touch > 0
    AND t.days_since_touch <= 30
    AND (
      (t.is_newcomer AND t.days_since_touch % 3 = 0)
      OR (NOT t.is_newcomer AND t.days_since_touch IN (7, 14, 21, 30))
    );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_stale_roadmap_members_for_reminder() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_stale_roadmap_members_for_reminder() FROM PUBLIC, anon;
DROP FUNCTION IF EXISTS public.get_stale_roadmap_members_for_reminder(INT);

-- Records that a reminder actually went out - same admin-or-service-role
-- gate as above, so an ordinary member can't suppress another member's
-- reminders without going through the real unsubscribe path.
CREATE OR REPLACE FUNCTION public.mark_roadmap_reminder_sent(p_email TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated' AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can do this.';
  END IF;

  UPDATE public.member_profiles
  SET roadmap_reminder_sent_at = timezone('utc'::text, now())
  WHERE email = lower(p_email);
END;
$$;
GRANT EXECUTE ON FUNCTION public.mark_roadmap_reminder_sent(TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_roadmap_reminder_sent(TEXT) FROM PUBLIC, anon;

-- Records that the 21-day disengagement alert went out to the founder -
-- same shape and same reasoning as mark_roadmap_reminder_sent above, just
-- for the separate admin-facing alert instead of the member-facing email.
CREATE OR REPLACE FUNCTION public.mark_roadmap_disengagement_alert_sent(p_email TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated' AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can do this.';
  END IF;

  UPDATE public.member_profiles
  SET roadmap_disengagement_alert_sent_at = timezone('utc'::text, now())
  WHERE email = lower(p_email);
END;
$$;
GRANT EXECUTE ON FUNCTION public.mark_roadmap_disengagement_alert_sent(TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_roadmap_disengagement_alert_sent(TEXT) FROM PUBLIC, anon;
