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

-- =========================================================================
-- PART 2: FIX - total_amount was never actually validated against real
-- product pricing anywhere. The self-attributed-INSERT policy above locks
-- down member_email/status/m_payment_id/pf_payment_id/paid_at, but
-- total_amount sailed straight through from the client (merchCartTotal in
-- MemberPortal.jsx's handleMerchCheckout) with only `total_amount > 0`
-- enforced - nothing tied it to `items` or MERCH_CATALOG
-- (src/lib/merchStoreData.js) at all.
--
-- That matters because payfast-webhook/index.ts's merch branch marks an
-- order 'Paid' by comparing PayFast's real ITN amount_gross against exactly
-- this total_amount (a cent's float-rounding tolerance). A member could
-- insert an order for a real Hoodie/M (items correctly describing it) but
-- hand-set total_amount to 1, then either pay only R1 through the normal
-- checkout flow (createPayfastCheckoutUrl is also called with this same
-- client-computed total, not a server-verified one) or call
-- supabase.functions.invoke('payfast-checkout', ...) directly with
-- amount: 1 and that order's id - either way a genuine R1 PayFast payment
-- would then match the order's (also R1) total_amount and get marked
-- 'Paid' for what should have been a R600 item, with no mismatch for the
-- webhook's existing check to catch.
--
-- Fix: recompute the true price from `items` against a server-side mirror
-- of MERCH_CATALOG on every insert and overwrite total_amount with that
-- figure - the same "regardless of what this sends" idiom the INSERT
-- policy above already uses for member_email/status/etc. This makes the
-- webhook's amount-vs-total_amount check trustworthy again: an underpaid
-- order now has a total_amount reflecting its real price, so a mismatched
-- payment correctly lands in 'Needs Review' instead of 'Paid'. Keep the
-- prices below in sync with MERCH_CATALOG by hand if pricing ever changes -
-- there's no existing single-source-of-truth mechanism between SQL and the
-- frontend for this small fixed catalog to hook into.
CREATE OR REPLACE FUNCTION public.validate_merch_order_total()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  item JSONB;
  unit_price NUMERIC;
  qty NUMERIC;
  computed_total NUMERIC := 0;
BEGIN
  IF NEW.items IS NULL OR jsonb_typeof(NEW.items) != 'array' OR jsonb_array_length(NEW.items) = 0 THEN
    RAISE EXCEPTION 'Merch order must have at least one item.';
  END IF;

  FOR item IN SELECT * FROM jsonb_array_elements(NEW.items)
  LOOP
    unit_price := CASE lower(item->>'product')
      WHEN 'deskpad' THEN 200
      WHEN 'top' THEN 400
      WHEN 'hoodie' THEN 600
      ELSE NULL
    END;
    IF unit_price IS NULL THEN
      RAISE EXCEPTION 'Unknown merch product: %', item->>'product';
    END IF;

    qty := COALESCE((item->>'quantity')::NUMERIC, 1);
    IF qty < 1 THEN
      RAISE EXCEPTION 'Invalid quantity for %: %', item->>'product', item->>'quantity';
    END IF;

    computed_total := computed_total + (unit_price * qty);
  END LOOP;

  NEW.total_amount := computed_total;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_merch_order_total ON public.merch_orders;
CREATE TRIGGER trg_validate_merch_order_total
  BEFORE INSERT ON public.merch_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_merch_order_total();

-- MERCH PRODUCT IMAGE STORAGE - a dedicated public bucket for real product
-- photos shown on the Merch Store cards (MERCH_CATALOG, merchStoreData.js).
-- Same pattern as event-images (019_events.sql): public read, admin-only
-- write, since merch products are admin-curated, not member-owned content.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('merch-images', 'merch-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "public read merch images" ON storage.objects;
CREATE POLICY "public read merch images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'merch-images');

DROP POLICY IF EXISTS "staff manage merch images" ON storage.objects;
CREATE POLICY "staff manage merch images"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'merch-images' AND public.is_admin(auth.uid()))
  WITH CHECK (bucket_id = 'merch-images' AND public.is_admin(auth.uid()));
