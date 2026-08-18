// Live PayFast transactions (supabase/033_payfast_transactions.sql), written
// by the payfast-webhook Edge Function as real payments come in. Mapped into
// the same shape src/data/payfastTransactions.json already used, so the rest
// of AdminDashboard.jsx (revenue calcs, tables, etc.) doesn't need to change.
// Admin-only - see the migration for why there's no member policy.

import { supabase } from './supabase';

export async function fetchPayfastPayments() {
  const { data, error } = await supabase
    .from('payfast_transactions')
    .select('id, pf_payment_id, member_name, email, plan, amount, fee, net, payment_status, paid_at')
    .order('paid_at', { ascending: false });
  if (error) throw error;

  return (data || []).map((row) => ({
    id: `pf-${row.id}`,
    pfId: row.pf_payment_id,
    member: row.member_name || row.email,
    email: row.email,
    // Every revenue/roster calculation elsewhere in this file strictly
    // checks `type === 'Funds Received'`, so only a genuinely COMPLETE
    // payment gets that type - a PENDING/FAILED/CANCELLED notification
    // still shows up in the audit table (via `status`) but is correctly
    // excluded from revenue sums and doesn't create a roster entry.
    // PayFast's base ITN also doesn't distinguish a refund/reversal from a
    // regular payment the way the historical CSV import's data does (that
    // was set by hand during the one-time import) - real-time reversal
    // handling is a known gap, not attempted here.
    type: row.payment_status === 'COMPLETE' ? 'Funds Received' : row.payment_status,
    plan: row.plan || 'Unknown',
    amount: Number(row.amount) || 0,
    fee: Number(row.fee) || 0,
    net: Number(row.net) || 0,
    fundingType: 'PayFast',
    date: row.paid_at.replace('T', ' ').substring(0, 16),
    status: row.payment_status,
  }));
}
