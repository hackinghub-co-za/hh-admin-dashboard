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
