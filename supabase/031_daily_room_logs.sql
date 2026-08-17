-- Hacking Hub Admin Dashboard - Daily TryHackMe Room Logs
-- Run this in the Supabase SQL Editor after 002-030 have already been applied.
-- Safe to re-run: every statement is idempotent.
--
-- Lets a member self-report how many TryHackMe rooms they completed today
-- (max 5), with a required confirmation that they've posted a once-view
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

CREATE TABLE IF NOT EXISTS public.daily_room_logs (
  id BIGSERIAL PRIMARY KEY,
  member_email TEXT NOT NULL,
  log_date DATE NOT NULL DEFAULT CURRENT_DATE,
  room_count INTEGER NOT NULL CHECK (room_count BETWEEN 1 AND 5),
  proof_confirmed BOOLEAN NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  reviewed_by TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  admin_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (member_email, log_date)
);

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
-- submit_daily_room_log() below, which enforces the 1-5 cap, the proof
-- confirmation, and the "locked once Approved" rule server-side rather than
-- trusting the client.
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
BEGIN
  IF p_room_count IS NULL OR p_room_count < 1 OR p_room_count > 5 THEN
    RAISE EXCEPTION 'You can log between 1 and 5 rooms per day.';
  END IF;
  IF NOT p_proof_confirmed THEN
    RAISE EXCEPTION 'Confirm you have posted a once-view photo of each room in the WhatsApp group before submitting.';
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
CREATE OR REPLACE FUNCTION public.review_daily_room_log(p_log_id BIGINT, p_approved BOOLEAN, p_admin_note TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_member_email TEXT;
  v_room_count INTEGER;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can review room logs.';
  END IF;

  SELECT member_email, room_count INTO v_member_email, v_room_count
  FROM public.daily_room_logs WHERE id = p_log_id;

  IF v_member_email IS NULL THEN
    RAISE EXCEPTION 'Room log not found.';
  END IF;

  UPDATE public.daily_room_logs
  SET status = CASE WHEN p_approved THEN 'Approved' ELSE 'Rejected' END,
      reviewed_by = lower(auth.jwt() ->> 'email'),
      reviewed_at = timezone('utc'::text, now()),
      admin_note = p_admin_note,
      updated_at = timezone('utc'::text, now())
  WHERE id = p_log_id;

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
