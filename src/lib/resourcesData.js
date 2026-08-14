// Persisted Resources data - cert prep, roadmaps, podcasts, books, interview
// playbooks, and CV templates that members share with each other. Only
// called for real (non-mock) sessions - Mock Member has no Supabase session,
// so the Resources tab uses local-only demo state instead.

import { supabase } from './supabase';

/** Fetch every resource, newest first. RLS scopes this to signed-in,
 * approved members only. */
export async function fetchResources() {
  const { data, error } = await supabase
    .from('resources')
    .select('id, category, title, format, description, link, created_by, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    category: row.category,
    title: row.title,
    format: row.format || '',
    description: row.description || '',
    link: row.link || '',
    createdBy: row.created_by || '',
  }));
}

/** Adds a new resource, self-attributed to the current member (RLS enforces
 * created_by can only ever be the caller's own email). */
export async function addResource({ category, title, format, description, link, createdBy }) {
  const { data, error } = await supabase
    .from('resources')
    .insert({
      category,
      title,
      format: format || null,
      description: description || null,
      link: link || null,
      created_by: createdBy.toLowerCase(),
    })
    .select()
    .single();
  if (error) throw error;
  return {
    id: data.id,
    category: data.category,
    title: data.title,
    format: data.format || '',
    description: data.description || '',
    link: data.link || '',
    createdBy: data.created_by || '',
  };
}
