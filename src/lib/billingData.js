// Member-facing billing (supabase/046_member_billing_summary.sql) - current
// plan, full payment history, and money owed, all via narrow SECURITY
// DEFINER functions scoped to the caller's own data rather than any direct
// table access.

import { supabase } from './supabase';

/** The signed-in member's most recent completed payment, or null if they have none on record. */
export async function fetchMyLastPayment() {
  const { data, error } = await supabase.rpc('get_my_last_payment');
  if (error) throw error;
  const row = data?.[0];
  if (!row) return null;
  return { plan: row.plan, paymentDate: row.payment_date };
}

/** The signed-in member's full payment history, both PayFast and EFT, newest first. */
export async function fetchMyPaymentHistory() {
  const { data, error } = await supabase.rpc('get_my_payment_history');
  if (error) throw error;
  return (data || []).map((row) => ({
    plan: row.plan,
    amount: Number(row.amount) || 0,
    fundingType: row.funding_type,
    status: row.payment_status,
    date: row.payment_date,
  }));
}

/** The signed-in member's own money owed and membership status. */
export async function fetchMyBillingSummary() {
  const { data, error } = await supabase.rpc('get_my_billing_summary');
  if (error) throw error;
  const row = data?.[0];
  if (!row) return { moneyOwed: 0, status: 'Active' };
  return { moneyOwed: Number(row.money_owed) || 0, status: row.status || 'Active' };
}
