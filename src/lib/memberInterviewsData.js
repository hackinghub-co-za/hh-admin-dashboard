// Real interview tracking (supabase/058_member_interviews.sql) - separate
// from interviewPrepData.js (AI-generated practice questions,
// interview_prep_sessions) and interviewsHadData.js (admin-set running
// count on member_profiles). This table is the actual interview a member is
// prepping for: where/when logged upfront via log_my_interview(), then a
// post-interview review attached later via submit_my_interview_review().
// Only called for real (non-mock) sessions.

import { supabase } from './supabase';

function mapRow(row) {
  return {
    id: row.id,
    memberEmail: row.member_email,
    company: row.company,
    interviewDate: row.interview_date,
    questionsAsked: row.questions_asked || '',
    playbookHelped: row.playbook_helped || '',
    confidenceLevel: row.confidence_level,
    interviewMode: row.interview_mode || '',
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at,
  };
}

/** State where/when a real interview is - the upfront gate. Returns the new interview's id. */
export async function logMyInterview(company, interviewDate) {
  const { data, error } = await supabase.rpc('log_my_interview', { p_company: company, p_interview_date: interviewDate });
  if (error) throw error;
  return data;
}

/** Submit (or edit) the post-interview review for one of this member's own logged interviews. */
export async function submitMyInterviewReview(interviewId, { questionsAsked, playbookHelped, confidenceLevel, interviewMode }) {
  const { error } = await supabase.rpc('submit_my_interview_review', {
    p_interview_id: interviewId,
    p_questions_asked: questionsAsked,
    p_playbook_helped: playbookHelped,
    p_confidence_level: confidenceLevel,
    p_interview_mode: interviewMode,
  });
  if (error) throw error;
}

/** This member's own logged interviews, most recently logged first. */
export async function fetchMyInterviews() {
  const { data, error } = await supabase
    .from('member_interviews')
    .select('id, member_email, company, interview_date, questions_asked, playbook_helped, confidence_level, interview_mode, reviewed_at, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapRow);
}

/** Admin: one member's logged interviews (RLS grants admins full visibility via is_admin()). */
export async function fetchMemberInterviews(memberEmail) {
  const { data, error } = await supabase
    .from('member_interviews')
    .select('id, member_email, company, interview_date, questions_asked, playbook_helped, confidence_level, interview_mode, reviewed_at, created_at')
    .eq('member_email', memberEmail)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapRow);
}
