-- Hacking Hub Admin Dashboard - Auto-Calculated Money Owed
-- Run this in the Supabase SQL Editor after 002-075 have already been
-- applied. Safe to re-run: every statement is idempotent.
--
-- Until now, member_profiles.money_owed was a plain admin-typed number with
-- no connection to actual payments - logging a new PayFast/EFT payment
-- never changed it, so an admin had to remember to go update it by hand
-- every time (exactly what came up reconciling Tshegofatso's and Chioma's
-- EFT history). This adds an opt-in per-member "Expected Total Payment"
-- (for Permanent Access / Elite Operative members, who owe one fixed total
-- rather than a recurring monthly fee) - once set, money_owed becomes
-- money_owed = GREATEST(expected_total_payment - total paid, 0), recomputed
-- automatically every time a payment is added, edited, or deleted.
--
-- A member with no expected_total_payment set is untouched by any of this -
-- money_owed keeps behaving exactly as it does today (a plain admin-typed
-- field), so existing values (Tshegofatso's R4,000, Chioma's R3,000, etc.)
-- aren't disturbed until an admin opts them into the new automation by
-- setting an expected total.

ALTER TABLE public.member_profiles ADD COLUMN IF NOT EXISTS expected_total_payment NUMERIC;

-- Once expected_total_payment is set for a member, money_owed becomes
-- system-owned - a direct client edit (the general profile-save upsert,
-- which still sends whatever money_owed value happens to be in the admin's
-- local form state) must no longer be able to clobber the computed value.
-- Distinguishes "our own recompute" from any other write via a
-- transaction-local flag (hh.recomputing_money_owed) rather than
-- pg_trigger_depth(), since _recompute_money_owed() below can be called
-- both from a payment-table trigger (nested) and directly from the
-- set_member_expected_total_payment() RPC (not nested) - the flag covers
-- both cases uniformly, pg_trigger_depth() alone would not.
CREATE OR REPLACE FUNCTION public._guard_computed_money_owed()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.expected_total_payment IS NOT NULL
     AND coalesce(current_setting('hh.recomputing_money_owed', true), 'false') <> 'true' THEN
    NEW.money_owed := OLD.money_owed;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_computed_money_owed ON public.member_profiles;
CREATE TRIGGER guard_computed_money_owed
  BEFORE UPDATE ON public.member_profiles
  FOR EACH ROW EXECUTE FUNCTION public._guard_computed_money_owed();

-- The actual calculation - a no-op for any member with no expected total
-- set (automation not opted into), so calling this unconditionally from
-- every payment-table trigger is always safe.
CREATE OR REPLACE FUNCTION public._recompute_money_owed(p_email TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_expected NUMERIC;
  v_paid NUMERIC;
BEGIN
  SELECT expected_total_payment INTO v_expected
  FROM public.member_profiles WHERE email = p_email;

  IF v_expected IS NULL THEN
    RETURN;
  END IF;

  SELECT
    COALESCE((SELECT SUM(amount) FROM public.payfast_transactions WHERE email = p_email AND payment_status = 'COMPLETE'), 0)
    + COALESCE((SELECT SUM(amount) FROM public.eft_payments WHERE email = p_email AND status = 'COMPLETE'), 0)
  INTO v_paid;

  PERFORM set_config('hh.recomputing_money_owed', 'true', true);
  UPDATE public.member_profiles
  SET money_owed = GREATEST(v_expected - v_paid, 0), updated_at = timezone('utc'::text, now())
  WHERE email = p_email;
  PERFORM set_config('hh.recomputing_money_owed', 'false', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public._recompute_money_owed(TEXT) FROM PUBLIC, anon, authenticated;

-- Fires on every real (PayFast) and manually-recorded (EFT) payment change -
-- both tables have an `email` column, so one shared trigger function covers
-- both. Handles an edited email by recomputing both the old and new email's
-- totals, though in practice email is never edited on a payment row today.
CREATE OR REPLACE FUNCTION public._trigger_recompute_money_owed()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public._recompute_money_owed(OLD.email);
    RETURN OLD;
  END IF;

  PERFORM public._recompute_money_owed(NEW.email);
  IF TG_OP = 'UPDATE' AND OLD.email IS DISTINCT FROM NEW.email THEN
    PERFORM public._recompute_money_owed(OLD.email);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS recompute_money_owed_on_payfast ON public.payfast_transactions;
CREATE TRIGGER recompute_money_owed_on_payfast
  AFTER INSERT OR UPDATE OR DELETE ON public.payfast_transactions
  FOR EACH ROW EXECUTE FUNCTION public._trigger_recompute_money_owed();

DROP TRIGGER IF EXISTS recompute_money_owed_on_eft ON public.eft_payments;
CREATE TRIGGER recompute_money_owed_on_eft
  AFTER INSERT OR UPDATE OR DELETE ON public.eft_payments
  FOR EACH ROW EXECUTE FUNCTION public._trigger_recompute_money_owed();

-- Admin-facing entry point - sets (or, with NULL, clears) a member's
-- expected total and immediately recomputes money_owed against it, so the
-- new figure is visible right away rather than waiting for the next
-- payment event. Clearing it (NULL) hands money_owed back to plain manual
-- control without changing its current value - same "leave it as-is"
-- philosophy as a member who never had a total set.
CREATE OR REPLACE FUNCTION public.set_member_expected_total_payment(p_email TEXT, p_expected_total NUMERIC)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Same "only gate an actual authenticated JWT caller" pattern as
  -- get_members_with_lapsing_streak (048_push_notifications.sql) - a
  -- service-role caller (no 'authenticated' JWT role) bypasses this check
  -- entirely; only blocks a non-admin member from calling it directly.
  IF auth.role() = 'authenticated' AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can set a member''s expected total payment.';
  END IF;

  UPDATE public.member_profiles
  SET expected_total_payment = p_expected_total, updated_at = timezone('utc'::text, now())
  WHERE email = lower(p_email);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No profile found for %', p_email;
  END IF;

  PERFORM public._recompute_money_owed(lower(p_email));
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_member_expected_total_payment(TEXT, NUMERIC) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.set_member_expected_total_payment(TEXT, NUMERIC) FROM PUBLIC, anon;
