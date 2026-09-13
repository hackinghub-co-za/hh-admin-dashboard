-- Hacking Hub Admin Dashboard - Roadmap Exclusions
-- Run this in the Supabase SQL Editor after 002-078 have already been
-- applied. Safe to re-run: every statement is idempotent.
--
-- Some members genuinely aren't interested in the Roadmap/certification
-- track of the program - this is an admin-managed opt-out list so those
-- members stop being shown My Roadmap, its Dashboard preview tile, the
-- "gone quiet" nudge, and the roadmap-reminder email nudge, and stop being
-- auto-assigned Core Foundations items or counted in the admin Stale
-- Roadmaps queue. Same shape as focus_five (038_focus_five.sql): a plain
-- admin-managed table, no per-member migration needed to add or remove
-- someone - that's what the new admin UI is for.

CREATE TABLE IF NOT EXISTS public.roadmap_excluded_members (
  id BIGSERIAL PRIMARY KEY,
  member_email TEXT NOT NULL UNIQUE,
  added_by TEXT,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.roadmap_excluded_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins manage roadmap exclusions" ON public.roadmap_excluded_members;
CREATE POLICY "admins manage roadmap exclusions"
  ON public.roadmap_excluded_members FOR ALL
  USING (public.is_admin(auth.uid()));

-- A member only ever needs to know about their OWN row (to decide
-- whether to hide their own My Roadmap tab), same "own row only" shape as
-- focus_five's member-facing SELECT policy - never a way to see who else
-- is on the list.
DROP POLICY IF EXISTS "members check own roadmap exclusion status" ON public.roadmap_excluded_members;
CREATE POLICY "members check own roadmap exclusion status"
  ON public.roadmap_excluded_members FOR SELECT
  USING (member_email = lower(auth.jwt() ->> 'email'));

-- Patches get_stale_roadmap_members_for_reminder() (028_roadmap.sql,
-- powers the roadmap-reminder-email cron) to skip anyone on this new
-- exclusion list - identical to the original function body except for the
-- one added NOT EXISTS clause below. Patched here (a later migration)
-- rather than by editing 028_roadmap.sql directly, since this table
-- doesn't exist yet at the point 028 would run on a fresh database.
CREATE OR REPLACE FUNCTION public.get_stale_roadmap_members_for_reminder()
RETURNS TABLE (
  email TEXT,
  full_name TEXT,
  job_readiness TEXT,
  days_since_touch INT,
  is_newcomer BOOLEAN,
  is_on_track BOOLEAN,
  days_since_joined INT,
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
      (timezone('utc'::text, now())::date - COALESCE(mp.manual_start_date, mp.onboarded_at::date))::INT AS days_since_joined,
      mp.roadmap_reminder_sent_at,
      mp.roadmap_disengagement_alert_sent_at
    FROM public.member_profiles mp
    LEFT JOIN public.roadmap_items ri ON ri.member_email = mp.email
    WHERE mp.status IN ('Active', 'Active (Permanent)')
      AND mp.roadmap_reminder_opted_out = false
      -- The one addition over the original 028_roadmap.sql body: a member
      -- who's opted out of the Roadmap track entirely shouldn't get
      -- nudged back to something they were never trying to use.
      AND NOT EXISTS (SELECT 1 FROM public.roadmap_excluded_members rem WHERE rem.member_email = mp.email)
    GROUP BY mp.email, mp.full_name, mp.job_readiness, mp.manual_start_date, mp.onboarded_at,
      mp.roadmap_reminder_sent_at, mp.roadmap_disengagement_alert_sent_at
  )
  SELECT
    t.email,
    t.full_name,
    t.job_readiness,
    t.days_since_touch,
    t.is_newcomer,
    (t.days_since_touch IS NULL OR t.days_since_touch <= 2) AS is_on_track,
    t.days_since_joined,
    (
      t.days_since_touch = 21
      AND (t.roadmap_disengagement_alert_sent_at IS NULL OR t.roadmap_disengagement_alert_sent_at::date < timezone('utc'::text, now())::date)
    ) AS needs_disengagement_alert
  FROM touches t
  WHERE (t.roadmap_reminder_sent_at IS NULL OR t.roadmap_reminder_sent_at::date < timezone('utc'::text, now())::date)
    AND (
      (t.is_newcomer AND t.days_since_joined > 0 AND t.days_since_joined <= 30 AND t.days_since_joined % 3 = 0)
      OR (NOT t.is_newcomer AND t.days_since_touch > 0 AND t.days_since_touch <= 30 AND t.days_since_touch IN (7, 14, 21, 30))
    );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_stale_roadmap_members_for_reminder() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_stale_roadmap_members_for_reminder() FROM PUBLIC, anon;
