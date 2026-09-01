-- Hacking Hub Admin Dashboard - Refer a Friend
-- Run this in the Supabase SQL Editor after 002-037 have already been applied.
-- Safe to re-run: every statement is idempotent.
--
-- Members can refer someone to the community - name, LinkedIn profile, and
-- optionally a phone number for whoever they're referring. Self-service
-- creation, same "member owns their own submission" pattern as
-- reviews/005_reviews.sql, events/019_events.sql, and resources/026_resources.sql:
-- a member can only ever attribute a referral to their own verified sign-in
-- email, never someone else's. Members can also see their own referrals (so
-- they know what they've already submitted), but not anyone else's - this
-- isn't a public leaderboard, and the referred person's phone number is
-- personal contact info that shouldn't be visible community-wide. Admins see
-- and manage every referral, same is_admin() pattern as every other table.

CREATE TABLE IF NOT EXISTS public.referrals (
  id BIGSERIAL PRIMARY KEY,
  referrer_email TEXT NOT NULL,
  referred_name TEXT NOT NULL,
  referred_linkedin TEXT NOT NULL,
  referred_phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read own referrals" ON public.referrals;
CREATE POLICY "members read own referrals"
  ON public.referrals FOR SELECT
  TO authenticated
  USING (
    referrer_email = lower(auth.jwt() ->> 'email')
    AND public.is_member_allowed(auth.jwt() ->> 'email')
  );

DROP POLICY IF EXISTS "members add referrals" ON public.referrals;
CREATE POLICY "members add referrals"
  ON public.referrals FOR INSERT
  TO authenticated
  WITH CHECK (
    referrer_email = lower(auth.jwt() ->> 'email')
    AND public.is_member_allowed(auth.jwt() ->> 'email')
  );

DROP POLICY IF EXISTS "admins manage referrals" ON public.referrals;
CREATE POLICY "admins manage referrals"
  ON public.referrals FOR ALL
  USING (public.is_admin(auth.uid()));

-- =========================================================================
-- REWARD STATUS (2026-09) - referrals used to just be a lead-capture log
-- with nowhere to record whether the referred person actually joined, or
-- whether the R500 referral reward (REFERRAL_REWARD_AMOUNT in
-- src/lib/memberOptions.js) has been paid out. The "admins manage
-- referrals" FOR ALL policy above already covers writing this column - no
-- new policy or function needed, same reasoning as reusing an existing
-- admin-only UPDATE for setRoadmapFoundationsApproval() rather than adding
-- a narrow RPC for something with no member-facing write path at all.
-- =========================================================================
ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Pending'
    CHECK (status IN ('Pending', 'Joined', 'Reward Paid'));
