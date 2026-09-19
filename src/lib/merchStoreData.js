// Merch Store (supabase/060_merch_orders.sql) - real HH-branded products,
// paid for via a real once-off PayFast checkout (src/lib/payfast.js,
// merchOrderId param) that's deliberately kept invisible to membership
// revenue reporting - see that migration's own header comment for why.

import { supabase } from './supabase';

// The 3 real products currently sold - hardcoded, not admin-editable, same
// pattern as CORE_FOUNDATIONS_CATALOG (memberOptions.js) for a small fixed
// catalog with no existing "admin edits pricing" pattern in this app to
// extend. sizes: null means no size picker (Mousepads); otherwise the
// selectable sizes shown in the cart UI. id stays 'deskpad' even though the
// display name is now "Mousepads" - it's the real product key the
// validate_merch_order_total() trigger (060_merch_orders.sql) checks
// against server-side, and every past order's stored items JSON already
// used it; renaming the id would silently orphan that history.
export const MERCH_CATALOG = [
  { id: 'deskpad', name: 'Mousepads', price: 200, sizes: null, image: 'https://kveiflphktpvsddhkspz.supabase.co/storage/v1/object/public/merch-images/mousepads.jpg' },
  { id: 'top', name: 'Top', price: 400, sizes: ['S', 'M', 'L', 'XL'] },
  { id: 'hoodie', name: 'Hoodie', price: 600, sizes: ['S', 'M', 'L', 'XL'] },
];

function mapOrder(row) {
  return {
    id: row.id,
    memberEmail: row.member_email,
    memberName: row.member_name || '',
    items: row.items || [],
    totalAmount: Number(row.total_amount),
    deliveryNotes: row.delivery_notes || '',
    status: row.status,
    createdAt: row.created_at,
    paidAt: row.paid_at,
  };
}

/** Creates a member's own merch order (RLS locks status to 'Awaiting
 * Payment' and member_email to the caller's own session regardless of what
 * this sends). Call this BEFORE PayFast checkout - the returned order's id
 * gets passed as merchOrderId to createPayfastCheckoutUrl. */
export async function createMyMerchOrder({ memberEmail, memberName, items, totalAmount, deliveryNotes }) {
  const { data, error } = await supabase
    .from('merch_orders')
    .insert({
      member_email: memberEmail.toLowerCase(),
      member_name: memberName || null,
      items,
      total_amount: totalAmount,
      delivery_notes: deliveryNotes || null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapOrder(data);
}

/** The signed-in member's own past orders, most recent first. */
export async function fetchMyMerchOrders() {
  const { data, error } = await supabase
    .from('merch_orders')
    .select('id, items, total_amount, delivery_notes, status, created_at, paid_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapOrder);
}

/** Admin: every order across all members. */
export async function fetchAllMerchOrders() {
  const { data, error } = await supabase
    .from('merch_orders')
    .select('id, member_email, member_name, items, total_amount, delivery_notes, status, created_at, paid_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapOrder);
}

/** Admin-only: Fulfilled/Cancelled, or manually resolving a 'Needs Review'
 * order (amount-mismatched by the webhook) to Paid/Cancelled after
 * reconciling with the real PayFast/bank record by hand. The webhook itself
 * never calls this - it writes Paid/Needs Review directly via the
 * service-role key, bypassing RLS entirely; this is the admin FOR ALL
 * policy's other real use besides fulfillment. Setting paid_at here when
 * manually resolving to Paid keeps it meaning the same thing it does on the
 * webhook's own Paid write. */
export async function updateMerchOrderStatus(orderId, status) {
  const update = { status };
  if (status === 'Paid') update.paid_at = new Date().toISOString();
  const { error } = await supabase.from('merch_orders').update(update).eq('id', orderId);
  if (error) throw error;
}
