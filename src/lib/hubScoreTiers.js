// Single source of truth for Hub Score tier thresholds and rewards -
// finalized numbers, not admin-editable. Used by HubScoreModal.jsx (which
// previously had its own local hardcoded TIERS array), the Leaderboard
// section and tier badges (MemberPortal.jsx), and the admin Claims tab
// (AdminDashboard.jsx). Keep in sync with supabase/093_hub_score.sql /
// 094_hub_score_leaderboard_and_claims.sql's _hub_score_tier_name() /
// _hub_score_tier_min_points() if these numbers ever change.

export const HUB_SCORE_TIERS = [
  { name: 'Newcomer', min: 0, reward: null },
  { name: 'Contributor', min: 100, reward: 'A cool drink and a high five' },
  { name: 'Regular', min: 500, reward: 'Free HH Mousepad' },
  { name: 'Veteran', min: 2000, reward: 'Free HH Top/Hoodie' },
  { name: 'Legend', min: 4000, reward: 'A free cert, up to R6,000' },
];

/** The tier a given point total currently sits in. */
export function getHubScoreTier(points) {
  return HUB_SCORE_TIERS.reduce((best, t) => (points >= t.min ? t : best), HUB_SCORE_TIERS[0]);
}
