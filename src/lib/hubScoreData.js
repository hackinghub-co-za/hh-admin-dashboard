// Hub Score (supabase/093_hub_score.sql, supabase/094_hub_score_leaderboard_
// and_claims.sql). A composite, never-resetting point total across 8 real
// signals, unlocking reward tiers. Phase 1 computes the caller's own score;
// Phase 2 adds a ranked leaderboard; Phase 3 adds reward claiming with
// admin review.

import { supabase } from './supabase';

/** The caller's own Hub Score: total, tier progress, and the per-category
 * breakdown behind it - everything the Dashboard stat chip and
 * HubScoreModal need in one round trip. */
export async function fetchMyHubScore() {
  const { data, error } = await supabase.rpc('get_my_hub_score');
  if (error) throw error;
  const row = (data || [])[0];
  if (!row) return null;

  return {
    totalPoints: row.total_points || 0,
    currentTier: row.current_tier,
    nextTier: row.next_tier || null,
    nextTierPoints: row.next_tier_points ?? null,
    pointsToNextTier: row.points_to_next_tier ?? null,
    categories: {
      certs: { points: row.cert_points || 0, count: row.cert_count || 0 },
      roadmap: { points: row.roadmap_points || 0, count: row.roadmap_count || 0 },
      rooms: { points: row.room_points || 0, count: row.room_count || 0 },
      streak: { points: row.streak_points || 0, days: row.longest_streak_days || 0 },
      tenure: { points: row.tenure_points || 0, months: row.tenure_months || 0 },
      study: { points: row.study_points || 0, count: row.study_session_count || 0 },
      events: { points: row.event_points || 0, count: row.event_count || 0 },
      job: { points: row.job_points || 0, landed: !!row.job_landed },
    },
  };
}

/** Top N members by Hub Score, plus the caller's own row pinned in if they
 * fall outside that top N (get_hub_score_leaderboard, 094). No name/avatar
 * here - match against the directory client-side, same as every other
 * leaderboard in this app. */
export async function fetchHubScoreLeaderboard(limit = 10) {
  const { data, error } = await supabase.rpc('get_hub_score_leaderboard', { p_limit: limit });
  if (error) throw error;
  return (data || []).map((row) => ({
    rank: row.rank,
    email: row.member_email,
    totalPoints: row.total_points,
    tier: row.tier,
  }));
}

/** The caller's own Hub Score tier claims - one per tier ever claimed,
 * Pending/Approved/Rejected/Fulfilled (hub_score_tier_claims, RLS scopes
 * this to their own rows). */
export async function fetchMyHubScoreClaims() {
  const { data, error } = await supabase
    .from('hub_score_tier_claims')
    .select('id, tier, status, note, claimed_at, reviewed_at')
    .order('claimed_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    tier: row.tier,
    status: row.status,
    note: row.note || '',
    claimedAt: row.claimed_at,
    reviewedAt: row.reviewed_at,
  }));
}

/** Claims a reward for a tier the member has (really) crossed. The BEFORE
 * INSERT trigger (_validate_hub_score_tier_claim, 094) re-derives their
 * real total_points server-side and rejects the insert outright if
 * they're not actually there yet, regardless of what this sends. Mirrors
 * createMyMerchOrder's shape (merchStoreData.js). */
export async function claimHubScoreTier({ memberEmail, tier }) {
  const { data, error } = await supabase
    .from('hub_score_tier_claims')
    .insert({ member_email: memberEmail.toLowerCase(), tier })
    .select()
    .single();
  if (error) throw error;
  return {
    id: data.id,
    tier: data.tier,
    status: data.status,
    note: data.note || '',
    claimedAt: data.claimed_at,
    reviewedAt: data.reviewed_at,
  };
}

/** Admin: every Hub Score tier claim across all members, most recent
 * first. Relies on the admin FOR ALL RLS policy, same shape as
 * fetchAllMerchOrders. member_name is deliberately NOT denormalized here
 * (unlike merch_orders, which stores member_name) - the admin UI already
 * has memberRoster loaded for the Members tab to look names up by email;
 * merch orders needed its own copy historically because a PayFast-sourced
 * order couldn't always assume that roster was populated. */
export async function fetchAllHubScoreClaims() {
  const { data, error } = await supabase
    .from('hub_score_tier_claims')
    .select('id, member_email, tier, status, note, claimed_at, reviewed_by, reviewed_at')
    .order('claimed_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    memberEmail: row.member_email,
    tier: row.tier,
    status: row.status,
    note: row.note || '',
    claimedAt: row.claimed_at,
    reviewedBy: row.reviewed_by || '',
    reviewedAt: row.reviewed_at,
  }));
}

/** Admin-only: Approve/Reject/Mark Fulfilled, optionally with a note
 * (e.g. a rejection reason). Mirrors updateMerchOrderStatus's shape -
 * a plain .from().update() relying on the admin RLS policy, not a
 * dedicated review RPC. */
export async function updateHubScoreClaimStatus(claimId, status, note, reviewerEmail) {
  const update = { status, reviewed_at: new Date().toISOString(), reviewed_by: reviewerEmail || null };
  if (note !== undefined) update.note = note || null;
  const { error } = await supabase.from('hub_score_tier_claims').update(update).eq('id', claimId);
  if (error) throw error;
}
