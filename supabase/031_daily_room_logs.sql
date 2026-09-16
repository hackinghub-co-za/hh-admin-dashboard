-- Hacking Hub Admin Dashboard - Daily TryHackMe Room Logs
-- Run this in the Supabase SQL Editor after 002-030 have already been applied.
-- Safe to re-run: every statement is idempotent.
--
-- Lets a member self-report how many TryHackMe rooms they completed today
-- (max 3, 2 on weekends - see the two REVISION notes below), with a
-- required confirmation that they've posted a once-view
-- photo of each room in the WhatsApp group chat as proof. Nothing here can
-- verify that photo actually exists - the real anti-cheating control is that
-- every submission sits as 'Pending' until an admin reviews it. Once
-- approved, it's what finally automates the "admin-entered manually" limit
-- called out in 015_competition_standings.sql: rooms_completed and
-- days_logged on the leaderboard now come from real approved submissions
-- instead of an admin retyping numbers by hand.
--
-- One log per member per day (UNIQUE below) - a member can keep updating
-- today's count (e.g. 2 rooms this morning, 4 by tonight) for as long as
-- it's still Pending, but once an admin approves it, it's locked for the
-- day. A Rejected log can be corrected and resubmitted (e.g. the proof
-- wasn't actually posted) - only Approved is final.
--
-- REVISION (2026-09-12): weekend cap. Saturday/Sunday's max drops below the
-- weekday max - log_date's day-of-week decides which cap applies, so a log
-- dated on a weekend is capped regardless of which day it's actually
-- submitted on. Enforced twice, same "don't trust the client alone"
-- reasoning as everything else in this file: the CHECK constraint below is
-- the real backstop, submit_daily_room_log()'s own check just gives a
-- clearer error message than a raw constraint violation would.
--
-- REVISION (2026-09-13): weekday max lowered from 5 to 3 (weekend max stays
-- 2, unchanged). Same NOT VALID reasoning as the revision above applies
-- again here - real rows already approved under the old 1-5 weekday rule
-- stay exactly as they are.

CREATE TABLE IF NOT EXISTS public.daily_room_logs (
  id BIGSERIAL PRIMARY KEY,
  member_email TEXT NOT NULL,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  room_count INTEGER NOT NULL CHECK (room_count BETWEEN 1 AND 3),
  proof_confirmed BOOLEAN NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  reviewed_by TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  admin_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (member_email, log_date)
);

-- Replaces the flat 1-5 CHECK above with a day-of-week-aware one, for a
-- table that already existed before the weekend cap - a fresh CREATE TABLE
-- above already gets the flat constraint, so this only ever has anything
-- to do on a database where 031 ran before this revision. NOT VALID: the
-- new cap is a going-forward rule, not a retroactive rewrite of history -
-- real rows already approved under the old 1-5 rule (e.g. 4 rooms logged
-- on a Saturday last month) stay exactly as they are, only a fresh
-- insert/update is ever checked against it.
ALTER TABLE public.daily_room_logs DROP CONSTRAINT IF EXISTS daily_room_logs_room_count_check;
ALTER TABLE public.daily_room_logs ADD CONSTRAINT daily_room_logs_room_count_check
  CHECK (room_count BETWEEN 1 AND (CASE WHEN EXTRACT(DOW FROM log_date) IN (0, 6) THEN 2 ELSE 3 END)) NOT VALID;

ALTER TABLE public.daily_room_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read own room logs" ON public.daily_room_logs;
CREATE POLICY "members read own room logs"
  ON public.daily_room_logs FOR SELECT
  TO authenticated
  USING (
    member_email = lower(auth.jwt() ->> 'email')
    AND public.is_member_allowed(auth.jwt() ->> 'email')
  );

-- No member INSERT/UPDATE policy - submissions go through
-- submit_daily_room_log() below, which enforces the daily cap, the proof
-- confirmation, and the "locked once Approved" rule server-side rather than
-- trusting the client.
-- WARNING - do not re-run this file alone against a database that has
-- already run 067_permission_scopes.sql: that later file widens this same
-- policy to also allow community_manager, and re-running just this file
-- afterward silently reverts it back to admin-only (Postgres simply
-- executes whichever CREATE POLICY ran most recently - there's no
--"already widened, don't narrow" protection). This isn't fixed by
-- widening the USING clause here directly: public.is_community_manager()
-- isn't defined until 067, so a fresh database bootstrapped in order
-- (002 -> 031 -> ... -> 067) would fail on this exact line if it were
-- widened. A live incident on 2026-09-16 (a real Community Manager,
-- Ofentse, unable to see or approve any pending room log) was exactly
-- this regression - fixed by re-applying 067's version. If this file ever
-- needs to be re-run in isolation again, re-run 067_permission_scopes.sql
-- immediately after to restore the widened policy.
DROP POLICY IF EXISTS "admins manage room logs" ON public.daily_room_logs;
CREATE POLICY "admins manage room logs"
  ON public.daily_room_logs FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.submit_daily_room_log(p_room_count INTEGER, p_proof_confirmed BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_existing_status TEXT;
  v_is_weekend BOOLEAN := EXTRACT(DOW FROM CURRENT_DATE) IN (0, 6);
  v_max_rooms INTEGER := CASE WHEN v_is_weekend THEN 2 ELSE 3 END;
BEGIN
  IF p_room_count IS NULL OR p_room_count < 1 OR p_room_count > v_max_rooms THEN
    IF v_is_weekend THEN
      RAISE EXCEPTION 'Weekend submissions are capped at 2 rooms per day.';
    ELSE
      RAISE EXCEPTION 'You can log between 1 and 3 rooms per day.';
    END IF;
  END IF;
  IF NOT p_proof_confirmed THEN
    RAISE EXCEPTION 'Confirm you have posted a once-view photo of each room in the WhatsApp group before submitting.';
  END IF;

  -- The "Log Today's Rooms" form has no RSVP gate of its own - a member who
  -- never clicked "Yes I'm In" could otherwise submit, get approved by an
  -- admin, and see nothing happen, because review_daily_room_log() credits
  -- competition_standings by matching this email against an existing row -
  -- silently a no-op when there isn't one. Block that dead end here instead
  -- of letting it fail invisibly two steps later.
  IF NOT EXISTS (SELECT 1 FROM public.competition_standings WHERE email = v_email) THEN
    RAISE EXCEPTION 'RSVP for the competition first (the "Yes I''m In" button above) before logging rooms.';
  END IF;

  SELECT status INTO v_existing_status
  FROM public.daily_room_logs
  WHERE member_email = v_email AND log_date = CURRENT_DATE;

  IF v_existing_status = 'Approved' THEN
    RAISE EXCEPTION 'Today''s room log has already been approved and is locked - check back tomorrow.';
  END IF;

  INSERT INTO public.daily_room_logs (member_email, log_date, room_count, proof_confirmed, status, reviewed_by, reviewed_at, admin_note)
  VALUES (v_email, CURRENT_DATE, p_room_count, true, 'Pending', NULL, NULL, NULL)
  ON CONFLICT (member_email, log_date) DO UPDATE SET
    room_count = EXCLUDED.room_count,
    proof_confirmed = true,
    status = 'Pending',
    reviewed_by = NULL,
    reviewed_at = NULL,
    admin_note = NULL,
    updated_at = timezone('utc'::text, now());
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_daily_room_log(INTEGER, BOOLEAN) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.submit_daily_room_log(INTEGER, BOOLEAN) FROM PUBLIC, anon;

-- Approving credits the member's competition_standings row (if they have
-- one - i.e. they've RSVP'd to the competition via rsvp_for_competition()).
-- rooms_completed goes up by the submitted count and days_logged by exactly
-- 1, since the UNIQUE(member_email, log_date) constraint above guarantees
-- every approved log is a genuinely distinct day.
--
-- Widened to also allow community_manager, and hardened with the
-- Pending-only UPDATE guard below, by 067_permission_scopes.sql PART 2 -
-- kept in sync here too (not just left as a later CREATE OR REPLACE in
-- that other file) after a real live incident where this exact function
-- was found reverted back to the admin-only, unguarded body below: this
-- file had been re-run in isolation sometime after 067 shipped, and
-- since this CREATE OR REPLACE is idempotent-by-design (safe to re-run),
-- it silently clobbered 067's fix back to what's now written here - a
-- real Community Manager lost the ability to approve room logs with no
-- error anywhere pointing at why. Both
-- files now define the identical final body, so re-running either one,
-- in any order, converges on the same correct result instead of one
-- undoing the other's fix.
CREATE OR REPLACE FUNCTION public.review_daily_room_log(p_log_id BIGINT, p_approved BOOLEAN, p_admin_note TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_member_email TEXT;
  v_room_count INTEGER;
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_community_manager(auth.uid())) THEN
    RAISE EXCEPTION 'Only admins can review room logs.';
  END IF;

  SELECT member_email, room_count INTO v_member_email, v_room_count
  FROM public.daily_room_logs WHERE id = p_log_id;

  IF v_member_email IS NULL THEN
    RAISE EXCEPTION 'Room log not found.';
  END IF;

  -- Reviewing is meant to happen exactly once per log - the admin UI pulls
  -- Approve/Reject the moment a log leaves Pending. But both admins and
  -- Community Managers can review, so two reviewers can have the same
  -- Pending log open at once; without this guard, both clicking Approve
  -- would each run the credit below, double-counting the member's
  -- rooms_completed/days_logged. Scoping the UPDATE to status = 'Pending'
  -- and checking FOUND makes this atomic under real concurrency.
  UPDATE public.daily_room_logs
  SET status = CASE WHEN p_approved THEN 'Approved' ELSE 'Rejected' END,
      reviewed_by = lower(auth.jwt() ->> 'email'),
      reviewed_at = timezone('utc'::text, now()),
      admin_note = p_admin_note,
      updated_at = timezone('utc'::text, now())
  WHERE id = p_log_id AND status = 'Pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This log has already been reviewed - refresh the page.';
  END IF;

  IF p_approved THEN
    UPDATE public.competition_standings
    SET rooms_completed = rooms_completed + v_room_count,
        days_logged = days_logged + 1
    WHERE email = v_member_email;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.review_daily_room_log(BIGINT, BOOLEAN, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.review_daily_room_log(BIGINT, BOOLEAN, TEXT) FROM PUBLIC, anon;
