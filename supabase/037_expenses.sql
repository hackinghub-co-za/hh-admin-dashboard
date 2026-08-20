-- Hacking Hub Admin Dashboard - Business Expenses
-- Run this in the Supabase SQL Editor after 002-033 have already been applied.
-- Safe to re-run: every statement is idempotent.
--
-- The Finances tab tracked money coming in (PayFast revenue) but nothing
-- going out - admins had no way to log what the business actually spends
-- (tools, coach pay, hosting, etc.), so there was no real financial picture.
-- Admin-only, same "no member-facing view" reasoning as
-- payfast_transactions/033_payfast_transactions.sql - this is purely an
-- internal ledger, not member-submitted content, so there's no member policy
-- at all, unlike reviews/events/cert_calendar/resources.

CREATE TABLE IF NOT EXISTS public.expenses (
  id BIGSERIAL PRIMARY KEY,
  category TEXT NOT NULL CHECK (category IN ('Tools & Software', 'Coach / Mentor Pay', 'Marketing', 'Hosting / Infrastructure', 'Events', 'Other')),
  description TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  expense_date DATE NOT NULL,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins manage expenses" ON public.expenses;
CREATE POLICY "admins manage expenses"
  ON public.expenses FOR ALL
  USING (public.is_admin(auth.uid()));
