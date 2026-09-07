// Room Race (supabase/063_room_races.sql) - Phase 2 of the head-to-head
// competitions roadmap. Reuses the daily_room_logs trust model: a
// self-reported proof-confirmed checkbox, final say stays with an admin.

import { supabase } from './supabase';

function mapRace(row) {
  return {
    id: row.id,
    roomName: row.room_name,
    roomUrl: row.room_url || '',
    opponentEmail: row.opponent_email,
    opponentName: row.opponent_name || '',
    isMemberA: row.is_member_a,
    status: row.status,
    winnerEmail: row.winner_email,
    acceptedAt: row.accepted_at,
    mySubmittedAt: row.my_submitted_at,
    myApprovedAt: row.my_approved_at,
    opponentSubmittedAt: row.opponent_submitted_at,
    createdAt: row.created_at,
  };
}

// No room to name any more - that's assigned automatically, once accepted,
// by the daily 8am SAST cron (assign_room_race_rooms() in
// 063_room_races.sql), so neither player picks or previews it.
export async function challengeToRoomRace(opponentEmail, opponentName) {
  const { data, error } = await supabase.rpc('challenge_to_room_race', {
    p_opponent_email: opponentEmail,
    p_opponent_name: opponentName || null,
  });
  if (error) throw error;
  return data;
}

/** The challenged member (member_b) accepts - flips the race to Active and
 * makes it eligible for the next 8am room assignment. */
export async function acceptRoomRace(raceId) {
  const { error } = await supabase.rpc('accept_room_race', { p_race_id: raceId });
  if (error) throw error;
}

/** The challenged member (member_b) turns the challenge down. */
export async function declineRoomRace(raceId) {
  const { error } = await supabase.rpc('decline_room_race', { p_race_id: raceId });
  if (error) throw error;
}

export async function fetchMyRoomRaces() {
  const { data, error } = await supabase.rpc('get_my_room_races');
  if (error) throw error;
  return (data || []).map(mapRace);
}

export async function submitRoomRaceProof(raceId, proofConfirmed) {
  const { error } = await supabase.rpc('submit_room_race_proof', {
    p_race_id: raceId,
    p_proof_confirmed: proofConfirmed,
  });
  if (error) throw error;
}

// Admin-only - fetches every active, room-assigned race with both
// participants' submission state, for the Room Logs tab's approval queue.
// Excludes Active races still waiting on the 8am room assignment (nothing
// for an admin to approve yet) and Pending ones (not even accepted yet).
export async function fetchAllActiveRoomRaces() {
  const { data, error } = await supabase
    .from('room_races')
    .select('*')
    .eq('status', 'Active')
    .not('room_name', 'is', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    roomName: row.room_name,
    roomUrl: row.room_url || '',
    memberAEmail: row.member_a_email,
    memberAName: row.member_a_name || '',
    memberBEmail: row.member_b_email,
    memberBName: row.member_b_name || '',
    memberASubmittedAt: row.member_a_submitted_at,
    memberAApprovedAt: row.member_a_approved_at,
    memberBSubmittedAt: row.member_b_submitted_at,
    memberBApprovedAt: row.member_b_approved_at,
    createdAt: row.created_at,
  }));
}

export async function approveRoomRaceSubmission(raceId, memberEmail) {
  const { error } = await supabase.rpc('approve_room_race_submission', {
    p_race_id: raceId,
    p_member_email: memberEmail,
  });
  if (error) throw error;
}
