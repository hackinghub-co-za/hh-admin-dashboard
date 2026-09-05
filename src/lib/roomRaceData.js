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
    mySubmittedAt: row.my_submitted_at,
    myApprovedAt: row.my_approved_at,
    opponentSubmittedAt: row.opponent_submitted_at,
    createdAt: row.created_at,
  };
}

export async function challengeToRoomRace(opponentEmail, opponentName, roomName, roomUrl) {
  const { data, error } = await supabase.rpc('challenge_to_room_race', {
    p_opponent_email: opponentEmail,
    p_opponent_name: opponentName || null,
    p_room_name: roomName,
    p_room_url: roomUrl || null,
  });
  if (error) throw error;
  return data;
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

// Admin-only - fetches every active race with both participants' submission
// state, for the Room Logs tab's approval queue.
export async function fetchAllActiveRoomRaces() {
  const { data, error } = await supabase
    .from('room_races')
    .select('*')
    .eq('status', 'Active')
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
