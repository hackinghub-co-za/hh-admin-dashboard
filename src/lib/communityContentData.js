// Dashboard "Community Broadcast" and "Recent Wins" feeds
// (supabase/044_community_content.sql) - admin-authored content, not a
// member submission, so members only ever read (active rows only); admins
// have full CRUD. Only called for real (non-mock) sessions - Mock
// Member/Admin have no Supabase session, so both portals use local-only
// demo state instead.

import { supabase } from './supabase';

function mapBroadcast(row) {
  return {
    id: row.id,
    emoji: row.emoji || '',
    title: row.title,
    body: row.body,
    sortOrder: row.sort_order || 0,
    active: row.active,
  };
}

function mapWin(row) {
  return {
    id: row.id,
    member: row.member_name,
    achievement: row.achievement,
    achievedDate: row.achieved_date,
    linkedinUrl: row.linkedin_url || '',
    active: row.active,
  };
}

/** Every active broadcast, in admin-set display order. */
export async function fetchCommunityBroadcasts() {
  const { data, error } = await supabase
    .from('community_broadcasts')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data || []).map(mapBroadcast);
}

/** Admin-only: every broadcast regardless of active/inactive. */
export async function fetchAllCommunityBroadcasts() {
  const { data, error } = await supabase.from('community_broadcasts').select('*').order('sort_order', { ascending: true });
  if (error) throw error;
  return (data || []).map(mapBroadcast);
}

export async function addCommunityBroadcast({ emoji, title, body, sortOrder, createdBy }) {
  const { data, error } = await supabase
    .from('community_broadcasts')
    .insert({ emoji: emoji || null, title, body, sort_order: sortOrder || 0, created_by: createdBy ? createdBy.toLowerCase() : null })
    .select()
    .single();
  if (error) throw error;
  return mapBroadcast(data);
}

export async function updateCommunityBroadcast(id, { emoji, title, body, sortOrder, active }) {
  const { error } = await supabase
    .from('community_broadcasts')
    .update({ emoji: emoji || null, title, body, sort_order: sortOrder || 0, active })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteCommunityBroadcast(id) {
  const { error } = await supabase.from('community_broadcasts').delete().eq('id', id);
  if (error) throw error;
}

/** Every active win, most recently achieved first. */
export async function fetchCommunityWins() {
  const { data, error } = await supabase
    .from('community_wins')
    .select('*')
    .eq('active', true)
    .order('achieved_date', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapWin);
}

/** Admin-only: every win regardless of active/inactive. */
export async function fetchAllCommunityWins() {
  const { data, error } = await supabase.from('community_wins').select('*').order('achieved_date', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapWin);
}

export async function addCommunityWin({ member, achievement, achievedDate, linkedinUrl, createdBy }) {
  const { data, error } = await supabase
    .from('community_wins')
    .insert({
      member_name: member,
      achievement,
      achieved_date: achievedDate,
      linkedin_url: linkedinUrl || null,
      created_by: createdBy ? createdBy.toLowerCase() : null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapWin(data);
}

export async function updateCommunityWin(id, { member, achievement, achievedDate, linkedinUrl, active }) {
  const { error } = await supabase
    .from('community_wins')
    .update({
      member_name: member,
      achievement,
      achieved_date: achievedDate,
      linkedin_url: linkedinUrl || null,
      active,
    })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteCommunityWin(id) {
  const { error } = await supabase.from('community_wins').delete().eq('id', id);
  if (error) throw error;
}
