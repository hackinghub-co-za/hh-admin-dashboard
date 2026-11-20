// Intakes & Deposits (supabase/114-116): each monthly intake's spots, the
// waiting list of people who paid a R300 deposit to secure a spot, and R300
// payments that haven't been put on a list yet. Admin only (RLS / RPC
// checks). Reserved and Joined entries take a spot on the website's
// "N spots left" counter straight away.
import { supabase } from './supabase';

export const DEPOSIT_AMOUNT = 300;
export const RESERVATION_STATUSES = ['Reserved', 'Joined', 'Cancelled'];
export const DEPOSIT_METHODS = ['PayFast', 'EFT', 'Cash', 'Other'];

// Plans someone on the waiting list can be joining on, with the usual price
// filled in when picked (still editable for a custom deal).
export const RESERVATION_PLANS = [
  { name: 'Elite Operative', monthlyAmount: 2500, months: 12 },
  { name: 'Elite with Job Guarantee', monthlyAmount: '', months: 12 },
  { name: 'Permanent Access', monthlyAmount: 1250, months: 12 },
  { name: 'Custom Plan', monthlyAmount: '', months: '' },
];

/** monthly x months, or null when either is missing. */
export function planTotal(r) {
  const monthly = Number(r.monthlyAmount);
  const months = Number(r.months);
  return monthly > 0 && months > 0 ? monthly * months : null;
}

/** 30000 -> 'R30,000' */
export function rand(n) {
  return `R${Number(n || 0).toLocaleString('en-ZA', { maximumFractionDigits: 2 })}`;
}

/** The running intake and the next ones, with spots taken and left. */
export async function fetchIntakeSchedule(count = 3) {
  const { data, error } = await supabase.rpc('get_intake_schedule', { p_count: count });
  if (error) throw error;
  return (data || []).map((r) => ({
    name: r.name,
    opensOn: r.opens_on,
    closesOn: r.closes_on,
    capacity: r.capacity,
    stored: r.stored,
    reserved: r.reserved,
    paidWithoutReservation: r.paid_without_reservation,
    spotsLeft: r.spots_left,
    isCurrent: r.is_current,
  }));
}

/** Sets an intake's number of spots, creating its row if it was worked out. */
export async function setIntakeCapacity(intake, capacity) {
  const { data: existing, error: findError } = await supabase
    .from('intakes')
    .select('id')
    .eq('opens_on', intake.opensOn)
    .maybeSingle();
  if (findError) throw findError;
  const { error } = existing
    ? await supabase.from('intakes').update({ capacity }).eq('id', existing.id)
    : await supabase.from('intakes').insert({ name: intake.name, opens_on: intake.opensOn, closes_on: intake.closesOn, capacity });
  if (error) throw error;
}

const fromRow = (r) => ({
  id: r.id,
  intakeOpensOn: r.intake_opens_on,
  intakeName: r.intake_name,
  fullName: r.full_name,
  email: r.email || '',
  phone: r.phone || '',
  depositAmount: Number(r.deposit_amount) || 0,
  paidOn: r.paid_on,
  method: r.method,
  paymentRef: r.payment_ref || '',
  status: r.status,
  notes: r.notes || '',
  plan: r.plan || '',
  monthlyAmount: r.monthly_amount === null || r.monthly_amount === undefined ? '' : Number(r.monthly_amount),
  months: r.months ?? '',
  startDate: r.start_date || '',
  startedAt: r.started_at || null,
});

// The plan fields as database columns ('' becomes null).
const planColumns = (r) => ({
  plan: r.plan || null,
  monthly_amount: r.monthlyAmount === '' || r.monthlyAmount === undefined ? null : Number(r.monthlyAmount),
  months: r.months === '' || r.months === undefined ? null : Number(r.months),
  start_date: r.startDate || null,
});

/** Every waiting-list entry for the given intakes (by opens_on). */
export async function fetchReservations(opensOnDates) {
  const { data, error } = await supabase
    .from('intake_reservations')
    .select('*')
    .in('intake_opens_on', opensOnDates)
    .order('paid_on', { ascending: true });
  if (error) throw error;
  return (data || []).map(fromRow);
}

export async function addReservation(r, createdBy) {
  const { data, error } = await supabase
    .from('intake_reservations')
    .insert({
      intake_opens_on: r.intakeOpensOn,
      intake_name: r.intakeName,
      full_name: r.fullName.trim(),
      email: r.email.trim().toLowerCase() || null,
      phone: r.phone.trim() || null,
      deposit_amount: Number(r.depositAmount) || 0,
      paid_on: r.paidOn,
      method: r.method,
      payment_ref: r.paymentRef || null,
      notes: r.notes.trim() || null,
      ...planColumns(r),
      created_by: createdBy || null,
    })
    .select()
    .single();
  if (error) throw error;
  return fromRow(data);
}

export async function updateReservation(id, changes) {
  const patch = { updated_at: new Date().toISOString() };
  if (changes.status) patch.status = changes.status;
  if (changes.intakeOpensOn) {
    patch.intake_opens_on = changes.intakeOpensOn;
    patch.intake_name = changes.intakeName;
  }
  const { error } = await supabase.from('intake_reservations').update(patch).eq('id', id);
  if (error) throw error;
}

/** Edits an entry's details (everything the Add form sets). */
export async function editReservation(id, r) {
  const { error } = await supabase
    .from('intake_reservations')
    .update({
      intake_opens_on: r.intakeOpensOn,
      intake_name: r.intakeName,
      full_name: r.fullName.trim(),
      email: r.email.trim().toLowerCase() || null,
      phone: r.phone.trim() || null,
      deposit_amount: Number(r.depositAmount) || 0,
      paid_on: r.paidOn,
      method: r.method,
      notes: r.notes.trim() || null,
      ...planColumns(r),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw error;
}

/** Starts someone's membership (start_reserved_membership, 116): portal
 * access, start date, expected total without the deposit, and Joined.
 * Returns { email, fullName, expectedTotal }. */
export async function startReservedMembership(id) {
  const { data, error } = await supabase.rpc('start_reserved_membership', { p_reservation_id: id });
  if (error) throw error;
  const row = data?.[0] || {};
  return { email: row.email, fullName: row.full_name, expectedTotal: row.expected_total === null ? null : Number(row.expected_total) };
}

export async function deleteReservation(id) {
  const { error } = await supabase.from('intake_reservations').delete().eq('id', id);
  if (error) throw error;
}

/** Completed R300 payments (last 90 days) not on any waiting list yet. */
export async function fetchUnlinkedDeposits() {
  const { data, error } = await supabase.rpc('get_unlinked_deposits');
  if (error) throw error;
  return (data || []).map((d) => ({
    source: d.source,
    ref: d.ref,
    name: d.name || '',
    email: d.email || '',
    amount: Number(d.amount) || 0,
    paidOn: d.paid_on,
  }));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** '2026-11-16' -> '16 Nov' */
export function shortDate(iso) {
  if (!iso) return '';
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}
