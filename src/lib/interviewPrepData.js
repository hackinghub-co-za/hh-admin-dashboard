// AI Interview Prep (supabase/056_interview_prep.sql +
// supabase/functions/gemma-interview-prep). Only called for real (non-mock)
// sessions - Mock Member has no Supabase session.

import { supabase } from './supabase';

/** Generates tailored interview questions from a job description + CV text,
 * leaned toward the given domain (SOC, Offensive Security, etc. - the
 * domain the member is actually interviewing for, from member_interviews.
 * interview_domain, not necessarily their own profile specialty). Job
 * description and CV text are both required; domain is optional - the
 * edge function falls back to the member's profile specialty if omitted or
 * unrecognized. Returns the questions; also persisted server-side (the job
 * description is stored, the CV text itself is not). */
export async function generateInterviewQuestions(jobDescription, cvText, domain) {
  const { data, error } = await supabase.functions.invoke('gemma-interview-prep', {
    body: { jobDescription, cvText, domain },
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
