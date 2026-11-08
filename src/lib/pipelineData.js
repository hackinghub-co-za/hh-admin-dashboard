// Sales pipeline tracker - people interested in or about to join Hacking
// Hub, tracked from first contact through to actually joining (or not).
// (supabase/083_pipeline_prospects.sql). Admin-only, direct table writes -
// the RLS "admins manage pipeline prospects" policy already gates every
// operation, same as matchmakerData.js's admin-only functions.

import { supabase } from './supabase';

function mapProspectRow(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    phone: row.phone,
    phase: row.phase,
    source: row.source,
    notes: row.notes,
    sortOrder: row.sort_order,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at || null,
    leadChannel: row.lead_channel || '',
    followUpOn: row.follow_up_on || '',
    linkedinUrl: row.linkedin_url || '',
  };
}

/** Every prospect across every phase, ordered so a phase column just
 * filters this in place and already reads top-to-bottom in the right
 * card order. */
export async function fetchProspects() {
  const { data, error } = await supabase
    .from('pipeline_prospects')
    .select('id, full_name, email, phone, phase, source, notes, sort_order, created_by, created_at, updated_at, archived_at, lead_channel, follow_up_on, linkedin_url')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data || []).map(mapProspectRow);
}

/** Adds a new prospect, at the end of its starting phase's column
 * (sort_order = current max + 1 in that phase, computed client-side from
 * the board's own already-loaded state - cheap, and avoids a round trip
 * just to find the next number). */
export async function addProspect({ fullName, email, phone, phase, source, notes, sortOrder, leadChannel, followUpOn, linkedinUrl }, createdBy) {
  const { data, error } = await supabase
    .from('pipeline_prospects')
    .insert({
      full_name: fullName.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      phase: phase || 'Lead',
      source: source?.trim() || null,
      notes: notes?.trim() || null,
      lead_channel: leadChannel || null,
      follow_up_on: followUpOn || null,
      linkedin_url: normaliseLinkedIn(linkedinUrl),
      sort_order: sortOrder ?? 0,
      created_by: createdBy || null,
    })
    .select('id, full_name, email, phone, phase, source, notes, sort_order, created_by, created_at, updated_at, archived_at, lead_channel, follow_up_on, linkedin_url')
    .single();
  if (error) throw error;
  return mapProspectRow(data);
}

/** Edits a prospect's own details - name/contact/source/notes. Does not
 * touch phase/sort_order, which move independently via
 * updateProspectPhase (a drag) so the two concerns never fight over the
 * same call. */
export async function updateProspect(id, { fullName, email, phone, source, notes, leadChannel, followUpOn, linkedinUrl }) {
  const { error } = await supabase
    .from('pipeline_prospects')
    .update({
      full_name: fullName.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      source: source?.trim() || null,
      notes: notes?.trim() || null,
      lead_channel: leadChannel || null,
      follow_up_on: followUpOn || null,
      linkedin_url: normaliseLinkedIn(linkedinUrl),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw error;
}

/** Moves a card - a drag to a new phase, a reorder within the same
 * phase, or both at once. updated_at only actually reflects a phase
 * change (a same-column reorder isn't a pipeline "update" worth surfacing
 * as a staleness reset on the card). */
export async function updateProspectPhase(id, phase, sortOrder, phaseChanged) {
  const patch = { phase, sort_order: sortOrder };
  if (phaseChanged) patch.updated_at = new Date().toISOString();
  const { error } = await supabase.from('pipeline_prospects').update(patch).eq('id', id);
  if (error) throw error;
}

/** Removes a prospect entirely - no soft-delete/opt-out concept here,
 * unlike member-facing tables: nobody but an admin ever sees this board,
 * so there's no consent story to preserve by keeping the row around. */
export async function deleteProspect(id) {
  const { error } = await supabase.from('pipeline_prospects').delete().eq('id', id);
  if (error) throw error;
}

/** A typed LinkedIn link, with https:// added if it was left off; null when blank. */
export function normaliseLinkedIn(value) {
  const v = (value || '').trim();
  if (!v) return null;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

// The two phases a reach-out date applies to (follow_up_on).
export const FOLLOW_UP_PHASES = ['Contacted', 'Ready to Join'];

/** Today in South Africa, 'YYYY-MM-DD'. */
export function sastToday(now = new Date()) {
  return now.toLocaleDateString('en-CA', { timeZone: 'Africa/Johannesburg' });
}

/** 'overdue' | 'today' | 'upcoming' | null for a card's reach-out date. */
export function followUpStatus(prospect, today = sastToday()) {
  if (!prospect?.followUpOn || !FOLLOW_UP_PHASES.includes(prospect.phase)) return null;
  if (prospect.followUpOn < today) return 'overdue';
  if (prospect.followUpOn === today) return 'today';
  return 'upcoming';
}

// Cards not updated for 21 days come off the board on their own
// (archive_stale_pipeline_prospects(), 083_pipeline_prospects.sql) but are
// kept; any real update brings one back automatically.
export const STALE_AFTER_DAYS = 21;

/** Days left before an untouched card comes off the board (0 = due). */
export function daysUntilRemoved(updatedAt, now = Date.now()) {
  if (!updatedAt) return STALE_AFTER_DAYS;
  const idle = Math.floor((now - new Date(updatedAt).getTime()) / 86400000);
  return Math.max(0, STALE_AFTER_DAYS - idle);
}

/** Puts a removed card back on the board, as if it had just been updated. */
export async function restoreProspect(id) {
  const { error } = await supabase
    .from('pipeline_prospects')
    .update({ archived_at: null, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

function mapNoteRow(row) {
  return { id: row.id, prospectId: row.prospect_id, body: row.body, authorEmail: row.author_email || '', createdAt: row.created_at };
}

/** Every progress note, grouped by card id, newest first within each. */
export async function fetchAllProspectNotes() {
  const { data, error } = await supabase
    .from('pipeline_notes')
    .select('id, prospect_id, body, author_email, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapNoteRow).reduce((acc, n) => {
    (acc[n.prospectId] ||= []).push(n);
    return acc;
  }, {});
}

/** Adds a timestamped progress note. The database also marks the card as
 * updated, which resets its 21 days and brings it back if it was removed. */
export async function addProspectNote(prospectId, body, authorEmail) {
  const { data, error } = await supabase
    .from('pipeline_notes')
    .insert({ prospect_id: prospectId, body: body.trim(), author_email: authorEmail || null })
    .select('id, prospect_id, body, author_email, created_at')
    .single();
  if (error) throw error;
  return mapNoteRow(data);
}

export async function deleteProspectNote(id) {
  const { error } = await supabase.from('pipeline_notes').delete().eq('id', id);
  if (error) throw error;
}

/** Every recorded column move (pipeline_phase_changes), oldest first. Only
 * covers cards from 8 November 2026, when recording started. */
export async function fetchPhaseChanges() {
  const { data, error } = await supabase
    .from('pipeline_phase_changes')
    .select('prospect_id, from_phase, to_phase, changed_at')
    .order('changed_at', { ascending: true });
  if (error) throw error;
  return (data || []).map((r) => ({ prospectId: r.prospect_id, fromPhase: r.from_phase, toPhase: r.to_phase, changedAt: r.changed_at }));
}
