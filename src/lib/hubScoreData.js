// Hub Score (supabase/093_hub_score.sql). A composite, never-resetting
// point total across 8 real signals, unlocking reward tiers. Phase 1 is
// read-only - one RPC that computes the caller's own score and breakdown
// on demand; there's no leaderboard or claiming RPC yet.

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
