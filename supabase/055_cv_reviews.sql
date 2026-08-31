-- Hacking Hub Admin Dashboard - Gemma CV & LinkedIn Review
-- Run this in the Supabase SQL Editor after 002-054 have already been
-- applied. Safe to re-run: every statement is idempotent.
--
-- Reuses Gemma's existing infrastructure (gemma-chat's API-key-safety,
-- membership-verification, and rate-limiting pattern) via a second,
-- purpose-built Edge Function (gemma-review) rather than branching
-- gemma-chat itself - same granularity this codebase already uses
-- elsewhere (payfast-checkout vs payfast-webhook, three separate push-*
-- functions rather than one that branches on a mode param).
--
-- Deliberately does NOT store the member's raw CV/LinkedIn text - only
-- the review output (score + structured feedback) is persisted. The
-- input is real personal career data; keeping only what the member
-- actually gets value from revisiting (their feedback, not a copy of
-- their CV sitting in a database table) is the more privacy-conscious
-- default, same spirit as this codebase's existing PII carefulness
-- (check-pii.sh, the redacted historical migrations).

CREATE TABLE IF NOT EXISTS public.cv_reviews (
  id BIGSERIAL PRIMARY KEY,
  member_email TEXT NOT NULL,
  review_type TEXT NOT NULL CHECK (review_type IN ('cv', 'linkedin', 'both')),
  overall_score INTEGER NOT NULL CHECK (overall_score BETWEEN 0 AND 100),
  -- [{"name": "...", "feedback": "...", "suggestion": "..."}, ...] - category
  -- names come from Gemini's own structured output, not a fixed enum, so a
  -- CV review and a LinkedIn review can each get categories that actually
  -- fit (ATS formatting matters for a CV; profile completeness matters for
  -- LinkedIn) without a schema change.
  categories JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_cv_reviews_member_created ON public.cv_reviews(member_email, created_at);

ALTER TABLE public.cv_reviews ENABLE ROW LEVEL SECURITY;

-- Self-owned, same shape as exam_readiness/quiz_attempts - a member reads
-- only their own review history. No client-facing INSERT policy, same
-- reasoning as gemma_messages (009_gemma_assistant.sql): only the
-- gemma-review Edge Function ever writes here, using the service-role key,
-- so even a leaked member JWT can't be used to forge a fake review.
DROP POLICY IF EXISTS "members read own cv reviews" ON public.cv_reviews;
CREATE POLICY "members read own cv reviews"
  ON public.cv_reviews FOR SELECT
  USING (member_email = lower(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "admins manage cv reviews" ON public.cv_reviews;
CREATE POLICY "admins manage cv reviews"
  ON public.cv_reviews FOR ALL
  USING (public.is_admin(auth.uid()));
