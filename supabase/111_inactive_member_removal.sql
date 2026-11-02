-- Hacking Hub Admin Dashboard - Remove members who have not signed in for 60 days
-- Run this in the Supabase SQL Editor after 002-110 have already been
-- applied, AFTER deploying the edge function:
--   supabase functions deploy inactive-members-sweep --no-verify-jwt
-- Safe to re-run: the functions are replaced and the cron job is
-- unscheduled by name first.
--
-- Every morning at 06:30 SAST the sweep does two things, in this order:
--  1. REMOVE anyone who was warned at least 3 days ago and is still at
--     60+ days without a sign-in. Removing means status = 'Left': the
--     allow-list is member_profiles (004_member_access_control.sql), so a
--     'Left' row is refused at the next sign-in, and a session that is
--     already open is cut off at its next token refresh. The row is kept,
--     so an admin can put the member back by changing the status.
--  2. WARN: email the founder the list of everyone who reached 57 days with
--     no sign-in, so they have 3 days before they are removed. Nobody is
--     removed who was not on an email at least 3 days earlier.
-- Signing in at any point after the warning cancels the removal, and a
-- fresh warning is needed if they go quiet again.
--
-- Rules:
--  - Last sign-in = the latest of member_profiles.last_login_date and
--    login_history. A member who has never signed in is counted from when
--    they started (manual start date, first-login intro, profile created,
--    or first payment, in that order). Anyone with none of those dates is
--    skipped rather than guessed at.
--  - Only Active and Active (Permanent) members are looked at.
--  - Anyone who has paid (PayFast or EFT) in the last 60 days is spared, even
--    if they never sign in. A payment after a warning cancels the removal.
--  - Mentors are the only other exemption: anyone with the mentor role, or
--    with inactivity_exempt set on their member row. A staff account (admin or community
--    manager) bypasses the allow-list, so removing its member row does not
--    lock it out of the staff side.
-- All functions are callable only by the service role (the edge function).

ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS inactivity_warned_at TIMESTAMPTZ,
  -- Set by hand for members who must never be swept, such as mentors who
  -- are community members without the mentor role in profiles.
  ADD COLUMN IF NOT EXISTS inactivity_exempt BOOLEAN NOT NULL DEFAULT false;

-- Who to warn today and who to remove today. Read-only.
CREATE OR REPLACE FUNCTION public.inactivity_candidates()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_today DATE := (now() AT TIME ZONE 'Africa/Johannesburg')::date;
  v_result JSONB;
BEGIN
  WITH first_pay AS (
    SELECT email, min(d) AS d, max(d) AS last_d FROM (
      SELECT lower(email) AS email, (paid_at AT TIME ZONE 'Africa/Johannesburg')::date AS d
      FROM public.payfast_transactions WHERE payment_status = 'COMPLETE'
      UNION ALL
      SELECT lower(email), (date AT TIME ZONE 'Africa/Johannesburg')::date
      FROM public.eft_payments WHERE status = 'COMPLETE'
    ) x GROUP BY email
  ),
  m AS (
    SELECT mp.email, NULLIF(btrim(mp.full_name), '') AS full_name, mp.status, mp.inactivity_warned_at, mp.inactivity_exempt,
      GREATEST(mp.last_login_date, (SELECT max(h.login_date) FROM public.login_history h WHERE lower(h.member_email) = mp.email)) AS last_login,
      COALESCE(
        GREATEST(mp.last_login_date, (SELECT max(h.login_date) FROM public.login_history h WHERE lower(h.member_email) = mp.email)),
        mp.manual_start_date, mp.onboarded_at::date, p.created_at::date, fp.d
      ) AS last_seen,
      COALESCE(mp.manual_start_date, mp.onboarded_at::date, p.created_at::date, fp.d) AS joined,
      p.role, fp.last_d AS last_payment,
      (SELECT pay.plan FROM public.payfast_transactions pay WHERE lower(pay.email) = mp.email AND pay.payment_status = 'COMPLETE' ORDER BY pay.paid_at DESC LIMIT 1) AS last_plan
    FROM public.member_profiles mp
    LEFT JOIN public.profiles p ON lower(p.email) = mp.email
    LEFT JOIN first_pay fp ON fp.email = mp.email
    WHERE mp.status IN ('Active', 'Active (Permanent)')
  ),
  x AS (
    SELECT *, v_today - last_seen AS days_inactive FROM m
    WHERE last_seen IS NOT NULL AND COALESCE(role, 'member') <> 'mentor'
      AND (last_payment IS NULL OR v_today - last_payment > 60)
      AND NOT inactivity_exempt
  )
  SELECT jsonb_build_object(
    'today', v_today,
    'warn', (SELECT COALESCE(jsonb_agg(jsonb_build_object('email', email, 'name', full_name, 'status', status, 'plan', last_plan,
                'joined', joined, 'last_login', last_login, 'last_payment', last_payment, 'days_inactive', days_inactive,
                'removal_date', v_today + 3) ORDER BY days_inactive DESC), '[]'::jsonb)
             FROM x
             WHERE days_inactive >= 57 AND (inactivity_warned_at IS NULL OR (inactivity_warned_at AT TIME ZONE 'Africa/Johannesburg')::date < last_seen)),
    'remove', (SELECT COALESCE(jsonb_agg(jsonb_build_object('email', email, 'name', full_name, 'status', status, 'plan', last_plan,
                'joined', joined, 'last_login', last_login, 'last_payment', last_payment, 'days_inactive', days_inactive,
                'warned_at', inactivity_warned_at) ORDER BY days_inactive DESC), '[]'::jsonb)
             FROM x
             WHERE days_inactive >= 60 AND inactivity_warned_at IS NOT NULL
               AND (inactivity_warned_at AT TIME ZONE 'Africa/Johannesburg')::date >= last_seen
               AND (inactivity_warned_at AT TIME ZONE 'Africa/Johannesburg')::date <= v_today - 3)
  ) INTO v_result;
  RETURN v_result;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.inactivity_candidates() FROM PUBLIC, anon, authenticated;

-- Records that these members were on today's warning email. Only called
-- after the email has gone out, and only for members who are still due.
CREATE OR REPLACE FUNCTION public.mark_inactivity_warned(p_emails TEXT[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_due TEXT[];
  v_n INTEGER;
BEGIN
  SELECT COALESCE(array_agg(w ->> 'email'), '{}') INTO v_due
  FROM jsonb_array_elements(public.inactivity_candidates() -> 'warn') w;
  UPDATE public.member_profiles SET inactivity_warned_at = now()
  WHERE email = ANY (v_due) AND email = ANY (SELECT lower(e) FROM unnest(p_emails) e);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.mark_inactivity_warned(TEXT[]) FROM PUBLIC, anon, authenticated;

-- Removes members from the allow-list (status = 'Left'). Only removes someone
-- who is due right now by the rules above, whatever the caller passes in.
CREATE OR REPLACE FUNCTION public.remove_inactive_members(p_emails TEXT[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_due TEXT[];
  v_removed JSONB;
BEGIN
  SELECT COALESCE(array_agg(r ->> 'email'), '{}') INTO v_due
  FROM jsonb_array_elements(public.inactivity_candidates() -> 'remove') r;

  WITH gone AS (
    UPDATE public.member_profiles SET
      status = 'Left',
      left_at = now(),
      offboarding_reason = 'Inactive for 60 days',
      offboarding_notes = COALESCE(NULLIF(offboarding_notes, '') || E'\n', '') || 'Removed automatically after 60 days without signing in.',
      updated_at = now()
    WHERE email = ANY (v_due) AND email = ANY (SELECT lower(e) FROM unnest(p_emails) e)
    RETURNING email, full_name
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object('email', email, 'name', NULLIF(btrim(full_name), ''))), '[]'::jsonb) INTO v_removed FROM gone;
  RETURN v_removed;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.remove_inactive_members(TEXT[]) FROM PUBLIC, anon, authenticated;

-- Every day at 04:30 UTC = 06:30 SAST. Same template trick as
-- 092_accountability_digest_cron.sql: the command is built from the
-- already-scheduled overdue-1on1-digest-daily job with only the function
-- name swapped, so the cron secret is reused and never pasted here.
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

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'inactive-members-sweep-daily') THEN
    PERFORM cron.unschedule('inactive-members-sweep-daily');
  END IF;

  PERFORM cron.schedule(
    'inactive-members-sweep-daily',
    '30 4 * * *', -- 04:30 UTC every day = 06:30 SAST
    replace(v_template, '/functions/v1/overdue-1on1-digest', '/functions/v1/inactive-members-sweep')
  );
END $$;
