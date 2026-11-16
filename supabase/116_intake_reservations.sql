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

-- Public: the running intake and spots left. Counts only, no member data.
CREATE OR REPLACE FUNCTION public.get_current_intake()
RETURNS TABLE (name TEXT, closes_on DATE, capacity INTEGER, spots_left INTEGER)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT w.name, w.closes_on, w.capacity, GREATEST(0, w.capacity - t.taken)::int
  FROM public._intake_window((now() AT TIME ZONE 'Africa/Johannesburg')::date) w,
       public._intake_taken(w.opens_on, w.closes_on) t
  WHERE w.capacity > 0;
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
  ORDER BY d.paid_on DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_unlinked_deposits() TO authenticated;
