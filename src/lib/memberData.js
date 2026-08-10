// Supabase persistence for member profiles, manually-added members, and EFT
// payments. Only called for real signed-in admins - Mock Admin has no Supabase
// session, so RLS would reject these calls anyway (see AdminDashboard's
// isMockSession guard).

import { supabase } from './supabase';

/**
 * Fetch all saved member profile overlays, keyed by lowercased email - same shape
 * `memberProfiles` state already expects.
 */
export async function fetchMemberProfiles() {
  const { data, error } = await supabase.from('member_profiles').select('*');
  if (error) throw error;

  const byEmail = {};
  (data || []).forEach((row) => {
    byEmail[row.email.toLowerCase()] = {
      age: row.age || '',
      gender: row.gender || '',
      location: row.location || '',
      specialty: row.specialty || 'Not Set',
      linkedin: row.linkedin || '',
      phone: row.phone || '',
      moneyOwed: Number(row.money_owed) || 0,
      jobReadiness: row.job_readiness || 'Not Started',
      status: row.status || 'Active',
      employmentStatus: row.employment_status || 'Not Set',
      jobTitle: row.job_title || '',
      monthlyRemuneration: Number(row.monthly_remuneration) || 0,
    };
  });
  return byEmail;
}

/** Insert or update a member's profile overlay. */
export async function upsertMemberProfile(email, profile) {
  const { error } = await supabase.from('member_profiles').upsert({
    email: email.toLowerCase(),
    age: profile.age || null,
    gender: profile.gender || null,
    location: profile.location || null,
    specialty: profile.specialty || null,
    linkedin: profile.linkedin || null,
    phone: profile.phone || null,
    money_owed: profile.moneyOwed || 0,
    job_readiness: profile.jobReadiness || null,
    status: profile.status || 'Active',
    employment_status: profile.employmentStatus || null,
    job_title: profile.jobTitle || null,
    monthly_remuneration: profile.monthlyRemuneration || 0,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

/** Fetch members added by hand, in the same shape the local roster map uses. */
export async function fetchManualMembers() {
  const { data, error } = await supabase.from('manual_members').select('*');
  if (error) throw error;

  return (data || []).map((row) => ({
    email: row.email,
    member: row.member,
    firstPaymentDate: row.start_date,
    lastPaymentDate: row.start_date,
    lastPlan: row.last_plan,
    totalSpent: Number(row.total_spent) || 0,
    paymentCount: 0,
  }));
}

/** Insert a manually-added member. */
export async function insertManualMember({ member, email, startDate, lastPlan, totalSpent }) {
  const { error } = await supabase.from('manual_members').upsert({
    email: email.toLowerCase(),
    member,
    start_date: startDate,
    last_plan: lastPlan,
    total_spent: Number(totalSpent) || 0,
  });
  if (error) throw error;
}

/**
 * Fetch manually-recorded EFT payments, mapped into the same shape as the
 * PayFast-derived `payments` entries. Local ids are offset well past the JSON
 * import's 1-225 range so they never collide.
 */
export async function fetchEftPayments() {
  const { data, error } = await supabase.from('eft_payments').select('*').order('date', { ascending: false });
  if (error) throw error;

  return (data || []).map((row) => ({
    id: 10000 + row.id,
    pfId: row.pf_id,
    member: row.member,
    email: row.email,
    type: 'Funds Received',
    plan: row.plan,
    amount: Number(row.amount),
    fee: Number(row.fee) || 0,
    net: Number(row.net),
    fundingType: row.funding_type || 'EFT',
    date: row.date,
    status: row.status || 'COMPLETE',
  }));
}

/** Insert a manually-recorded EFT payment. */
export async function insertEftPayment(payment) {
  const { error } = await supabase.from('eft_payments').insert({
    pf_id: payment.pfId,
    member: payment.member,
    email: payment.email,
    plan: payment.plan,
    amount: payment.amount,
    fee: payment.fee || 0,
    net: payment.net,
    funding_type: payment.fundingType || 'EFT',
    date: payment.date,
    status: payment.status || 'COMPLETE',
    bank_reference: payment.bankReference || null,
    notes: payment.notes || null,
  });
  if (error) throw error;
}
