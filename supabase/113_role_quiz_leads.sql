-- Hacking Hub Admin Dashboard - Role Quiz leads
-- Run this in the Supabase SQL Editor after 002-112 have already been
-- applied, BEFORE deploying the edge function:
--   supabase functions deploy role-quiz-lead --no-verify-jwt
-- Safe to re-run: every statement is idempotent.
--
-- The public site's "Which Cyber Role Are You?" quiz
-- (hackinghub.co.za/role-quiz.html) asks for a first name, email and phone
-- number before showing the result, and posts them with the matched role to
-- the role-quiz-lead Edge Function. That adds the person to the Sales
-- Pipeline through _intake_pipeline_lead() (106) as a "Role quiz" lead, so
-- the founder can follow up. The lead itself lives only in the pipeline.
--
-- This table is only a request log, so the public URL can't be used to fill
-- the pipeline with junk: at most 5 submissions a day from one network.
-- ip_hash is a SHA-256 of the caller's IP plus a salt, never the raw IP, and
-- rows older than 90 days are deleted on every insert.

CREATE TABLE IF NOT EXISTS public.role_quiz_lead_requests (
  id BIGSERIAL PRIMARY KEY,
  ip_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS role_quiz_lead_requests_ip_idx ON public.role_quiz_lead_requests (ip_hash, created_at DESC);

ALTER TABLE public.role_quiz_lead_requests ENABLE ROW LEVEL SECURITY;
-- Intentionally zero policies: only the service role (which bypasses RLS)
-- ever touches this table, from role-quiz-lead.
