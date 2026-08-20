// Refer a Friend - a member referring someone to the community. Only called
// for real (non-mock) sessions - Mock Member has no Supabase session, so it
// uses local-only demo state instead.

import { supabase } from './supabase';

/** Fetch the current member's own referrals, most recent first. RLS scopes
 * this to only the caller's own submissions. */
export async function fetchMyReferrals() {
  const { data, error } = await supabase
    .from('referrals')
    .select('id, referred_name, referred_linkedin, referred_phone, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    name: row.referred_name,
    linkedin: row.referred_linkedin,
    phone: row.referred_phone || '',
    createdAt: row.created_at,
  }));
}

/** Submits a new referral, self-attributed to the current member (RLS
 * enforces referrer_email can only ever be the caller's own email). */
export async function addReferral({ name, linkedin, phone, referrerEmail }) {
  const { data, error } = await supabase
    .from('referrals')
    .insert({
      referrer_email: referrerEmail.toLowerCase(),
      referred_name: name,
      referred_linkedin: linkedin,
      referred_phone: phone || null,
    })
    .select()
    .single();
  if (error) throw error;
  return {
    id: data.id,
    name: data.referred_name,
    linkedin: data.referred_linkedin,
    phone: data.referred_phone || '',
    createdAt: data.created_at,
  };
}

/** Admin-only: every referral ever submitted, most recent first. RLS rejects
 * this for non-admins. */
export async function fetchAllReferrals() {
  const { data, error } = await supabase
    .from('referrals')
    .select('id, referrer_email, referred_name, referred_linkedin, referred_phone, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    referrerEmail: row.referrer_email,
    name: row.referred_name,
    linkedin: row.referred_linkedin,
    phone: row.referred_phone || '',
    createdAt: row.created_at,
  }));
}
