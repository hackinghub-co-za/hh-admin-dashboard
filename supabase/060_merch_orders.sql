-- Hacking Hub Admin Dashboard - Merch Store (Deskpad / Top / Hoodie)
-- Run in the Supabase SQL Editor after 002-059 have already been applied.
-- Safe to re-run: every statement is idempotent.
--
-- A merch sale is a real PayFast payment but must never be counted as
-- membership revenue and must never trigger grant_member_portal_access() -
-- payfast-webhook/index.ts branches on m_payment_id having a 'MERCH-'
-- prefix (set by payfast-checkout/index.ts when a merchOrderId is passed)
-- and returns early for those, entirely bypassing the payfast_transactions
-- upsert / grant call its normal membership-payment path runs. This table
-- is the merch-side record instead - completely separate from
-- payfast_transactions, which stays exactly what it's always been: real
-- membership revenue only.
--
-- Same self-attributed-INSERT pattern as cert_calendar
-- (024_cert_calendar.sql): a member can create their own order row directly
-- (status locked to 'Awaiting Payment' by the INSERT policy's own CHECK),
-- but there is deliberately NO member UPDATE policy at all - the only
-- write that can ever move a row to 'Paid' is the payfast-webhook Edge
-- Function, via its service-role key (which bypasses RLS entirely, same as
-- every other webhook in this project). Admins get a FOR ALL policy for
-- fulfillment (marking Fulfilled/Cancelled, or reviewing an
-- amount-mismatched order).
--
-- One row per PayFast checkout, not one row per line item - items is a
-- JSONB array ([{ product, size, quantity, unitPrice }, ...]) rather than a
-- second merch_order_items child table. A real child table is the more
-- "correct" e-commerce shape, but for a fixed 3-product side store with no
-- per-item fulfillment tracking (no partial shipment, no per-item stock),
-- it buys nothing an admin needs today at the cost of a join everywhere
-- this is read. Revisit if merch ever needs per-item state.

CREATE TABLE IF NOT EXISTS public.merch_orders (
  id BIGSERIAL PRIMARY KEY,
  member_email TEXT NOT NULL,
  member_name TEXT,
  items JSONB NOT NULL,
  total_amount NUMERIC NOT NULL CHECK (total_amount > 0),
  delivery_notes TEXT,
  -- 'Needs Review' is where payfast-webhook parks an order whose real ITN
  -- amount_gross doesn't match total_amount, rather than either trusting a
  -- mismatched amount or leaving it stuck at 'Awaiting Payment' forever
  -- (indistinguishable from never-paid).
  status TEXT NOT NULL DEFAULT 'Awaiting Payment'
    CHECK (status IN ('Awaiting Payment', 'Paid', 'Fulfilled', 'Cancelled', 'Needs Review')),
  m_payment_id TEXT,
  pf_payment_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  paid_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.merch_orders ENABLE ROW LEVEL SECURITY;

-- Members read only their own orders ("My Merch Orders" list).
DROP POLICY IF EXISTS "members read own merch orders" ON public.merch_orders;
CREATE POLICY "members read own merch orders"
  ON public.merch_orders FOR SELECT
  TO authenticated
  USING (member_email = lower(auth.jwt() ->> 'email'));

-- Self-service creation, same shape as cert_calendar's INSERT policy:
-- member_email always the caller's own verified email, status always
-- starts 'Awaiting Payment' regardless of what the client sends, and no
-- m_payment_id/pf_payment_id/paid_at at creation time - those are only
-- ever set later by the service-role webhook.
DROP POLICY IF EXISTS "members create own merch orders" ON public.merch_orders;
CREATE POLICY "members create own merch orders"
  ON public.merch_orders FOR INSERT
  TO authenticated
  WITH CHECK (
    member_email = lower(auth.jwt() ->> 'email')
    AND public.is_member_allowed(auth.jwt() ->> 'email')
    AND status = 'Awaiting Payment'
    AND m_payment_id IS NULL
    AND pf_payment_id IS NULL
    AND paid_at IS NULL
  );

-- No member UPDATE policy at all - intentional. Only the webhook
-- (service-role, bypasses RLS) and admins below can ever change status.

-- Admins manage everything (fulfillment status changes, reviewing a
-- 'Needs Review' amount-mismatched order, deleting a stale unpaid order).
DROP POLICY IF EXISTS "admins manage merch orders" ON public.merch_orders;
CREATE POLICY "admins manage merch orders"
  ON public.merch_orders FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_merch_orders_member_email ON public.merch_orders (member_email);
CREATE INDEX IF NOT EXISTS idx_merch_orders_status ON public.merch_orders (status);
