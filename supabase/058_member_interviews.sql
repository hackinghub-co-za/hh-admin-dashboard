-- Hacking Hub Admin Dashboard - Real Interview Tracking
-- Run this in the Supabase SQL Editor after 002-057 have already been
-- applied. Safe to re-run: every statement is idempotent.
--
-- Extends "Interview Prep" (056_interview_prep.sql) with tracking for real
-- interviews, not just AI practice sessions. Before generating AI questions,
-- a member states WHERE (company) and WHEN (interview_date) a real
-- interview is - that's the gate, kept to just those two fields for low
-- friction. Sometime after, they can submit a post-interview review: what
-- was actually asked, whether the HH playbook helped, how confident they
-- are, and whether it was online or offline (mode is captured at review
-- time, not upfront - it's part of "how did it go", not "where/when is it").
--
-- Deliberately independent of interview_prep_sessions - no FK. That table is
-- AI-generated practice questions; this one is the real interview itself.
-- Linking them would force a 1:1 relationship that doesn't exist (a member
-- might generate practice questions multiple times for one real interview,
-- or log a real interview without ever using AI prep for it).
--
-- interview_domain (added alongside company/date in the same upfront gate)
-- is which specialty track (SOC, Offensive Security, Cloud Security,
-- DevSecOps, IAM, AI Security, GRC - same vocabulary as ROADMAP_TRACKS in
-- memberOptions.js) the real interview is FOR - not necessarily the same as
-- the member's own assigned roadmap track, since someone can interview for
-- a role outside their current specialization. gemma-interview-prep reads
-- it to tailor AI-generated questions to that domain instead of just the
-- member's static profile specialty.

CREATE TABLE IF NOT EXISTS public.member_interviews (
  id BIGSERIAL PRIMARY KEY,
  member_email TEXT NOT NULL,
  company TEXT NOT NULL,
  interview_date DATE NOT NULL,
  interview_domain TEXT,
  -- Review fields - all NULL until the member submits their review.
  questions_asked TEXT,
  playbook_helped TEXT CHECK (playbook_helped IN ('Yes', 'Somewhat', 'No')),
  confidence_level INTEGER CHECK (confidence_level BETWEEN 1 AND 5),
  interview_mode TEXT CHECK (interview_mode IN ('Online', 'Offline')),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Fresh-install guard above already includes interview_domain in the
-- CREATE TABLE, but IF NOT EXISTS no-ops entirely on an install where this
-- table was already created before this column existed - this ALTER is
-- what actually adds it there.
ALTER TABLE public.member_interviews
  ADD COLUMN IF NOT EXISTS interview_domain TEXT;

CREATE INDEX IF NOT EXISTS idx_member_interviews_member_created ON public.member_interviews(member_email, created_at);

ALTER TABLE public.member_interviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read own interviews" ON public.member_interviews;
CREATE POLICY "members read own interviews"
  ON public.member_interviews FOR SELECT
  TO authenticated
  USING (
    member_email = lower(auth.jwt() ->> 'email')
    AND public.is_member_allowed(auth.jwt() ->> 'email')
  );

-- No member INSERT/UPDATE policy - both writes go through the
-- SECURITY DEFINER functions below, which hardcode member_email server-side
-- rather than trusting the client, same pattern as toggle_my_roadmap_item()
-- and submit_daily_room_log().
DROP POLICY IF EXISTS "admins manage interviews" ON public.member_interviews;
CREATE POLICY "admins manage interviews"
  ON public.member_interviews FOR ALL
  USING (public.is_admin(auth.uid()));

-- The upfront "where/when/what domain" gate. Called once per real interview
-- a member wants to prep for or track; returns the new row's id so the
-- client can keep prepping (generating domain-tailored AI questions)
-- against it and later attach a review to it.
--
-- p_interview_domain was added after this function first shipped - a plain
-- CREATE OR REPLACE can't change a function's argument list, so the DROP
-- below is required first (same lesson already documented in
-- 010_member_directory.sql's own history) to cleanly replace the original
-- 2-arg version rather than leaving both callable as separate overloads.
DROP FUNCTION IF EXISTS public.log_my_interview(TEXT, DATE);

CREATE OR REPLACE FUNCTION public.log_my_interview(p_company TEXT, p_interview_date DATE, p_interview_domain TEXT)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id BIGINT;
BEGIN
  IF p_company IS NULL OR trim(p_company) = '' THEN
    RAISE EXCEPTION 'Tell us which company you''re interviewing with.';
  END IF;
  IF p_interview_date IS NULL THEN
    RAISE EXCEPTION 'Tell us when the interview is.';
  END IF;
  IF p_interview_domain IS NULL OR trim(p_interview_domain) = '' THEN
    RAISE EXCEPTION 'Tell us which domain you''re interviewing for.';
  END IF;

  INSERT INTO public.member_interviews (member_email, company, interview_date, interview_domain)
  VALUES (lower(auth.jwt() ->> 'email'), trim(p_company), p_interview_date, trim(p_interview_domain))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.log_my_interview(TEXT, DATE, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.log_my_interview(TEXT, DATE, TEXT) FROM PUBLIC, anon;

-- The post-interview review: what was asked, whether the playbook helped,
-- confidence of getting the role, and online/offline. Can be called again
-- to edit an already-submitted review (reviewed_at just moves forward) -
-- there's no "locked" state here the way an Approved room log is locked,
-- since there's no downstream number this feeds that a correction could
-- double-count.
CREATE OR REPLACE FUNCTION public.submit_my_interview_review(
  p_interview_id BIGINT,
  p_questions_asked TEXT,
  p_playbook_helped TEXT,
  p_confidence_level INTEGER,
  p_interview_mode TEXT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_owner TEXT;
BEGIN
  SELECT member_email INTO v_owner FROM public.member_interviews WHERE id = p_interview_id;
  IF v_owner IS NULL OR v_owner != v_email THEN
    RAISE EXCEPTION 'Interview not found.';
  END IF;

  IF p_questions_asked IS NULL OR trim(p_questions_asked) = '' THEN
    RAISE EXCEPTION 'Tell us what questions were actually asked.';
  END IF;
  IF p_playbook_helped NOT IN ('Yes', 'Somewhat', 'No') THEN
    RAISE EXCEPTION 'Tell us whether the HH playbook helped.';
  END IF;
  IF p_confidence_level IS NULL OR p_confidence_level < 1 OR p_confidence_level > 5 THEN
    RAISE EXCEPTION 'Rate your confidence of getting the role from 1 to 5.';
  END IF;
  IF p_interview_mode NOT IN ('Online', 'Offline') THEN
    RAISE EXCEPTION 'Tell us whether the interview was online or offline.';
  END IF;

  UPDATE public.member_interviews
  SET questions_asked = trim(p_questions_asked),
      playbook_helped = p_playbook_helped,
      confidence_level = p_confidence_level,
      interview_mode = p_interview_mode,
      reviewed_at = timezone('utc'::text, now()),
      updated_at = timezone('utc'::text, now())
  WHERE id = p_interview_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_my_interview_review(BIGINT, TEXT, TEXT, INTEGER, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.submit_my_interview_review(BIGINT, TEXT, TEXT, INTEGER, TEXT) FROM PUBLIC, anon;

-- =========================================================================
-- MERGE WITH THE MANUAL "INTERVIEWS HAD" COUNTER
-- =========================================================================
--
-- get_my_interviews_had() (057_interviews_had.sql) originally just read
-- member_profiles.interviews_had directly - a manual, admin-set count, the
-- only "interviews had" number that existed before this table. It has to be
-- redefined here rather than back in 057 - this table didn't exist yet when
-- 057 ran, and a fresh install still applies files in order, so 057 can
-- never be the one to reference member_interviews.
--
-- Redefined to return ONE merged total (manual baseline + real interviews
-- actually in the past) so the member's own Journey tile/storyline and the
-- admin's Members tab are always reading the same number by construction,
-- never two independently-maintained counters that could drift apart.
-- interviews_had now means "interviews had before this real tracking
-- existed" - a one-time manual baseline, not something an admin keeps
-- incrementing per interview going forward (see MemberProfileModal.jsx's
-- updated field label/help text). Only counts member_interviews rows whose
-- interview_date has actually passed - a logged-but-upcoming interview
-- hasn't been "had" yet.
CREATE OR REPLACE FUNCTION public.get_my_interviews_had()
RETURNS INTEGER
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT COALESCE((SELECT interviews_had FROM public.member_profiles WHERE email = lower(auth.jwt() ->> 'email')), 0)
       + (SELECT COUNT(*)::INTEGER FROM public.member_interviews
          WHERE member_email = lower(auth.jwt() ->> 'email') AND interview_date <= CURRENT_DATE);
$$;
GRANT EXECUTE ON FUNCTION public.get_my_interviews_had() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_interviews_had() FROM PUBLIC, anon;
