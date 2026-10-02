// Portal usage analytics (supabase/050_portal_events.sql). Fire-and-forget
// writes from the member side - never awaited in a render path, same
// pattern as recordDailyLogin() in loginStreakData.js. Every call site is
// expected to skip entirely under Mock Member (no real session to log
// against), same convention as the rest of this app.
import { supabase } from './supabase';

export async function logPortalEvent(eventType, metadata = {}) {
  const { error } = await supabase.rpc('log_my_portal_event', {
    p_event_type: eventType,
    p_metadata: metadata,
  });
  if (error) throw error;
}

// Admin-only reads below - each maps to one of the aggregation RPCs so the
// counting/grouping happens in Postgres, not by looping over raw rows
// client-side (this table won't stay roster-sized).

export async function fetchPortalActiveMemberCount(days = 7) {
  const { data, error } = await supabase.rpc('get_portal_active_member_count', { p_days: days });
  if (error) throw error;
  return data;
}

export async function fetchPortalTabEngagement(days = 30) {
  const { data, error } = await supabase.rpc('get_portal_tab_engagement', { p_days: days });
  if (error) throw error;
  return (data || []).map((row) => ({ tab: row.tab, memberCount: row.member_count }));
}

export async function fetchPortalWeeklyTrend(weeks = 8) {
  const { data, error } = await supabase.rpc('get_portal_weekly_trend', { p_weeks: weeks });
  if (error) throw error;
  return (data || []).map((row) => ({ weekStart: row.week_start, activeMembers: row.active_members }));
}

/** Anonymous-safe - fires from App.jsx's mobile gate, which renders before
 * Login even mounts, so there's often no session (and therefore no email)
 * to log against at all. Fire-and-forget like every other write here. */
export async function logMobileBlock() {
  const { error } = await supabase.rpc('log_mobile_block');
  if (error) throw error;
}

export async function fetchMobileBlockCount(days = 7) {
  const { data, error } = await supabase.rpc('get_mobile_block_count', { p_days: days });
  if (error) throw error;
  return data;
}

// Charts for the five newer events (roadmap_item_opened, resource_opened,
// job_board_clicked, leaderboard_viewed, interview_prep_used) - see
// supabase/097_portal_event_charts.sql. Both return empty until those
// events have some real history behind them.

export async function fetchRoadmapItemOpenCounts(days = 90) {
  const { data, error } = await supabase.rpc('get_roadmap_item_open_counts', { p_days: days });
  if (error) throw error;
  return (data || []).map((row) => ({ title: row.title, openCount: row.open_count }));
}

export async function fetchFeatureAdoptionCounts(days = 30) {
  const { data, error } = await supabase.rpc('get_feature_adoption_counts', { p_days: days });
  if (error) throw error;
  return (data || []).map((row) => ({ eventType: row.event_type, memberCount: row.member_count }));
}
