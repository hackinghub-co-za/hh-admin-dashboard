// AI Interview Prep (supabase/056_interview_prep.sql +
// supabase/functions/gemma-interview-prep). Only called for real (non-mock)
// sessions - Mock Member has no Supabase session.

import { supabase } from './supabase';

/** Generates tailored interview questions from a job description + CV text.
 * Both are required. Returns the questions; also persisted server-side
 * (the job description is stored, the CV text itself is not). */
export async function generateInterviewQuestions(jobDescription, cvText) {
  const { data, error } = await supabase.functions.invoke('gemma-interview-prep', {
    body: { jobDescription, cvText },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data.questions || [];
}

/** This member's own past interview prep sessions, most recent first. */
export async function fetchMyInterviewPrepSessions() {
  const { data, error } = await supabase
    .from('interview_prep_sessions')
    .select('id, job_description, questions, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((row) => ({
    id: row.id,
    jobDescription: row.job_description,
    questions: row.questions || [],
    createdAt: row.created_at,
  }));
}
