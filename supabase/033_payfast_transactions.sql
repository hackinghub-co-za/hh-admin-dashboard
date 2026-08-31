-- Hacking Hub Admin Dashboard - Live PayFast Transactions
-- Run this in the Supabase SQL Editor after 002-032 have already been applied.
-- Safe to re-run: every statement is idempotent.
--
-- Until now, "recent payments" in the admin dashboard was a one-time,
-- manually-regenerated JSON snapshot (src/data/payfastTransactions.json,
-- last dated 2026-08-05) - nothing recorded a payment automatically.
-- payfast.js already set a notify_url on every checkout pointing at a
-- payfast-webhook Edge Function, but that function never actually existed,
-- so PayFast's real-time ITN callbacks had nowhere to land.
--
-- This table is what that new Edge Function (supabase/functions/
-- payfast-webhook) writes into once it's deployed. Only the Edge Function
-- (via the service-role key, which bypasses RLS) and admins ever touch it -
-- there's no member-facing billing history view today, so no member policy.

CREATE TABLE IF NOT EXISTS public.payfast_transactions (
  id BIGSERIAL PRIMARY KEY,
  pf_payment_id TEXT UNIQUE NOT NULL,
  m_payment_id TEXT,
  member_name TEXT,
  email TEXT NOT NULL,
  plan TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  fee NUMERIC NOT NULL DEFAULT 0,
  net NUMERIC NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL,
  paid_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.payfast_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins manage payfast transactions" ON public.payfast_transactions;
CREATE POLICY "admins manage payfast transactions"
  ON public.payfast_transactions FOR ALL
  USING (public.is_admin(auth.uid()));

-- =========================================================================
-- PART 2: HISTORICAL BACKFILL - REDACTED. This originally held a one-time
-- INSERT of 225 real historical transactions (name, email, plan, amount,
-- fee, net, timestamp), moved here from a raw JSON/CSV export as the fix
-- for that file being found exposed in this public repo. That "fix" was
-- itself incomplete - it just relocated the same real data into this
-- tracked migration file, which a later PII review caught still publicly
-- fetchable. The real INSERT now lives only in
-- supabase/.private-history/033_payfast_transactions.full.sql (gitignored,
-- local-only) - it already ran against the live database, so there is
-- nothing to re-run here. This file stays only for PART 1's schema/RLS
-- and PART 3's dedup fix, both fully generic.
-- =========================================================================


-- =========================================================================
-- PART 3: FIX - PART 2's pf_payment_id values above came from
-- payfastTransactions.json's "pfId" field verbatim, which has a "PF-"
-- prefix baked in (e.g. 'PF-319516613'). That prefix was cosmetic - never
-- part of PayFast's real identifier. Confirmed directly against PayFast's
-- own raw export CSV, whose "PF Payment ID" column has no prefix at all
-- (just '319516613'), matching exactly what payfast-webhook stores
-- (pf_payment_id straight from the ITN parameter, always unprefixed - see
-- payfast-webhook/index.ts).
--
-- Consequence: every PART 2 row sits under a pf_payment_id PayFast itself
-- will never send. The ON CONFLICT (pf_payment_id) DO NOTHING guard exists
-- specifically because "PayFast can and does resend the same ITN more than
-- once" (see payfast-webhook's own comment) - but 'PF-319516613' and
-- '319516613' are different TEXT values, so a resent ITN for one of these
-- backfilled transactions isn't recognized as a duplicate and gets
-- inserted as a brand-new row instead of being silently ignored like it's
-- supposed to be. That's the duplication.
--
-- Fix, in order: first delete any backfilled row that's already a proven
-- duplicate (its de-prefixed ID matches a row payfast-webhook has already
-- recorded live) - the webhook's own copy is authoritative, so the
-- backfilled copy is redundant. Then strip the prefix from every remaining
-- backfilled row so it matches PayFast's real ID format going forward,
-- which is what actually stops this from happening again on any future
-- ITN resend for these transactions.
DELETE FROM public.payfast_transactions dup
WHERE dup.pf_payment_id LIKE 'PF-%'
  AND EXISTS (
    SELECT 1 FROM public.payfast_transactions live
    WHERE live.pf_payment_id = substring(dup.pf_payment_id FROM 4)
  );

UPDATE public.payfast_transactions
SET pf_payment_id = substring(pf_payment_id FROM 4)
WHERE pf_payment_id LIKE 'PF-%';

-- Verify after running the above - this should return zero rows. If it
-- doesn't, something else is duplicating transactions and needs a fresh
-- look rather than this specific fix.
-- SELECT pf_payment_id, count(*) FROM public.payfast_transactions GROUP BY pf_payment_id HAVING count(*) > 1;
