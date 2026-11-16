-- Hacking Hub Admin Dashboard - Intakes switch mid-month
-- Run this in the Supabase SQL Editor after 002-114 have already been
-- applied. Safe to re-run: every statement is idempotent.
--
-- An intake is now sold in the month BEFORE it starts: the December intake
-- takes sign-ups from 16 November to 15 December, the January intake from
-- 16 December to 15 January, and so on. opens_on / closes_on on
-- public.intakes are that sign-up window, and a spot is taken by a first
-- ever completed payment inside it (same rule as 114).
--
-- get_current_intake() also no longer needs a row per month. If no row's
-- window covers today, it works out the window itself (16th of this month
-- to 15th of next, or 16th of last month to 15th of this one), names it
-- after the month it starts, and uses the capacity of the most recent
-- intake. A row only needs adding to change a month's number of spots:
--   INSERT INTO public.intakes (name, opens_on, closes_on, capacity)
--   VALUES ('February', '2027-01-16', '2027-02-15', 12);

-- November is closed; December and January move to their sign-up windows.
UPDATE public.intakes SET closes_on = '2026-11-15' WHERE name = 'November' AND opens_on = '2026-11-01';
UPDATE public.intakes SET opens_on = '2026-11-16', closes_on = '2026-12-15' WHERE name = 'December' AND opens_on = '2026-12-01';
UPDATE public.intakes SET opens_on = '2026-12-16', closes_on = '2027-01-15' WHERE name = 'January' AND opens_on = '2027-01-01';

CREATE OR REPLACE FUNCTION public.get_current_intake()
RETURNS TABLE (name TEXT, closes_on DATE, capacity INTEGER, spots_left INTEGER)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH today AS (SELECT (now() AT TIME ZONE 'Africa/Johannesburg')::date AS d),
  -- The default window today falls in: 16th to the next 15th.
  default_window AS (
    SELECT
      CASE WHEN extract(day FROM t.d) >= 16
           THEN date_trunc('month', t.d)::date + 15
           ELSE (date_trunc('month', t.d) - interval '1 month')::date + 15 END AS opens_on
    FROM today t
  ),
  stored AS (
    SELECT i.name, i.opens_on, i.closes_on, i.capacity FROM public.intakes i, today
    WHERE today.d BETWEEN i.opens_on AND i.closes_on
    ORDER BY i.opens_on DESC
    LIMIT 1
  ),
  derived AS (
    SELECT trim(to_char(w.opens_on + interval '1 month', 'FMMonth')) AS name,
           w.opens_on,
           (w.opens_on + interval '1 month' - interval '1 day')::date AS closes_on,
           COALESCE((SELECT capacity FROM public.intakes ORDER BY opens_on DESC LIMIT 1), 0) AS capacity
    FROM default_window w
    WHERE NOT EXISTS (SELECT 1 FROM stored)
  ),
  current AS (SELECT * FROM stored UNION ALL SELECT * FROM derived),
  pay AS (
    SELECT lower(email) AS email, (paid_at AT TIME ZONE 'Africa/Johannesburg')::date AS d
    FROM public.payfast_transactions WHERE payment_status = 'COMPLETE'
    UNION ALL
    SELECT lower(email), (date AT TIME ZONE 'Africa/Johannesburg')::date
    FROM public.eft_payments WHERE status = 'COMPLETE'
  ),
  first_pay AS (SELECT email, min(d) AS first_d FROM pay GROUP BY 1)
  SELECT c.name, c.closes_on, c.capacity,
         GREATEST(0, c.capacity - (SELECT count(*) FROM first_pay f WHERE f.first_d BETWEEN c.opens_on AND c.closes_on))::int
  FROM current c
  WHERE c.capacity > 0;
$$;

GRANT EXECUTE ON FUNCTION public.get_current_intake() TO anon, authenticated;
