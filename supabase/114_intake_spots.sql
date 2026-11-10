-- Hacking Hub Admin Dashboard - Intake spots counter
-- Run this in the Supabase SQL Editor after 002-113 have already been
-- applied. Safe to re-run: every statement is idempotent.
--
-- The public site shows "N spots left" for the current monthly intake
-- (hackinghub.co.za, hero and pricing). Each intake has a fixed number of
-- spots; a spot is taken when a new member makes their FIRST ever completed
-- payment (PayFast or EFT) inside the intake's dates, the same "first payer"
-- rule get_weekly_report() uses (108). So the number goes down by itself as
-- people join, with nothing to update by hand.
--
-- To run a new intake, add a row (or change capacity to open more spots):
--   INSERT INTO public.intakes (name, opens_on, closes_on, capacity)
--   VALUES ('December', '2026-12-01', '2026-12-31', 8);
-- The site shows the intake whose dates include today (SAST); with none, it
-- shows nothing.

CREATE TABLE IF NOT EXISTS public.intakes (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  opens_on DATE NOT NULL,
  closes_on DATE NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity >= 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT intakes_dates_check CHECK (closes_on >= opens_on)
);

ALTER TABLE public.intakes ENABLE ROW LEVEL SECURITY;
-- Intentionally zero policies: edited in the SQL Editor, read publicly only
-- through get_current_intake() below, which returns no member data.

-- November 2026: 8 spots, 2 taken by 10 Nov, so the site opened at 6 left.
INSERT INTO public.intakes (name, opens_on, closes_on, capacity)
SELECT 'November', '2026-11-01', '2026-11-30', 8
WHERE NOT EXISTS (SELECT 1 FROM public.intakes WHERE opens_on = '2026-11-01');

-- The intake running today and how many spots are left. Returns only the
-- intake's name, closing date and two counts - never who joined.
CREATE OR REPLACE FUNCTION public.get_current_intake()
RETURNS TABLE (name TEXT, closes_on DATE, capacity INTEGER, spots_left INTEGER)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH today AS (SELECT (now() AT TIME ZONE 'Africa/Johannesburg')::date AS d),
  current AS (
    SELECT i.* FROM public.intakes i, today
    WHERE today.d BETWEEN i.opens_on AND i.closes_on
    ORDER BY i.opens_on DESC
    LIMIT 1
  ),
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
  FROM current c;
$$;

-- Public: the website calls this with the anon key, like
-- get_public_community_events (052).
GRANT EXECUTE ON FUNCTION public.get_current_intake() TO anon, authenticated;
