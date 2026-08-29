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

-- =========================================================================
-- "My Billing" - full payment history and money owed, member-facing. Until
-- now there was genuinely no way for a member to see their own payment
-- history or what they owe without asking an admin directly - every "did
-- my payment go through?" question went through a human. Same narrow
-- SECURITY DEFINER pattern as get_my_last_payment() above (and
-- get_member_directory() in 010_member_directory.sql): explicit column
-- allowlists, filtered to the caller's own row(s), never the raw table.
-- =========================================================================

-- Every payment on record for the caller, both sources, newest first - not
-- filtered to COMPLETE only (unlike get_my_last_payment(), which is
-- answering "what's my current plan", a different question). A member
-- checking "did my payment go through" needs to see a pending or refunded
-- attempt too, not just successful ones - status is returned per row so
-- the UI can show it honestly rather than hiding it.
CREATE OR REPLACE FUNCTION public.get_my_payment_history()
RETURNS TABLE (plan TEXT, amount NUMERIC, funding_type TEXT, payment_status TEXT, payment_date TIMESTAMP WITH TIME ZONE)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT combined.plan, combined.amount, combined.funding_type, combined.payment_status, combined.payment_date
  FROM (
    SELECT plan, amount, 'PayFast' AS funding_type, payment_status, paid_at AS payment_date
    FROM public.payfast_transactions
    WHERE lower(email) = lower(auth.jwt() ->> 'email')
    UNION ALL
    SELECT plan, amount, 'EFT' AS funding_type, status AS payment_status, date AS payment_date
    FROM public.eft_payments
    WHERE lower(email) = lower(auth.jwt() ->> 'email')
  ) combined
  ORDER BY combined.payment_date DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_payment_history() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_payment_history() FROM PUBLIC, anon;

-- Money owed and membership status - a 2-column allowlist off
-- member_profiles, never the raw row, so nothing else there (phone,
-- offboarding notes, exit feedback, monthly_remuneration, etc.) is ever
-- reachable this way.
CREATE OR REPLACE FUNCTION public.get_my_billing_summary()
RETURNS TABLE (money_owed NUMERIC, status TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT money_owed, status
  FROM public.member_profiles
  WHERE lower(email) = lower(auth.jwt() ->> 'email');
$$;

GRANT EXECUTE ON FUNCTION public.get_my_billing_summary() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_billing_summary() FROM PUBLIC, anon;
