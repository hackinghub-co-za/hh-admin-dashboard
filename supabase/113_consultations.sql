-- Hacking Hub Admin Dashboard - Paid 30-minute consultations (2026-11-11)
-- Run this in the Supabase SQL Editor after 112. Safe to re-run.
--
-- A one-off R200, 30-minute call with Siya, sold on hackinghub.co.za for
-- people who don't want a membership. Cal.com can't take PayFast, so the
-- visitor pays first: the website asks consultation-checkout for a signed
-- PayFast link (the price is fixed there, never sent by the browser), and
-- PayFast's return URL is the Cal.com booking page with their name and email
-- filled in.
--
-- payfast-webhook recognises these payments by their m_payment_id prefix
-- ('CONSULT-') and records them HERE, not in payfast_transactions: a
-- consultation is not a membership, so it must never grant portal access,
-- send the welcome email, or show the buyer as a member in the admin roster.
-- Admin only.

CREATE TABLE IF NOT EXISTS public.consultation_payments (
  id BIGSERIAL PRIMARY KEY,
  pf_payment_id TEXT NOT NULL UNIQUE,
  m_payment_id TEXT,
  full_name TEXT,
  email TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  fee NUMERIC NOT NULL DEFAULT 0,
  net NUMERIC NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'UNKNOWN',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS consultation_payments_created_idx ON public.consultation_payments (created_at DESC);
ALTER TABLE public.consultation_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read consultation payments" ON public.consultation_payments;
CREATE POLICY "admins read consultation payments"
  ON public.consultation_payments FOR SELECT
  USING (public.is_admin(auth.uid()));
