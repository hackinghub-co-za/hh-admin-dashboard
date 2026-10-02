-- Hacking Hub Admin Dashboard - Take a Break
-- Run this in the Supabase SQL Editor after 002-094 have already been
-- applied. Safe to re-run: every statement is idempotent.
--
-- Burnout-awareness feature: a member can self-start a fixed-length break
-- (3/7/14 days chosen client-side, 1-30 enforced server-side) that resumes
-- on its own - no "I'm back" button, no early-end, by founder design.
-- Deliberately NOT modeled as member_profiles.status - status is an
-- access/offboarding lifecycle field is_member_allowed() and a dozen+
-- other call sites key off, and overloading it here would risk breaking
-- login access. Instead these are two new, independent, nullable columns.
-- break_until is the SAST calendar date the break ends on (inclusive -
-- that whole day still counts as paused); NULL means "not on a break".
-- Every system below adds its own explicit
-- "break_until IS NULL OR break_until < today" style exclusion - no change
-- to status anywhere, no change to is_member_allowed().

ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS break_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS break_until DATE;

-- =========================================================================
-- START A BREAK (member-facing)
-- =========================================================================
-- p_days is bound-checked here, not trusted from the client - same
-- "re-validate server-side" convention as log_study_session()'s
-- planned_minutes check (081_study_sessions.sql). The UI only ever offers
-- 3/7/14-day presets; this function just needs a sane outer bound so a
-- tampered request can't set a break to e.g. 9999 days.
CREATE OR REPLACE FUNCTION public.start_my_break(p_days INTEGER)
RETURNS DATE
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_today DATE := (now() AT TIME ZONE 'Africa/Johannesburg')::date;
  v_break_until DATE;
BEGIN
  IF p_days IS NULL OR p_days < 1 OR p_days > 30 THEN
    RAISE EXCEPTION 'Break length must be between 1 and 30 days.';
  END IF;

  v_break_until := v_today + p_days;

  UPDATE public.member_profiles
  SET break_started_at = now(),
      break_until = v_break_until
  WHERE email = v_email;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member profile not found.';
  END IF;

  RETURN v_break_until;
END;
$$;
GRANT EXECUTE ON FUNCTION public.start_my_break(INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.start_my_break(INTEGER) FROM PUBLIC, anon;

-- The caller's own break status, for the Dashboard button/status-indicator
-- - same narrow SECURITY DEFINER + own-row-only pattern as
-- get_my_start_date(). member_profiles has no member-facing SELECT policy
-- at all, so this is the only way the member's own portal can see these
-- two columns. LANGUAGE sql, not plpgsql - table-qualified mp.* references
-- only, no RETURNS TABLE/variable collision risk.
CREATE OR REPLACE FUNCTION public.get_my_break_status()
RETURNS TABLE (break_started_at TIMESTAMP WITH TIME ZONE, break_until DATE)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT mp.break_started_at, mp.break_until
  FROM public.member_profiles mp
  WHERE mp.email = lower(auth.jwt() ->> 'email');
$$;
GRANT EXECUTE ON FUNCTION public.get_my_break_status() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_break_status() FROM PUBLIC, anon;

-- =========================================================================
-- 1. ACCOUNTABILITY CHECK-INS - don't show "Due" / don't digest while paused
-- =========================================================================
-- Identical to 091_accountability_checkins.sql's body except for the one
-- added break exclusion (mp.break_until added to GROUP BY since it's now
-- referenced alongside an aggregate HAVING clause).
DROP FUNCTION IF EXISTS public.get_accountability_due(INTEGER);
CREATE FUNCTION public.get_accountability_due(p_days INTEGER DEFAULT 7)
RETURNS TABLE (email TEXT, full_name TEXT, specialty TEXT, last_checkin_at TIMESTAMP WITH TIME ZONE, assigned_to TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE
AS $$
BEGIN
  IF auth.role() = 'authenticated' AND NOT public.is_community_manager(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins and community managers can view this.';
  END IF;
  RETURN QUERY
  SELECT
    al.member_email,
    mp.full_name,
    mp.specialty,
    MAX(ac.logged_at) AS last_checkin_at,
    al.assigned_to
  FROM public.accountability_list al
  LEFT JOIN public.member_profiles mp ON mp.email = al.member_email
  LEFT JOIN public.accountability_checkins ac ON ac.member_email = al.member_email
  GROUP BY al.member_email, mp.full_name, mp.specialty, mp.break_until, al.assigned_to
  HAVING (
      MAX(ac.logged_at) IS NULL
      OR (MAX(ac.logged_at) AT TIME ZONE 'Africa/Johannesburg')::date
         <= (now() AT TIME ZONE 'Africa/Johannesburg')::date - p_days
    )
    -- Take a Break (095): a member currently on a break is never "due" -
    -- today itself still counts as paused, hence the strict "<" below.
    AND (mp.break_until IS NULL OR mp.break_until < (now() AT TIME ZONE 'Africa/Johannesburg')::date)
  ORDER BY MAX(ac.logged_at) ASC NULLS FIRST;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_accountability_due(INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_accountability_due(INTEGER) FROM PUBLIC, anon;

-- Widened by one column (break_until) so the admin tab can both suppress
-- its own client-side "Due Today" flag for a paused member and show a
-- light "On a break until X" indicator next to them - the roster is the
-- only accountability RPC a community manager can call (they can't read
-- member_profiles directly). DROP first: the return shape changed, which
-- CREATE OR REPLACE can't do.
DROP FUNCTION IF EXISTS public.get_accountability_roster();
CREATE FUNCTION public.get_accountability_roster()
RETURNS TABLE (email TEXT, full_name TEXT, specialty TEXT, roadmap_track TEXT, headshot_url TEXT, break_until DATE)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE
AS $$
BEGIN
  IF NOT public.is_community_manager(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins and community managers can view this.';
  END IF;
  RETURN QUERY
  SELECT mp.email, mp.full_name, mp.specialty, mp.roadmap_track, mp.headshot_url, mp.break_until
  FROM public.member_profiles mp
  WHERE mp.status != 'Left'
  ORDER BY lower(coalesce(mp.full_name, mp.email));
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_accountability_roster() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_accountability_roster() FROM PUBLIC, anon;

-- sync_new_joiner_accountability() is deliberately left untouched - a
-- break shouldn't affect new-joiner auto-enrollment either way.

-- =========================================================================
-- 2. ROADMAP NUDGES - suppress Dashboard banner + reminder email while paused
-- =========================================================================
-- Identical to 079_roadmap_exclusions.sql's body except for the one added
-- break-exclusion line in the WHERE clause (alongside, not reusing,
-- roadmap_excluded_members - that's a separate, permanent, admin-managed
-- opt-out; this is a temporary self-service pause). break_until is
-- referenced pre-aggregation here (WHERE, not HAVING), so it needs no
-- GROUP BY addition.
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
      AND NOT EXISTS (SELECT 1 FROM public.roadmap_excluded_members rem WHERE rem.member_email = mp.email)
      -- Take a Break (095): today itself still counts as paused, hence the
      -- strict "<" below - same rule as every other exclusion in this file.
      AND (mp.break_until IS NULL OR mp.break_until < (now() AT TIME ZONE 'Africa/Johannesburg')::date)
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

-- =========================================================================
-- 3. LOGIN STREAK - freeze during the break, resume exactly where it left off
-- =========================================================================
-- Current behavior (032_login_streak.sql) is a single INSERT ... ON
-- CONFLICT comparing last_login_date against today. This adds one
-- early-return ("frozen": still inside an active break - leave the row
-- completely untouched, so neither does the streak grow for showing up
-- mid-break, nor does it reset for the days missed) and one more CASE
-- branch inside the existing update ("resume": the break has ended and the
-- streak was still alive going INTO it, so treat the gap as a continuation
-- - streak+1 - rather than a reset to 1).
CREATE OR REPLACE FUNCTION public.record_daily_login()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_today DATE := (now() AT TIME ZONE 'Africa/Johannesburg')::date;
  v_break_until DATE;
  v_break_started_at TIMESTAMP WITH TIME ZONE;
  v_current_streak INTEGER;
  v_new_streak INTEGER;
BEGIN
  SELECT break_until, break_started_at, login_streak
  INTO v_break_until, v_break_started_at, v_current_streak
  FROM public.member_profiles
  WHERE email = v_email;

  -- Frozen: still inside an active break (today itself still counts as
  -- paused, hence "<=") - return the streak exactly as it stood when the
  -- break began, without touching last_login_date/login_streak at all. A
  -- brand-new member with no row yet falls through to the INSERT below
  -- unaffected (v_break_until stays NULL, no error from the zero-row
  -- SELECT INTO).
  IF v_break_until IS NOT NULL AND v_today <= v_break_until THEN
    RETURN COALESCE(v_current_streak, 0);
  END IF;

  INSERT INTO public.member_profiles (email, login_streak, last_login_date, longest_login_streak)
  VALUES (v_email, 1, v_today, 1)
  ON CONFLICT (email) DO UPDATE SET
    login_streak = CASE
      WHEN public.member_profiles.last_login_date = v_today THEN public.member_profiles.login_streak
      WHEN public.member_profiles.last_login_date = v_today - 1 THEN public.member_profiles.login_streak + 1
      -- Resume: the break just ended (break_until is in the past) and the
      -- streak was still alive the day the break started (or the day
      -- before, same "one grace day" shape as the normal yesterday check
      -- above) - continue it rather than resetting, as if no days were
      -- missed.
      WHEN public.member_profiles.break_until IS NOT NULL
        AND public.member_profiles.break_until < v_today
        AND public.member_profiles.last_login_date >= (public.member_profiles.break_started_at AT TIME ZONE 'Africa/Johannesburg')::date - 1
        THEN public.member_profiles.login_streak + 1
      ELSE 1
    END,
    last_login_date = v_today,
    longest_login_streak = GREATEST(
      public.member_profiles.longest_login_streak,
      CASE
        WHEN public.member_profiles.last_login_date = v_today THEN public.member_profiles.login_streak
        WHEN public.member_profiles.last_login_date = v_today - 1 THEN public.member_profiles.login_streak + 1
        WHEN public.member_profiles.break_until IS NOT NULL
          AND public.member_profiles.break_until < v_today
          AND public.member_profiles.last_login_date >= (public.member_profiles.break_started_at AT TIME ZONE 'Africa/Johannesburg')::date - 1
          THEN public.member_profiles.login_streak + 1
        ELSE 1
      END
    )
  RETURNING login_streak INTO v_new_streak;

  INSERT INTO public.login_history (member_email, login_date)
  VALUES (v_email, v_today)
  ON CONFLICT (member_email, login_date) DO NOTHING;

  RETURN v_new_streak;
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_daily_login() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.record_daily_login() FROM PUBLIC, anon;

-- =========================================================================
-- 4. TRYHACKME COMPETITION - exempt from this week's Monday elimination sweep
-- =========================================================================
-- Identical to 070_competition_seasons.sql's body except for the added
-- JOIN + break-exclusion line - a paused member is simply skipped by the
-- sweep entirely (not evaluated, not opted out), not given a special
-- "exempt" flag anywhere. get_competition_prize_eligibility() itself is
-- deliberately left untouched - the policy change belongs only in the
-- enforcement function, not the pure-computation eligibility check.
CREATE OR REPLACE FUNCTION public.eliminate_ineligible_competition_members()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.competition_standings cs
  SET opted_out = true
  FROM public.get_competition_prize_eligibility() e
  LEFT JOIN public.member_profiles mp ON mp.email = e.email
  WHERE cs.email = e.email
    AND e.eligible = false
    AND cs.opted_out = false
    -- Take a Break (095): today itself still counts as paused, hence the
    -- strict "<" below - same rule as every other exclusion in this file.
    AND (mp.break_until IS NULL OR mp.break_until < (now() AT TIME ZONE 'Africa/Johannesburg')::date);
END;
$$;
-- No cron re-schedule needed - eliminate-ineligible-competition-members-
-- weekly already exists (070_competition_seasons.sql) and just calls this
-- function by name; CREATE OR REPLACE above is enough.
