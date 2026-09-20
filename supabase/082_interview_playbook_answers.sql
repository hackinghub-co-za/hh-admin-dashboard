-- Hacking Hub Admin Dashboard - Interview Playbook Answers
-- Run this in the Supabase SQL Editor after 002-081 have already been
-- applied. Safe to re-run: every statement is idempotent.
--
-- The 8 questions in InterviewPlaybookGuideModal.jsx come up in almost
-- every interview regardless of domain (SOC, Offensive Security, GRC,
-- ...), so the playbook's own advice is "write out full answers, not just
-- think through them, then practice saying them out loud" - this is what
-- actually lets a member do that inside the guide itself instead of
-- needing a separate notes doc. Same JSONB-per-key pattern already used
-- for exam_readiness.checklist (051_exam_readiness.sql): free-form so a
-- future new/reworded question needs zero migration, just a new key.

CREATE TABLE IF NOT EXISTS public.interview_playbook_answers (
  member_email TEXT PRIMARY KEY,
  -- Keyed by question (e.g. "tell_me_about_yourself": "..."). The actual
  -- question catalog lives client-side (InterviewPlaybookGuideModal.jsx),
  -- same "no migration for a new milestone" reasoning as exam_readiness.
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.interview_playbook_answers ENABLE ROW LEVEL SECURITY;

-- A member reads/manages only their own answers - personal interview prep,
-- never shown to anyone else. Same "FOR ALL, own row only, no RPC needed
-- for reads" pattern as exam_readiness's own member policy.
DROP POLICY IF EXISTS "members manage own interview playbook answers" ON public.interview_playbook_answers;
CREATE POLICY "members manage own interview playbook answers"
  ON public.interview_playbook_answers FOR ALL
  USING (member_email = lower(auth.jwt() ->> 'email'))
  WITH CHECK (member_email = lower(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "admins manage interview playbook answers" ON public.interview_playbook_answers;
CREATE POLICY "admins manage interview playbook answers"
  ON public.interview_playbook_answers FOR ALL
  USING (public.is_admin(auth.uid()));

-- Saves one answer without disturbing any of the others already written -
-- jsonb `||` is a shallow merge, same pattern as
-- update_my_exam_readiness_checklist(). Called on blur/debounce from the
-- guide modal, not a single "submit the whole form" action, so a member
-- typing a long answer never risks losing it to a lost connection right
-- before they'd have clicked Save.
CREATE OR REPLACE FUNCTION public.save_my_interview_playbook_answer(p_question_key TEXT, p_answer TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.interview_playbook_answers (member_email, answers)
  VALUES (lower(auth.jwt() ->> 'email'), jsonb_build_object(p_question_key, p_answer))
  ON CONFLICT (member_email) DO UPDATE SET
    answers = interview_playbook_answers.answers || jsonb_build_object(p_question_key, p_answer),
    updated_at = timezone('utc'::text, now());
$$;
GRANT EXECUTE ON FUNCTION public.save_my_interview_playbook_answer(TEXT, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.save_my_interview_playbook_answer(TEXT, TEXT) FROM PUBLIC, anon;
