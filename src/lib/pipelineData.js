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
  };
}

/** Every prospect across every phase, ordered so a phase column just
 * filters this in place and already reads top-to-bottom in the right
 * card order. */
export async function fetchProspects() {
  const { data, error } = await supabase
    .from('pipeline_prospects')
    .select('id, full_name, email, phone, phase, source, notes, sort_order, created_by, created_at, updated_at')
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data || []).map(mapProspectRow);
}

/** Adds a new prospect, at the end of its starting phase's column
 * (sort_order = current max + 1 in that phase, computed client-side from
 * the board's own already-loaded state - cheap, and avoids a round trip
 * just to find the next number). */
export async function addProspect({ fullName, email, phone, phase, source, notes, sortOrder }, createdBy) {
  const { data, error } = await supabase
    .from('pipeline_prospects')
    .insert({
      full_name: fullName.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      phase: phase || 'Lead',
      source: source?.trim() || null,
      notes: notes?.trim() || null,
      sort_order: sortOrder ?? 0,
      created_by: createdBy || null,
    })
    .select('id, full_name, email, phone, phase, source, notes, sort_order, created_by, created_at, updated_at')
    .single();
  if (error) throw error;
  return mapProspectRow(data);
}

/** Edits a prospect's own details - name/contact/source/notes. Does not
 * touch phase/sort_order, which move independently via
 * updateProspectPhase (a drag) so the two concerns never fight over the
 * same call. */
export async function updateProspect(id, { fullName, email, phone, source, notes }) {
  const { error } = await supabase
    .from('pipeline_prospects')
    .update({
      full_name: fullName.trim(),
      email: email?.trim() || null,
      phone: phone?.trim() || null,
      source: source?.trim() || null,
      notes: notes?.trim() || null,
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
