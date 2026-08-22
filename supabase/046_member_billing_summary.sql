-- Hacking Hub Admin Dashboard - Member-facing Billing Summary
-- Run this in the Supabase SQL Editor after 002-045 have already been
-- applied. Safe to re-run: every statement is idempotent.
--
-- Fixes "My Subscription & Upgrades"' Current Active Clearance card, which
-- was blurred behind an "Under Construction" badge because it was never
-- wired to anything real - `currentPlanRank` was a hardcoded `1` for every
-- member, not their actual plan.
--
-- Neither payfast_transactions (033_payfast_transactions.sql) nor
-- eft_payments (002_member_persistence.sql) has a member-facing SELECT
-- policy today - both are deliberately admin-only (033's own comment says
-- so explicitly). Rather than widen either table's RLS (which would expose
-- every OTHER member's payment rows too, not just the caller's own), this
-- follows the same narrow SECURITY DEFINER pattern already used for the
-- member directory (010_member_directory.sql): a function that returns only
-- the calling member's own most recent completed payment - plan and date,
-- nothing else - across both payment sources.

CREATE OR REPLACE FUNCTION public.get_my_last_payment()
RETURNS TABLE (plan TEXT, payment_date TIMESTAMP WITH TIME ZONE)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT combined.plan, combined.payment_date
  FROM (
    SELECT plan, paid_at AS payment_date
    FROM public.payfast_transactions
    WHERE lower(email) = lower(auth.jwt() ->> 'email') AND payment_status = 'COMPLETE'
    UNION ALL
    SELECT plan, date AS payment_date
    FROM public.eft_payments
    WHERE lower(email) = lower(auth.jwt() ->> 'email') AND status = 'COMPLETE'
  ) combined
  ORDER BY combined.payment_date DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_last_payment() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_last_payment() FROM PUBLIC, anon;
