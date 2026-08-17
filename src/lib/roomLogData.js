// Daily TryHackMe room logs (supabase/031_daily_room_logs.sql). Members
// submit today's room count + WhatsApp proof confirmation through the
// submit_daily_room_log RPC; admins approve/reject through
// review_daily_room_log, which credits competition_standings on approval.
// Only called for real (non-mock) sessions - Mock Member/Mock Admin have no
// Supabase session, so both portals use local-only demo state instead.

import { supabase } from './supabase';

function mapRow(row) {
  return {
    id: row.id,
    memberEmail: row.member_email,
    logDate: row.log_date,
    roomCount: row.room_count,
    status: row.status,
    reviewedBy: row.reviewed_by || '',
    adminNote: row.admin_note || '',
  };
}

/** The signed-in member's own room logs, most recent first. */
export async function fetchMyRoomLogs() {
  const { data, error } = await supabase
    .from('daily_room_logs')
    .select('id, member_email, log_date, room_count, status, reviewed_by, admin_note')
    .order('log_date', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapRow);
}

/** Submit (or update, while still Pending) today's room count. */
export async function submitDailyRoomLog(roomCount, proofConfirmed) {
  const { error } = await supabase.rpc('submit_daily_room_log', { p_room_count: roomCount, p_proof_confirmed: proofConfirmed });
  if (error) throw error;
}

/** Admin: every room log (RLS grants admins full visibility via is_admin()). */
export async function fetchAllRoomLogs() {
  const { data, error } = await supabase
    .from('daily_room_logs')
    .select('id, member_email, log_date, room_count, status, reviewed_by, admin_note')
    .order('log_date', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapRow);
}

/** Admin: approve or reject a submission - approving credits
 * competition_standings for that member. */
export async function reviewRoomLog(logId, approved, adminNote) {
  const { error } = await supabase.rpc('review_daily_room_log', { p_log_id: logId, p_approved: approved, p_admin_note: adminNote || null });
  if (error) throw error;
}
