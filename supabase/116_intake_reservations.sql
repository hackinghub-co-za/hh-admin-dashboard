-- Hacking Hub Admin Dashboard - Intake waiting list and R300 deposits
-- Run this in the Supabase SQL Editor after 002-115 have already been
-- applied. Safe to re-run: every statement is idempotent.
--
-- People secure a spot in a coming intake with a R300 deposit. The admin
-- "Intakes & Deposits" page (IntakeWaitingList.jsx) records each one in
-- intake_reservations against the intake it is for, and the public spots
-- counter (get_current_intake, 114/115) now counts them straight away.
--
-- A spot in an intake is taken by either:
--   - a reservation for that intake marked Reserved or Joined, or
--   - a first ever completed payment inside the intake's sign-up window by
--     someone with no reservation for a DIFFERENT intake (so a deposit paid
--     in November for January counts against January, not November).
-- Each person counts once (by email); a reservation with no email counts on
-- its own.
--
-- Intakes are still sign-up windows from the 16th to the next 15th, named
-- after the month they start (115). _intake_window() returns the stored row
-- for a day, or works the window out, using the most recent capacity.

-- =========================================================================
-- RESERVATIONS
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.intake_reservations (
  id BIGSERIAL PRIMARY KEY,
  intake_opens_on DATE NOT NULL,
  intake_name TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  deposit_amount NUMERIC NOT NULL DEFAULT 300 CHECK (deposit_amount >= 0),
  paid_on DATE NOT NULL DEFAULT (now() AT TIME ZONE 'Africa/Johannesburg')::date,
  method TEXT NOT NULL DEFAULT 'EFT' CHECK (method IN ('PayFast', 'EFT', 'Cash', 'Other')),
  payment_ref TEXT,
  status TEXT NOT NULL DEFAULT 'Reserved' CHECK (status IN ('Reserved', 'Joined', 'Cancelled')),
  notes TEXT,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS intake_reservations_intake_idx ON public.intake_reservations (intake_opens_on);
CREATE INDEX IF NOT EXISTS intake_reservations_email_idx ON public.intake_reservations (lower(email));

ALTER TABLE public.intake_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins manage intake reservations" ON public.intake_reservations;
CREATE POLICY "admins manage intake reservations" ON public.intake_reservations
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- Admins can also set a month's number of spots from the page.
DROP POLICY IF EXISTS "admins manage intakes" ON public.intakes;
CREATE POLICY "admins manage intakes" ON public.intakes
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- =========================================================================
-- WINDOWS AND COUNTS
-- =========================================================================

-- The intake whose sign-up window contains p_day: the stored row if there
-- is one, else the 16th-to-15th window named after the month it starts,
-- with the most recent stored capacity.
CREATE OR REPLACE FUNCTION public._intake_window(p_day DATE)
RETURNS TABLE (name TEXT, opens_on DATE, closes_on DATE, capacity INTEGER, stored BOOLEAN)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH s AS (
    SELECT i.name, i.opens_on, i.closes_on, i.capacity FROM public.intakes i
    WHERE p_day BETWEEN i.opens_on AND i.closes_on
    ORDER BY i.opens_on DESC
    LIMIT 1
  ),
  w AS (
    SELECT CASE WHEN extract(day FROM p_day) >= 16
                THEN date_trunc('month', p_day)::date + 15
                ELSE (date_trunc('month', p_day) - interval '1 month')::date + 15 END AS opens_on
  )
  SELECT s.name, s.opens_on, s.closes_on, s.capacity, true FROM s
  UNION ALL
  SELECT trim(to_char(w.opens_on + interval '1 month', 'FMMonth')),
         w.opens_on,
         (w.opens_on + interval '1 month' - interval '1 day')::date,
         COALESCE((SELECT capacity FROM public.intakes ORDER BY opens_on DESC LIMIT 1), 0),
         false
  FROM w
  WHERE NOT EXISTS (SELECT 1 FROM s);
$$;

-- How many spots in the intake opening on p_opens_on are taken, split into
-- reservations and first payers without one.
CREATE OR REPLACE FUNCTION public._intake_taken(p_opens_on DATE, p_closes_on DATE)
RETURNS TABLE (reserved INTEGER, paid_without_reservation INTEGER, taken INTEGER)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH pay AS (
    SELECT lower(email) AS email, (paid_at AT TIME ZONE 'Africa/Johannesburg')::date AS d
    FROM public.payfast_transactions WHERE payment_status = 'COMPLETE'
    UNION ALL
    SELECT lower(email), (date AT TIME ZONE 'Africa/Johannesburg')::date
    FROM public.eft_payments WHERE status = 'COMPLETE'
  ),
  first_pay AS (SELECT email, min(d) AS first_d FROM pay GROUP BY 1),
  res AS (
    SELECT lower(email) AS email FROM public.intake_reservations
    WHERE intake_opens_on = p_opens_on AND status IN ('Reserved', 'Joined')
  ),
  res_elsewhere AS (
    SELECT DISTINCT lower(email) AS email FROM public.intake_reservations
    WHERE intake_opens_on <> p_opens_on AND status IN ('Reserved', 'Joined') AND email IS NOT NULL
  ),
  payers AS (
    SELECT f.email FROM first_pay f
    WHERE f.first_d BETWEEN p_opens_on AND p_closes_on
      AND f.email NOT IN (SELECT email FROM res_elsewhere)
      AND f.email NOT IN (SELECT email FROM res WHERE email IS NOT NULL)
  )
  SELECT
    (SELECT count(*) FROM res)::int,
    (SELECT count(*) FROM payers)::int,
    ((SELECT count(*) FROM res) + (SELECT count(*) FROM payers))::int;
$$;

REVOKE EXECUTE ON FUNCTION public._intake_window(DATE) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._intake_taken(DATE, DATE) FROM PUBLIC, anon, authenticated;

-- Public: the intake to advertise and its spots left. Counts only, no
-- member data. Since 2026-11-27 it never advertises a full intake: if the
-- running one has no spots left it moves on to the next (up to 6 ahead), so
-- the website says "January intake: 10 spots left" instead of "December
-- intake is full". If every one of them is full it returns nothing and the
-- site hides the counter.
CREATE OR REPLACE FUNCTION public.get_current_intake()
RETURNS TABLE (name TEXT, closes_on DATE, capacity INTEGER, spots_left INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
#variable_conflict use_column
DECLARE
  v_day DATE := (now() AT TIME ZONE 'Africa/Johannesburg')::date;
  w RECORD;
  v_left INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    SELECT * INTO w FROM public._intake_window(v_day);
    EXIT WHEN NOT FOUND;
    IF w.capacity > 0 THEN
      SELECT GREATEST(0, w.capacity - t.taken)::int INTO v_left FROM public._intake_taken(w.opens_on, w.closes_on) t;
      IF v_left > 0 THEN
        name := w.name; closes_on := w.closes_on; capacity := w.capacity; spots_left := v_left;
        RETURN NEXT;
        RETURN;
      END IF;
    END IF;
    v_day := w.closes_on + 1;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_current_intake() TO anon, authenticated;

-- Admin: the running intake and the next p_count - 1, with their counts.
CREATE OR REPLACE FUNCTION public.get_intake_schedule(p_count INTEGER DEFAULT 3)
RETURNS TABLE (name TEXT, opens_on DATE, closes_on DATE, capacity INTEGER, stored BOOLEAN,
               reserved INTEGER, paid_without_reservation INTEGER, spots_left INTEGER, is_current BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
#variable_conflict use_column
DECLARE
  v_today DATE := (now() AT TIME ZONE 'Africa/Johannesburg')::date;
  v_first DATE;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  SELECT w.opens_on INTO v_first FROM public._intake_window(v_today) w;
  RETURN QUERY
  SELECT w.name, w.opens_on, w.closes_on, w.capacity, w.stored,
         t.reserved, t.paid_without_reservation, GREATEST(0, w.capacity - t.taken)::int, k = 0
  FROM generate_series(0, GREATEST(1, LEAST(p_count, 12)) - 1) AS k,
       LATERAL public._intake_window((v_first + make_interval(months => k))::date) w,
       LATERAL public._intake_taken(w.opens_on, w.closes_on) t
  ORDER BY k;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_intake_schedule(INTEGER) TO authenticated;

-- Admin: completed R300 payments from the last 90 days whose email isn't on
-- any waiting list yet, to add with one click.
CREATE OR REPLACE FUNCTION public.get_unlinked_deposits()
RETURNS TABLE (source TEXT, ref TEXT, name TEXT, email TEXT, amount NUMERIC, paid_on DATE)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
#variable_conflict use_column
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  RETURN QUERY
  WITH deposits AS (
    SELECT 'PayFast'::text AS source, p.pf_payment_id AS ref, p.member_name AS name, lower(p.email) AS email,
           p.amount, (p.paid_at AT TIME ZONE 'Africa/Johannesburg')::date AS paid_on
    FROM public.payfast_transactions p
    WHERE p.payment_status = 'COMPLETE' AND p.amount = 300
    UNION ALL
    SELECT 'EFT', e.pf_id, e.member, lower(e.email), e.amount, (e.date AT TIME ZONE 'Africa/Johannesburg')::date
    FROM public.eft_payments e
    WHERE e.status = 'COMPLETE' AND e.amount = 300
  )
  SELECT d.source, d.ref, d.name, d.email, d.amount, d.paid_on FROM deposits d
  WHERE d.paid_on >= (now() AT TIME ZONE 'Africa/Johannesburg')::date - 90
    AND NOT EXISTS (SELECT 1 FROM public.intake_reservations r WHERE lower(r.email) = d.email)
    -- 2026-11-27: an R300 payment from someone who is, or was, a member is a
    -- monthly fee, not a deposit, so it isn't listed. (A former member who
    -- comes back with a deposit is added to the waiting list by hand.)
    AND NOT EXISTS (SELECT 1 FROM public.member_profiles m WHERE m.email = d.email)
  ORDER BY d.paid_on DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_unlinked_deposits() TO authenticated;

-- =========================================================================
-- PLAN AND START (2026-11-20)
-- =========================================================================
-- What each person on the waiting list is joining on, and when, so the
-- Intakes page can show what an intake is worth and start them in one step.
-- The plan total is monthly_amount x months; the deposit is separate.
ALTER TABLE public.intake_reservations ADD COLUMN IF NOT EXISTS plan TEXT;
ALTER TABLE public.intake_reservations ADD COLUMN IF NOT EXISTS monthly_amount NUMERIC CHECK (monthly_amount IS NULL OR monthly_amount >= 0);
ALTER TABLE public.intake_reservations ADD COLUMN IF NOT EXISTS months INTEGER CHECK (months IS NULL OR months BETWEEN 1 AND 36);
ALTER TABLE public.intake_reservations ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE public.intake_reservations ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;

-- "Start membership": gives portal access, sets the member's start date and
-- their expected total, and marks the entry Joined. The expected total is the
-- plan total plus whatever they had paid by the day of the deposit, so the
-- deposit never counts towards the plan and they start owing exactly the
-- plan total. The welcome email is sent by the caller (welcome-email).
CREATE OR REPLACE FUNCTION public.start_reserved_membership(p_reservation_id BIGINT)
RETURNS TABLE (email TEXT, full_name TEXT, expected_total NUMERIC)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r public.intake_reservations%ROWTYPE;
  v_email TEXT;
  v_paid_before NUMERIC;
  v_expected NUMERIC;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can start a membership.';
  END IF;

  SELECT * INTO r FROM public.intake_reservations WHERE id = p_reservation_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'That waiting-list entry no longer exists.'; END IF;
  IF r.status = 'Cancelled' THEN RAISE EXCEPTION 'This entry is cancelled. Set it back to Reserved first.'; END IF;
  IF r.email IS NULL OR r.email = '' THEN RAISE EXCEPTION 'Add an email to this entry first, so they can sign in.'; END IF;
  v_email := lower(r.email);

  PERFORM public.grant_member_portal_access(v_email, r.full_name);

  UPDATE public.member_profiles
  SET manual_start_date = COALESCE(r.start_date, (now() AT TIME ZONE 'Africa/Johannesburg')::date)
  WHERE email = v_email AND manual_start_date IS NULL;

  IF r.monthly_amount IS NOT NULL AND r.months IS NOT NULL THEN
    SELECT
      COALESCE((SELECT sum(amount) FROM public.payfast_transactions
                WHERE lower(email) = v_email AND payment_status = 'COMPLETE'
                  AND (paid_at AT TIME ZONE 'Africa/Johannesburg')::date <= r.paid_on), 0)
      + COALESCE((SELECT sum(amount) FROM public.eft_payments
                  WHERE lower(email) = v_email AND status = 'COMPLETE'
                    AND (date AT TIME ZONE 'Africa/Johannesburg')::date <= r.paid_on), 0)
    INTO v_paid_before;
    v_expected := r.monthly_amount * r.months + v_paid_before;
    PERFORM public.set_member_expected_total_payment(v_email, v_expected);
  END IF;

  UPDATE public.intake_reservations
  SET status = 'Joined', started_at = now(), updated_at = now()
  WHERE id = p_reservation_id;

  RETURN QUERY SELECT v_email, r.full_name, v_expected;
END;
$$;
GRANT EXECUTE ON FUNCTION public.start_reserved_membership(BIGINT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.start_reserved_membership(BIGINT) FROM PUBLIC, anon;
