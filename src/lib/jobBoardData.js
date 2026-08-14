// Persisted Job Board data - roles members and Hacking Hub's network post.
// Only called for real (non-mock) sessions - Mock Member has no Supabase
// session, so the Job Board tab uses local-only demo state instead.

import { supabase } from './supabase';

/** Fetch every job listing, most recently posted first. RLS scopes this to
 * signed-in, approved members only. */
export async function fetchJobBoard() {
  const { data, error } = await supabase
    .from('job_board')
    .select('id, title, company, location, type, salary, description, tags, link, posted_date, created_by')
    .order('posted_date', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    title: row.title,
    company: row.company,
    location: row.location || '',
    type: row.type,
    salary: row.salary || '',
    description: row.description || '',
    tags: row.tags ? row.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    link: row.link || '',
    posted: row.posted_date,
    createdBy: row.created_by || '',
  }));
}

/** Adds a new job listing, self-attributed to the current member (RLS
 * enforces created_by can only ever be the caller's own email). */
export async function addJobListing({ title, company, location, type, salary, description, tags, link, createdBy }) {
  const { data, error } = await supabase
    .from('job_board')
    .insert({
      title,
      company,
      location: location || null,
      type,
      salary: salary || null,
      description: description || null,
      tags: Array.isArray(tags) ? tags.join(',') : (tags || null),
      link: link || null,
      created_by: createdBy.toLowerCase(),
    })
    .select()
    .single();
  if (error) throw error;
  return {
    id: data.id,
    title: data.title,
    company: data.company,
    location: data.location || '',
    type: data.type,
    salary: data.salary || '',
    description: data.description || '',
    tags: data.tags ? data.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    link: data.link || '',
    posted: data.posted_date,
    createdBy: data.created_by || '',
  };
}
