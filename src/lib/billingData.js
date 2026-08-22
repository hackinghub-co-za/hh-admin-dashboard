// Member-facing billing summary (supabase/046_member_billing_summary.sql) -
// the calling member's own most recent completed payment, via a narrow
// SECURITY DEFINER function rather than any direct table access.

import { supabase } from './supabase';

/** The signed-in member's most recent completed payment, or null if they have none on record. */
export async function fetchMyLastPayment() {
  const { data, error } = await supabase.rpc('get_my_last_payment');
  if (error) throw error;
  const row = data?.[0];
  if (!row) return null;
  return { plan: row.plan, paymentDate: row.payment_date };
}
