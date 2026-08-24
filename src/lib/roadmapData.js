// Persisted per-member roadmap checklists (supabase/028_roadmap.sql). Admins
// author the plan (phase, category, title, detail, ordering); members can
// only toggle their own items done/not done, via the toggle_my_roadmap_item
// RPC rather than a direct table write. Only called for real (non-mock)
// sessions - Mock Member/Mock Admin have no Supabase session, so both portals
// use local-only demo state instead.

import { supabase } from './supabase';

function mapRow(row) {
  return {
    id: row.id,
    memberEmail: row.member_email,
    phase: row.phase,
    category: row.category,
    title: row.title,
    detail: row.detail || '',
    dueDate: row.due_date || null,
    completed: !!row.completed,
    sortOrder: row.sort_order || 0,
  };
}

/** Fetch the signed-in member's own roadmap items, in display order. */
export async function fetchMyRoadmap() {
  const { data, error } = await supabase
    .from('roadmap_items')
    .select('id, member_email, phase, category, title, detail, due_date, completed, sort_order')
    .order('phase', { ascending: true })
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data || []).map(mapRow);
}

/** Toggle one of the caller's own items - the RPC enforces ownership and
 * only ever writes `completed`. */
export async function toggleMyRoadmapItem(itemId, completed) {
  const { error } = await supabase.rpc('toggle_my_roadmap_item', { p_item_id: itemId, p_completed: completed });
  if (error) throw error;
}

/** Self-report progress (a number or percentage, e.g. "3/6" or "45%") and a
 * due date on one of the caller's own items - the RPC enforces ownership and
 * only ever writes `detail`/`due_date`. */
export async function updateMyRoadmapItemProgress(itemId, { detail, dueDate }) {
  const { error } = await supabase.rpc('update_my_roadmap_item_progress', {
    p_item_id: itemId,
    p_detail: detail || null,
    p_due_date: dueDate || null,
  });
  if (error) throw error;
}

/** The caller's own assigned track (e.g. "Offensive Security"), or null if
 * an admin hasn't assigned one yet. */
export async function fetchMyRoadmapTrack() {
  const { data, error } = await supabase.rpc('get_my_roadmap_track');
  if (error) throw error;
  return data || null;
}

/** Whether an admin has approved the caller's Core Foundations progress -
 * reaching the completion count alone isn't enough, this is the deliberate
 * anti-cheating gate on top of it (see 035_roadmap_foundations_approval.sql). */
export async function fetchMyRoadmapFoundationsApproved() {
  const { data, error } = await supabase.rpc('get_my_roadmap_foundations_approved');
  if (error) throw error;
  return !!data;
}

/** Admin: approve or revoke a member's Core Foundations progress. Reading
 * the current state doesn't need a dedicated fetch here - it's already part
 * of the `memberProfiles` map AdminDashboard loads via fetchMemberProfiles()
 * (see memberData.js), same as roadmapTrack. */
export async function setRoadmapFoundationsApproval(email, approved) {
  const { error } = await supabase
    .from('member_profiles')
    .update({ roadmap_foundations_approved_at: approved ? new Date().toISOString() : null })
    .eq('email', email.toLowerCase());
  if (error) throw error;
}

/** Admin: fetch every member's roadmap items in one call (RLS grants admins
 * full visibility via is_admin()) - used to compute each member's percent
 * complete without loading their checklist individually first. */
export async function fetchAllRoadmapItems() {
  const { data, error } = await supabase
    .from('roadmap_items')
    .select('id, member_email, phase, category, title, detail, due_date, completed, sort_order');
  if (error) throw error;
  return (data || []).map(mapRow);
}

/** Admin: fetch any member's roadmap items (RLS grants admins full visibility
 * via is_admin()). */
export async function fetchRoadmapForMember(email) {
  const { data, error } = await supabase
    .from('roadmap_items')
    .select('id, member_email, phase, category, title, detail, due_date, completed, sort_order')
    .eq('member_email', email.toLowerCase())
    .order('phase', { ascending: true })
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data || []).map(mapRow);
}

/** Admin: add a new roadmap item for a member. */
export async function addRoadmapItem({ memberEmail, phase, category, title, detail, dueDate, sortOrder }) {
  const { data, error } = await supabase
    .from('roadmap_items')
    .insert({
      member_email: memberEmail.toLowerCase(),
      phase,
      category,
      title,
      detail: detail || null,
      due_date: dueDate || null,
      sort_order: sortOrder || 0,
    })
    .select()
    .single();
  if (error) throw error;
  return mapRow(data);
}

/** Admin: edit an existing item's plan fields (and/or its completion). */
export async function updateRoadmapItem(itemId, { phase, category, title, detail, dueDate, completed, sortOrder }) {
  const { error } = await supabase
    .from('roadmap_items')
    .update({
      phase,
      category,
      title,
      detail: detail || null,
      due_date: dueDate || null,
      completed,
      sort_order: sortOrder || 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId);
  if (error) throw error;
}

/** Admin: remove an item from a member's roadmap. */
export async function deleteRoadmapItem(itemId) {
  const { error } = await supabase.from('roadmap_items').delete().eq('id', itemId);
  if (error) throw error;
}
