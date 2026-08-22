// Dashboard "Suggested Content" feed (supabase/045_suggested_content.sql) -
// admin-authored content, not a member submission, so members only ever read
// (active rows only); admins have full CRUD. Only called for real (non-mock)
// sessions - Mock Member/Admin have no Supabase session, so both portals use
// local-only demo state instead.

import { supabase } from './supabase';

function mapContent(row) {
  return {
    id: row.id,
    contentType: row.content_type,
    title: row.title,
    url: row.url,
    active: row.active,
  };
}

/** Every active suggestion, newest first. */
export async function fetchSuggestedContent() {
  const { data, error } = await supabase
    .from('suggested_content')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapContent);
}

/** Admin-only: every suggestion regardless of active/inactive. */
export async function fetchAllSuggestedContent() {
  const { data, error } = await supabase.from('suggested_content').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapContent);
}

export async function addSuggestedContent({ contentType, title, url, createdBy }) {
  const { data, error } = await supabase
    .from('suggested_content')
    .insert({ content_type: contentType, title, url, created_by: createdBy ? createdBy.toLowerCase() : null })
    .select()
    .single();
  if (error) throw error;
  return mapContent(data);
}

export async function updateSuggestedContent(id, { contentType, title, url, active }) {
  const { error } = await supabase
    .from('suggested_content')
    .update({ content_type: contentType, title, url, active })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteSuggestedContent(id) {
  const { error } = await supabase.from('suggested_content').delete().eq('id', id);
  if (error) throw error;
}
