// Exam readiness (supabase/051_exam_readiness.sql) - a per-cert prep
// checklist + latest practice-test score, member-owned. Only called for
// real (non-mock) sessions - Mock Member shows local-only demo state
// instead (see MemberPortal.jsx).

import { supabase } from './supabase';

/** Every readiness row for the signed-in member, across all certs they've
 * touched - RLS scopes this to their own rows, no filter needed here. */
export async function fetchMyExamReadiness() {
  const { data, error } = await supabase
    .from('exam_readiness')
    .select('cert_name, checklist, latest_practice_score, latest_practice_score_at');
  if (error) throw error;
  return (data || []).map((row) => ({
    certName: row.cert_name,
    checklist: row.checklist || {},
    latestPracticeScore: row.latest_practice_score,
    latestPracticeScoreAt: row.latest_practice_score_at,
  }));
}

export async function updateExamReadinessChecklist(certName, milestoneKey, completed) {
  const { error } = await supabase.rpc('update_my_exam_readiness_checklist', {
    p_cert_name: certName,
    p_milestone_key: milestoneKey,
    p_completed: completed,
  });
  if (error) throw error;
}

export async function logPracticeTestScore(certName, score) {
  const { error } = await supabase.rpc('log_my_practice_test_score', {
    p_cert_name: certName,
    p_score: score,
  });
  if (error) throw error;
}

/** 50% checklist completion + 50% latest practice score - an unlogged score
 * counts as 0 rather than being skipped, so a member who's done all the prep
 * but never taken a real practice test caps at 50%, not 100%. Shared by the
 * Cert Calendar card badge and ExamReadinessModal so both always agree. */
export function computeReadinessPercent(milestones, checklist, latestPracticeScore) {
  const doneCount = milestones.filter((m) => checklist?.[m.key]).length;
  const checklistPct = milestones.length ? (doneCount / milestones.length) * 100 : 0;
  const scorePct = typeof latestPracticeScore === 'number' ? latestPracticeScore : 0;
  return Math.round(checklistPct * 0.5 + scorePct * 0.5);
}
