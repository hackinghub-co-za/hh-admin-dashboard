// Labs (supabase/099_labs.sql). Curated labs are external links with a
// proof URL; Hub Labs run in the portal (content in src/data/labs) and are
// graded server-side - answer keys are never fetched by member code.

import { supabase } from './supabase';

export function mapLab(row) {
  return {
    id: row.id,
    slug: row.slug,
    kind: row.kind,
    title: row.title,
    summary: row.summary || '',
    track: row.track,
    difficulty: row.difficulty,
    estMinutes: row.est_minutes,
    provider: row.provider || '',
    externalUrl: row.external_url || '',
    roadmapItemTitle: row.roadmap_item_title || '',
    isPublished: row.is_published,
    sortOrder: row.sort_order,
  };
}

function mapAttempt(row) {
  return {
    id: row.id,
    labId: row.lab_id,
    status: row.status,
    answers: row.answers || {},
    proofUrl: row.proof_url || '',
    autoScore: row.auto_score,
    autoMax: row.auto_max,
    taskResults: row.task_results || null,
    reviewerScore: row.reviewer_score,
    rubricScores: row.rubric_scores || null,
    feedback: row.feedback || '',
    reviewedBy: row.reviewed_by || '',
    reviewedAt: row.reviewed_at,
    startedAt: row.started_at,
    submittedAt: row.submitted_at,
  };
}

/** Published labs for members; staff see every lab (RLS decides). */
export async function fetchLabs() {
  const { data, error } = await supabase
    .from('labs')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('title', { ascending: true });
  if (error) throw error;
  return (data || []).map(mapLab);
}

/** The caller's own attempts. */
export async function fetchMyLabAttempts() {
  const { data, error } = await supabase.from('lab_attempts').select('*');
  if (error) throw error;
  return (data || []).map(mapAttempt);
}

export async function saveLabProgress(labId, answers) {
  const { error } = await supabase.rpc('save_lab_progress', { p_lab_id: labId, p_answers: answers });
  if (error) throw error;
}

/** Grades objective tasks server-side; returns { autoScore, autoMax, taskResults }. */
export async function submitLabAttempt(labId, answers) {
  const { data, error } = await supabase.rpc('submit_lab_attempt', { p_lab_id: labId, p_answers: answers });
  if (error) throw error;
  return { autoScore: data?.auto_score ?? null, autoMax: data?.auto_max ?? null, taskResults: data?.task_results || null };
}

export async function submitCuratedLabProof(labId, proofUrl) {
  const { error } = await supabase.rpc('submit_curated_lab_proof', { p_lab_id: labId, p_proof_url: proofUrl });
  if (error) throw error;
}

/** Model answers + results, only after the caller has submitted. Keyed by task key. */
export async function fetchLabDebrief(labId) {
  const { data, error } = await supabase.rpc('get_lab_debrief', { p_lab_id: labId });
  if (error) throw error;
  return data || {};
}

// ---- Staff (admins + community managers) ----

export async function fetchLabAttemptsForReview() {
  const { data, error } = await supabase.rpc('get_lab_attempts_for_review');
  if (error) throw error;
  return (data || []).map((row) => ({
    ...mapAttempt(row),
    labSlug: row.lab_slug,
    labTitle: row.lab_title,
    labKind: row.lab_kind,
    memberEmail: row.member_email,
    memberName: row.member_name || '',
  }));
}

/** Staff-only read (RLS): model answers and rubrics for one lab, keyed by task key. */
export async function fetchLabAnswerKeys(labId) {
  const { data, error } = await supabase
    .from('lab_answer_keys')
    .select('task_key, grading, answer, points, model_answer, rubric')
    .eq('lab_id', labId);
  if (error) throw error;
  return Object.fromEntries((data || []).map((k) => [k.task_key, {
    grading: k.grading, answer: k.answer, points: k.points, model_answer: k.model_answer, rubric: k.rubric,
  }]));
}

export async function reviewLabAttempt(attemptId, approved, feedback, rubricScores, reviewerScore) {
  const { error } = await supabase.rpc('review_lab_attempt', {
    p_attempt_id: attemptId,
    p_approved: approved,
    p_feedback: feedback || null,
    p_rubric_scores: rubricScores || null,
    p_reviewer_score: reviewerScore ?? null,
  });
  if (error) throw error;
}

export async function createCuratedLab(form, createdByEmail) {
  const slug = `curated-${form.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50)}-${Date.now().toString(36)}`;
  const { data, error } = await supabase
    .from('labs')
    .insert({
      slug,
      kind: 'curated',
      title: form.title.trim(),
      summary: form.summary?.trim() || null,
      track: form.track,
      difficulty: form.difficulty,
      est_minutes: form.estMinutes ? Number(form.estMinutes) : null,
      provider: form.provider?.trim() || null,
      external_url: form.externalUrl.trim(),
      is_published: true,
      sort_order: 100,
      created_by: createdByEmail || null,
    })
    .select()
    .single();
  if (error) throw error;
  return mapLab(data);
}

export async function setLabPublished(labId, isPublished) {
  const { error } = await supabase
    .from('labs')
    .update({ is_published: isPublished, updated_at: new Date().toISOString() })
    .eq('id', labId);
  if (error) throw error;
}
