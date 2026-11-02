-- Hacking Hub Admin Dashboard - Free CV Review requests
-- Run this in the Supabase SQL Editor after 002-109 have already been
-- applied, BEFORE deploying the edge function:
--   supabase functions deploy cv-review-intake --no-verify-jwt
-- Safe to re-run: every statement is idempotent.
--
-- The public site's Free CV Review page (hackinghub.co.za/cv-review.html)
-- posts a CV to the cv-review-intake Edge Function, which emails it to the
-- founder as an attachment and then sends the visitor on to Cal.com to book
-- a 15-minute results call. The CV itself is never stored - only this small
-- log, which exists so the function can refuse repeats (one review per
-- email address every 30 days, and at most 3 requests a day from one
-- network) and so a public URL can't be used to flood the inbox.
--
-- ip_hash is a SHA-256 of the caller's IP plus a salt, never the raw IP.
-- Rows older than 90 days are deleted on every insert, so the log can't grow
-- into a mailing list.

CREATE TABLE IF NOT EXISTS public.cv_review_requests (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS cv_review_requests_email_idx ON public.cv_review_requests (email, created_at DESC);
CREATE INDEX IF NOT EXISTS cv_review_requests_ip_idx ON public.cv_review_requests (ip_hash, created_at DESC);

ALTER TABLE public.cv_review_requests ENABLE ROW LEVEL SECURITY;
-- Intentionally zero policies: only the service role (which bypasses RLS)
-- ever touches this table, from cv-review-intake.
