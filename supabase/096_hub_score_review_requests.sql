-- Hacking Hub Admin Dashboard - Hub Score Points Review Requests
-- Run this in the Supabase SQL Editor after 002-095 have already been
-- applied. Safe to re-run: every statement is idempotent.
--
-- A flagging mechanism, not an automated fix: a member reports "my score
-- looks wrong," an admin manually corrects whatever's actually wrong in
-- the real source table (cert_calendar, daily_room_logs, etc. - untouched
-- by this file) and marks the request resolved. Same self-attributed-
-- INSERT + admin-FOR-ALL-RLS shape as hub_score_tier_claims
-- (094_hub_score_leaderboard_and_claims.sql), minus that table's
-- eligibility trigger - any member can ask for a review regardless of
-- their score, there's nothing to re-verify server-side here.

CREATE TABLE IF NOT EXISTS public.hub_score_review_requests (
  id BIGSERIAL PRIMARY KEY,
  member_email TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Resolved', 'Dismissed')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  admin_note TEXT
);

-- One open request at a time per member - stops the same complaint being
-- submitted repeatedly while waiting; they can submit a new one once the
-- last is Resolved/Dismissed. Partial unique index, same defense-in-depth
-- spirit as every other "never trust the client alone" constraint in this
-- app, backing up the UI's own hide-the-button-while-pending behavior.
CREATE UNIQUE INDEX IF NOT EXISTS idx_hub_score_review_requests_one_pending
  ON public.hub_score_review_requests (member_email)
  WHERE status = 'Pending';

ALTER TABLE public.hub_score_review_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read own hub score review requests" ON public.hub_score_review_requests;
CREATE POLICY "members read own hub score review requests"
  ON public.hub_score_review_requests FOR SELECT
  TO authenticated
  USING (member_email = lower(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "members create own hub score review requests" ON public.hub_score_review_requests;
CREATE POLICY "members create own hub score review requests"
  ON public.hub_score_review_requests FOR INSERT
  TO authenticated
  WITH CHECK (
    member_email = lower(auth.jwt() ->> 'email')
    AND status = 'Pending'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
    AND admin_note IS NULL
  );

-- No member UPDATE policy - same "only admins move this forward" shape as
-- merch_orders / hub_score_tier_claims.
DROP POLICY IF EXISTS "admins manage hub score review requests" ON public.hub_score_review_requests;
CREATE POLICY "admins manage hub score review requests"
  ON public.hub_score_review_requests FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_hub_score_review_requests_member_email ON public.hub_score_review_requests (member_email);
CREATE INDEX IF NOT EXISTS idx_hub_score_review_requests_status ON public.hub_score_review_requests (status);
