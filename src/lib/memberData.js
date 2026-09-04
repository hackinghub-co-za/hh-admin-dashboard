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
      fullName: row.full_name || '',
      age: row.age || '',
      gender: row.gender || '',
      location: row.location || '',
      specialty: row.specialty || 'Not Set',
      linkedin: row.linkedin || '',
      phone: row.phone || '',
      moneyOwed: Number(row.money_owed) || 0,
      jobReadiness: row.job_readiness || 'Not Started',
      interviewsHad: row.interviews_had || 0,
      roadmapTrack: row.roadmap_track || 'Not Assigned',
      roadmapFoundationsApproved: !!row.roadmap_foundations_approved_at,
      status: row.status || 'Active',
      employmentStatus: row.employment_status || 'Not Set',
      jobTitle: row.job_title || '',
      monthlyRemuneration: Number(row.monthly_remuneration) || 0,
      jobPlacedDate: row.job_placed_date || '',
      offboardingReason: row.offboarding_reason || '',
      offboardingNotes: row.offboarding_notes || '',
      offboardingStartedAt: row.offboarding_started_at || '',
      exitFeedbackRating: row.exit_feedback_rating || null,
      exitFeedbackText: row.exit_feedback_text || '',
      leftAt: row.left_at || '',
      onboardedAt: row.onboarded_at || '',
      manualStartDate: row.manual_start_date || '',
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
    interviews_had: profile.interviewsHad || 0,
    roadmap_track: profile.roadmapTrack && profile.roadmapTrack !== 'Not Assigned' ? profile.roadmapTrack : null,
    status: profile.status || 'Active',
    employment_status: profile.employmentStatus || null,
    job_title: profile.jobTitle || null,
    monthly_remuneration: profile.monthlyRemuneration || 0,
    job_placed_date: profile.jobPlacedDate || null,
    offboarding_reason: profile.offboardingReason || null,
    offboarding_notes: profile.offboardingNotes || null,
    offboarding_started_at: profile.offboardingStartedAt || null,
    manual_start_date: profile.manualStartDate || null,
    updated_at: new Date().toISOString(),
    // exit_feedback_rating / exit_feedback_text / left_at are intentionally omitted -
    // those are only ever written by the member themselves via submit_exit_feedback(),
    // never by an admin edit, and omitting a key from an upsert leaves it untouched.
  });
  if (error) throw error;
}

/**
 * Grants (or reactivates) a member's portal access after a payment, via the
 * DB-side grant_member_portal_access() function - creates their
 * member_profiles row if it doesn't exist yet, or flips status back to
 * Active if they'd lapsed/left, without touching any other field. Safe to
 * call after every payment, including renewals.
 */
export async function grantMemberPortalAccess(email, fullName) {
  const { error } = await supabase.rpc('grant_member_portal_access', {
    p_email: email.toLowerCase(),
    p_full_name: fullName || null,
  });
  if (error) throw error;
}

/** Admin-only, and only meant to be called for a member already marked
 * 'Left': permanently deletes their member_profiles row AND records their
 * email in deleted_members so they're filtered out of the roster everywhere
 * it's built, even though their real PayFast payment history still exists.
 * Deliberately scoped to just these two things - reviews, cert calendar
 * entries, room logs, roadmap, and referrals are left untouched (still real
 * records, just no longer linked to a live profile). There's no undo once
 * this runs. */
export async function permanentlyDeleteMember(email, deletedBy) {
  const lowerEmail = email.toLowerCase();
  const { error: deleteError } = await supabase.from('member_profiles').delete().eq('email', lowerEmail);
  if (deleteError) throw deleteError;
  const { error: hideError } = await supabase
    .from('deleted_members')
    .upsert({ email: lowerEmail, deleted_by: deletedBy ? deletedBy.toLowerCase() : null, deleted_at: new Date().toISOString() });
  if (hideError) throw hideError;
}

/** The set of permanently-deleted member emails - every roster built in the
 * admin dashboard filters these out, regardless of real payment history. */
export async function fetchDeletedMemberEmails() {
  const { data, error } = await supabase.from('deleted_members').select('email');
  if (error) throw error;
  return (data || []).map((row) => row.email.toLowerCase());
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

/** Delete a manually-recorded EFT payment. `id` is the raw eft_payments.id - callers using the mapped payments list (fetchEftPayments) must subtract the 10000 offset first. */
export async function deleteEftPayment(id) {
  const { error } = await supabase.from('eft_payments').delete().eq('id', id);
  if (error) throw error;
}

/** Insert a manually-recorded EFT payment. Returns the saved row, mapped the same way fetchEftPayments does, so the caller can trust its id for a later delete. */
export async function insertEftPayment(payment) {
  const { data, error } = await supabase
    .from('eft_payments')
    .insert({
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
    })
    .select()
    .single();
  if (error) throw error;
  return {
    id: 10000 + data.id,
    pfId: data.pf_id,
    member: data.member,
    email: data.email,
    type: 'Funds Received',
    plan: data.plan,
    amount: Number(data.amount),
    fee: Number(data.fee) || 0,
    net: Number(data.net),
    fundingType: data.funding_type || 'EFT',
    date: data.date,
    status: data.status || 'COMPLETE',
  };
}
