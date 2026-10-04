// Core Foundations Pathway persistence (supabase/102_core_pathway.sql): the
// member's lane arrangement, weekly pace and checkpoint bookings. What they
// have actually completed stays in roadmap_items / roadmap_item_subtasks.
// Only called for real sessions; Mock Member keeps all of this local.

import { supabase } from './supabase';

/** The caller's pathway (created on first call) plus their real 1-on-1 dates. */
export async function fetchMyPathway() {
  const { data, error } = await supabase.rpc('get_my_pathway');
  if (error) throw error;
  return {
    startedOn: data.started_on,
    weeklyHours: data.weekly_hours,
    labOrder: data.lab_order || [],
    certStarts: data.cert_starts || {},
    checkpoints: data.checkpoints || {},
    meetingDates: data.meeting_dates || [],
  };
}

export async function saveMyPathway({ labOrder, certStarts, weeklyHours }) {
  const { error } = await supabase.rpc('save_my_pathway', {
    p_lab_order: labOrder,
    p_cert_starts: certStarts,
    p_weekly_hours: weeklyHours,
  });
  if (error) throw error;
}

/** Records "I've booked my checkpoint 1-on-1" and returns the updated checkpoints. */
export async function bookMyPathwayCheckpoint(at) {
  const { data, error } = await supabase.rpc('book_my_pathway_checkpoint', { p_checkpoint: at });
  if (error) throw error;
  return data || {};
}

/** Staff: one member's pathway row, or null if they haven't opened it yet. */
export async function fetchMemberPathway(email) {
  const { data, error } = await supabase
    .from('member_pathways')
    .select('started_on, weekly_hours, lab_order, cert_starts, checkpoints, updated_at')
    .eq('member_email', email.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    startedOn: data.started_on,
    weeklyHours: data.weekly_hours,
    labOrder: data.lab_order || [],
    certStarts: data.cert_starts || {},
    checkpoints: data.checkpoints || {},
  };
}
