-- Hacking Hub Admin Dashboard - Exam Readiness Program
-- Run this in the Supabase SQL Editor after 002-050 have already been
-- applied. Safe to re-run: every statement is idempotent.
--
-- Backend for a per-cert readiness percentage on the member-facing Cert
-- Calendar tab ("you're 65% ready to write Security+"). Built from two
-- real signals rather than parsing roadmap_items.detail (confirmed free
-- text, never machine-read anywhere in this app):
--   1. a structured prep checklist, self-checked, no admin verification
--      needed since nothing is unlocked or rewarded by it (unlike
--      roadmap_items.completed, which needed roadmap_foundations_
--      approved_at as an anti-cheat step because it gates Specialization)
--   2. a self-reported latest practice-test score
-- The actual 50/50 blend + "score counts as 0 until a real practice test
-- is logged" rule lives client-side (src/views/Member/MemberPortal.jsx) -
-- this file is just the two signals' storage + the RPCs that write them.

CREATE TABLE IF NOT EXISTS public.exam_readiness (
  member_email TEXT NOT NULL,
  cert_name TEXT NOT NULL,
  -- Keyed by milestone id, e.g. {"video_course": true, "practice_test_1":
  -- true} - free-form on purpose, same "no migration for a new milestone"
  -- reasoning as portal_events.metadata (050_portal_events.sql). The
  -- actual milestone catalog per cert lives client-side
  -- (EXAM_READINESS_CATALOGS in src/lib/memberOptions.js).
  checklist JSONB NOT NULL DEFAULT '{}'::jsonb,
  latest_practice_score INTEGER CHECK (latest_practice_score BETWEEN 0 AND 100),
  latest_practice_score_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (member_email, cert_name)
);

ALTER TABLE public.exam_readiness ENABLE ROW LEVEL SECURITY;

-- A member reads/manages only their own readiness rows - this is a
-- personal self-assessment, never shown for anyone else's booked exam on
-- the shared community Cert Calendar. Reads go straight through this
-- policy (no RPC needed to fetch "my own readiness"), same as
-- roadmap_items' member-read-own policy.
DROP POLICY IF EXISTS "members manage own exam readiness" ON public.exam_readiness;
CREATE POLICY "members manage own exam readiness"
  ON public.exam_readiness FOR ALL
  USING (member_email = lower(auth.jwt() ->> 'email'))
  WITH CHECK (member_email = lower(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "admins manage exam readiness" ON public.exam_readiness;
CREATE POLICY "admins manage exam readiness"
  ON public.exam_readiness FOR ALL
  USING (public.is_admin(auth.uid()));

-- Toggles a single milestone without disturbing any others already set -
-- jsonb `||` is a shallow merge, so this only ever touches the one key
-- being written.
CREATE OR REPLACE FUNCTION public.update_my_exam_readiness_checklist(p_cert_name TEXT, p_milestone_key TEXT, p_completed BOOLEAN)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  INSERT INTO public.exam_readiness (member_email, cert_name, checklist)
  VALUES (lower(auth.jwt() ->> 'email'), p_cert_name, jsonb_build_object(p_milestone_key, p_completed))
  ON CONFLICT (member_email, cert_name) DO UPDATE SET
    checklist = public.exam_readiness.checklist || jsonb_build_object(p_milestone_key, p_completed),
    updated_at = timezone('utc'::text, now());
$$;
GRANT EXECUTE ON FUNCTION public.update_my_exam_readiness_checklist(TEXT, TEXT, BOOLEAN) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.update_my_exam_readiness_checklist(TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;

-- Records a fresh practice-test score, timestamped so the UI can flag it
-- as stale later if it wants to. Score range enforced by the table's own
-- CHECK constraint.
CREATE OR REPLACE FUNCTION public.log_my_practice_test_score(p_cert_name TEXT, p_score INTEGER)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  INSERT INTO public.exam_readiness (member_email, cert_name, latest_practice_score, latest_practice_score_at)
  VALUES (lower(auth.jwt() ->> 'email'), p_cert_name, p_score, timezone('utc'::text, now()))
  ON CONFLICT (member_email, cert_name) DO UPDATE SET
    latest_practice_score = EXCLUDED.latest_practice_score,
    latest_practice_score_at = EXCLUDED.latest_practice_score_at,
    updated_at = timezone('utc'::text, now());
$$;
GRANT EXECUTE ON FUNCTION public.log_my_practice_test_score(TEXT, INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.log_my_practice_test_score(TEXT, INTEGER) FROM PUBLIC, anon;
