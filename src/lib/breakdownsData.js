// Weekly incident breakdowns (supabase/068_weekly_breakdowns.sql). A
// facilitator drafts one per week; a Community Manager or the founder
// approves it; the weekly-breakdown-email edge function sends it Friday
// 08:00 SAST and marks it Sent. Members only ever see Sent editions, on
// the Breakdowns tab.

import { supabase } from './supabase';

function mapRow(row) {
  return {
    id: row.id,
    title: row.title,
    sourceLabel: row.source_label || '',
    difficulty: row.difficulty || '',
    blurb: row.blurb || '',
    bodyMd: row.body_md || '',
    fullUrl: row.full_url || '',
    sendDate: row.send_date,
    status: row.status,
    approvedBy: row.approved_by || '',
    approvedAt: row.approved_at || null,
    sentAt: row.sent_at || null,
    recipientCount: row.recipient_count,
    createdBy: row.created_by || '',
  };
}

const FULL_COLS = 'id, title, source_label, difficulty, blurb, body_md, full_url, send_date, status, approved_by, approved_at, sent_at, recipient_count, created_by';

/** Member-facing: every breakdown that has actually gone out, newest first.
 *  RLS ("members read sent breakdowns") already restricts this to Sent. */
export async function fetchSentBreakdowns() {
  const { data, error } = await supabase
    .from('weekly_breakdowns')
    .select(FULL_COLS)
    .order('send_date', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapRow);
}

/** Admin / CM: every breakdown regardless of status, for the management
 *  view. RLS ("staff manage breakdowns") gates this to is_admin OR
 *  is_community_manager. */
export async function fetchAllBreakdowns() {
  const { data, error } = await supabase
    .from('weekly_breakdowns')
    .select(FULL_COLS)
    .order('send_date', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapRow);
}

/** Admin / CM: create a new Draft breakdown. */
export async function createBreakdown({ title, sourceLabel, difficulty, blurb, bodyMd, fullUrl, sendDate, createdBy }) {
  const { data, error } = await supabase
    .from('weekly_breakdowns')
    .insert({
      title,
      source_label: sourceLabel || null,
      difficulty: difficulty || null,
      blurb,
      body_md: bodyMd,
      full_url: fullUrl || null,
      send_date: sendDate,
      created_by: createdBy || null,
    })
    .select(FULL_COLS)
    .single();
  if (error) throw error;
  return mapRow(data);
}

/** Admin / CM: edit a Draft's plan fields. */
export async function updateBreakdown(id, { title, sourceLabel, difficulty, blurb, bodyMd, fullUrl, sendDate }) {
  const { error } = await supabase
    .from('weekly_breakdowns')
    .update({
      title,
      source_label: sourceLabel || null,
      difficulty: difficulty || null,
      blurb,
      body_md: bodyMd,
      full_url: fullUrl || null,
      send_date: sendDate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw error;
}

/** Admin / CM: sign off a Draft for Friday's send. */
export async function approveBreakdown(id) {
  const { error } = await supabase.rpc('approve_weekly_breakdown', { p_id: id });
  if (error) throw error;
}

/** Admin / CM: pull an approval back to Draft. */
export async function unapproveBreakdown(id) {
  const { error } = await supabase.rpc('unapprove_weekly_breakdown', { p_id: id });
  if (error) throw error;
}

/** Admin / CM: delete a breakdown (only makes sense for a Draft). */
export async function deleteBreakdown(id) {
  const { error } = await supabase.from('weekly_breakdowns').delete().eq('id', id);
  if (error) throw error;
}
