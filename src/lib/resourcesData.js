// Persisted Resources data - cert prep, roadmaps, podcasts, books, interview
// playbooks, and CV templates that members share with each other. Only
// called for real (non-mock) sessions - Mock Member has no Supabase session,
// so the Resources tab uses local-only demo state instead.

import { supabase } from './supabase';
import { normalizeSteps } from './resourceHelpers';

const COLUMNS = 'id, category, title, format, description, link, steps, created_by, created_at';

function mapRow(row) {
  return {
    id: row.id,
    category: row.category,
    title: row.title,
    format: row.format || '',
    description: row.description || '',
    link: row.link || '',
    steps: normalizeSteps(row.steps),
    createdBy: row.created_by || '',
  };
}

/** Fetch every resource, newest first. RLS scopes this to signed-in,
 * approved members only. */
export async function fetchResources() {
  const { data, error } = await supabase
    .from('resources')
    .select(COLUMNS)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapRow);
}

/** Adds a new resource, self-attributed to the current member (RLS enforces
 * created_by can only ever be the caller's own email). `steps` is optional:
 * [{ id, title, link }] - see resourceHelpers.parseStepLines. */
export async function addResource({ category, title, format, description, link, steps, createdBy }) {
  const { data, error } = await supabase
    .from('resources')
    .insert({
      category,
      title,
      format: format || null,
      description: description || null,
      link: link || null,
      steps: steps || [],
      created_by: createdBy.toLowerCase(),
    })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return mapRow(data);
}

/** The caller's own progress: { [resourceId]: { completed, steps: [stepId] } }.
 * RLS only ever returns the caller's rows. */
export async function fetchMyResourceProgress() {
  const { data, error } = await supabase.from('resource_progress').select('resource_id, step_id');
  if (error) throw error;
  const out = {};
  (data || []).forEach((row) => {
    const entry = out[row.resource_id] || (out[row.resource_id] = { completed: false, steps: [] });
    if (row.step_id === '') entry.completed = true;
    else entry.steps.push(row.step_id);
  });
  return out;
}

/** Marks a step (stepId) or the whole resource (stepId null) done / not done.
 * The database applies the "all steps = complete" rules and returns the
 * resulting { completed, steps } for that resource. */
export async function setResourceProgress(resourceId, stepId, done) {
  const { data, error } = await supabase.rpc('set_my_resource_progress', {
    p_resource_id: resourceId,
    p_step_id: stepId || null,
    p_done: done,
  });
  if (error) throw error;
  return { completed: !!data?.completed, steps: data?.done_steps || [] };
}
