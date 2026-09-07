-- Hacking Hub Admin Dashboard - Room Race (Phase 2 of the head-to-head
-- competitions roadmap - see the "Duel Protocol" planning artifact)
-- Run in the Supabase SQL Editor after 062_quiz_duels.sql AND
-- 064_recommended_rooms.sql - assign_room_race_rooms() (added 2026-09)
-- reads from recommended_rooms, so its daily cron silently does nothing
-- every night until that file has also been applied.
-- Safe to re-run.
--
-- Two members race to finish the same TryHackMe room - whoever's proof
-- gets admin-approved first wins. Reuses the exact trust model already in
-- production for the shared leaderboard (daily_room_logs,
-- 031_daily_room_logs.sql): a self-reported "I did it" checkbox, no
-- automated verification, an admin has the final say. A flat two-column-
-- per-player design is used instead of a child submissions table since a
-- race only ever has exactly two participants and one room.
--
-- One default below was not explicitly asked about and is worth flagging:
-- admin approval reuses the existing Room Logs queue rather than a new
-- admin surface, since that's already the exact same "approve a claimed
-- room completion" workflow.
--
-- Update (2026-09): a race used to start immediately with the challenger
-- picking any room they liked - which let the challenger pick a room
-- they'd already half-memorized, an unfair edge for whoever throws the
-- challenge. Now: (1) the challenged member must explicitly accept before
-- anything starts (status starts 'Pending', not 'Active'), and (2) neither
-- player picks the room - a daily cron randomly assigns one from the
-- existing recommended_rooms pool (064_recommended_rooms.sql) at 8am SAST
-- to every race that's been accepted but not yet assigned, so both players
-- see it for the first time at the same moment. room_name/room_url are
-- consequently nullable now (empty until that assignment happens).

CREATE TABLE IF NOT EXISTS public.room_races (
  id BIGSERIAL PRIMARY KEY,
  room_name TEXT NOT NULL,
  room_url TEXT,
  member_a_email TEXT NOT NULL,
  member_a_name TEXT,
  member_b_email TEXT NOT NULL,
  member_b_name TEXT,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Active', 'Completed', 'Cancelled')),
  winner_email TEXT,
  member_a_submitted_at TIMESTAMP WITH TIME ZONE,
  member_a_approved_at TIMESTAMP WITH TIME ZONE,
  member_b_submitted_at TIMESTAMP WITH TIME ZONE,
  member_b_approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  resolved_at TIMESTAMP WITH TIME ZONE
);

-- room_name used to be required at creation time (the challenger picked
-- it); a fresh challenge now starts with no room at all, so this only
-- takes effect on a database where the table already existed with the old
-- NOT NULL - a no-op on a fresh install, where the CREATE TABLE below
-- already omits it.
ALTER TABLE public.room_races ALTER COLUMN room_name DROP NOT NULL;
ALTER TABLE public.room_races ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.room_races ADD COLUMN IF NOT EXISTS room_assigned_at TIMESTAMP WITH TIME ZONE;

-- The column's own DEFAULT was still 'Active' (only takes effect on a
-- fresh CREATE TABLE otherwise) - challenge_to_room_race() always passes
-- status explicitly so this was never actually reached, but left as-is it
-- was a landmine for any future insert that omits status.
ALTER TABLE public.room_races ALTER COLUMN status SET DEFAULT 'Pending';

ALTER TABLE public.room_races DROP CONSTRAINT IF EXISTS room_races_status_check;
ALTER TABLE public.room_races ADD CONSTRAINT room_races_status_check
  CHECK (status IN ('Pending', 'Active', 'Completed', 'Cancelled', 'Declined'));

ALTER TABLE public.room_races ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read own room races" ON public.room_races;
CREATE POLICY "members read own room races"
  ON public.room_races FOR SELECT
  TO authenticated
  USING (
    lower(auth.jwt() ->> 'email') IN (member_a_email, member_b_email)
    AND public.is_member_allowed(auth.jwt() ->> 'email')
  );

DROP POLICY IF EXISTS "admins manage room races" ON public.room_races;
CREATE POLICY "admins manage room races"
  ON public.room_races FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_room_races_participants ON public.room_races(member_a_email, member_b_email);
CREATE INDEX IF NOT EXISTS idx_room_races_status ON public.room_races(status);

-- Sends a challenge, but doesn't start anything yet - status is 'Pending'
-- until the challenged member accepts (accept_room_race() below). No room
-- is named here any more; that's assigned automatically, to whoever
-- accepts, by assign_room_race_rooms() further down.
DROP FUNCTION IF EXISTS public.challenge_to_room_race(TEXT, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.challenge_to_room_race(p_opponent_email TEXT, p_opponent_name TEXT)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_opponent TEXT := lower(p_opponent_email);
  v_name TEXT;
  v_id BIGINT;
BEGIN
  IF v_opponent = v_email THEN
    RAISE EXCEPTION 'You can''t challenge yourself.';
  END IF;
  IF NOT public.is_member_allowed(v_opponent) THEN
    RAISE EXCEPTION 'That member can''t be challenged right now.';
  END IF;

  SELECT full_name INTO v_name FROM public.member_profiles WHERE email = v_email;

  INSERT INTO public.room_races (member_a_email, member_a_name, member_b_email, member_b_name, status)
  VALUES (v_email, v_name, v_opponent, p_opponent_name, 'Pending')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.challenge_to_room_race(TEXT, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.challenge_to_room_race(TEXT, TEXT) FROM PUBLIC, anon;

-- Only the challenged member (member_b) can accept, and only while still
-- Pending. Accepting doesn't assign a room - that happens for every
-- accepted-but-unassigned race at once, at 8am SAST, so neither player
-- gets to see (or pick) the room before the other does.
CREATE OR REPLACE FUNCTION public.accept_room_race(p_race_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_race public.room_races%ROWTYPE;
BEGIN
  IF NOT public.is_member_allowed(v_email) THEN
    RAISE EXCEPTION 'Only approved members can accept a race.';
  END IF;

  SELECT * INTO v_race FROM public.room_races WHERE id = p_race_id;
  IF v_race.id IS NULL THEN
    RAISE EXCEPTION 'Race not found.';
  END IF;
  IF v_race.member_b_email != v_email THEN
    RAISE EXCEPTION 'Only the challenged member can accept this race.';
  END IF;
  IF v_race.status != 'Pending' THEN
    RAISE EXCEPTION 'This challenge is no longer pending.';
  END IF;

  UPDATE public.room_races
  SET status = 'Active', accepted_at = timezone('utc'::text, now())
  WHERE id = p_race_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.accept_room_race(BIGINT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.accept_room_race(BIGINT) FROM PUBLIC, anon;

-- Same caller restriction as accept - only the challenged member can turn
-- a challenge down.
CREATE OR REPLACE FUNCTION public.decline_room_race(p_race_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_race public.room_races%ROWTYPE;
BEGIN
  IF NOT public.is_member_allowed(v_email) THEN
    RAISE EXCEPTION 'Only approved members can respond to a race.';
  END IF;

  SELECT * INTO v_race FROM public.room_races WHERE id = p_race_id;
  IF v_race.id IS NULL THEN
    RAISE EXCEPTION 'Race not found.';
  END IF;
  IF v_race.member_b_email != v_email THEN
    RAISE EXCEPTION 'Only the challenged member can decline this race.';
  END IF;
  IF v_race.status != 'Pending' THEN
    RAISE EXCEPTION 'This challenge is no longer pending.';
  END IF;

  UPDATE public.room_races
  SET status = 'Declined', resolved_at = timezone('utc'::text, now())
  WHERE id = p_race_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.decline_room_race(BIGINT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.decline_room_race(BIGINT) FROM PUBLIC, anon;

-- Background sweep, mirroring resolve_expired_duels()'s "pure SQL, called
-- directly by pg_cron" shape below: every race that's been accepted but
-- has no room yet gets one, picked independently at random per race (the
-- loop, rather than a single set-based UPDATE, is what guarantees two
-- different races don't get correlated picks from the same single random
-- draw). Draws from the same recommended_rooms pool the Dashboard's daily
-- room card already uses (064_recommended_rooms.sql) rather than
-- maintaining a second room list.
CREATE OR REPLACE FUNCTION public.assign_room_race_rooms()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_race RECORD;
  v_room RECORD;
BEGIN
  FOR v_race IN SELECT id FROM public.room_races WHERE status = 'Active' AND room_name IS NULL LOOP
    SELECT name, url INTO v_room FROM public.recommended_rooms ORDER BY random() LIMIT 1;
    IF v_room.name IS NOT NULL THEN
      UPDATE public.room_races
      SET room_name = v_room.name, room_url = v_room.url, room_assigned_at = timezone('utc'::text, now())
      WHERE id = v_race.id;
    END IF;
  END LOOP;
END;
$$;

-- Pure SQL cron, same idempotent unschedule-then-schedule shape as
-- resolve-expired-duels-hourly (062_quiz_duels.sql). 06:00 UTC = 08:00
-- SAST (Africa/Johannesburg has no DST, so this offset never drifts).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'assign-room-race-rooms-daily') THEN
    PERFORM cron.unschedule('assign-room-race-rooms-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'assign-room-race-rooms-daily',
  '0 6 * * *', -- 06:00 UTC (08:00 SAST) every day
  $$ SELECT public.assign_room_race_rooms(); $$
);

-- A participant marks their own side as done, same proof-confirmed
-- checkbox convention as log_my_room_day() in 031_daily_room_logs.sql.
-- Does not resolve the winner - that stays an admin call, via approval.
CREATE OR REPLACE FUNCTION public.submit_room_race_proof(p_race_id BIGINT, p_proof_confirmed BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_race public.room_races%ROWTYPE;
BEGIN
  SELECT * INTO v_race FROM public.room_races WHERE id = p_race_id;
  IF v_race.id IS NULL THEN
    RAISE EXCEPTION 'Race not found.';
  END IF;
  IF v_race.status != 'Active' THEN
    RAISE EXCEPTION 'This race is no longer active.';
  END IF;
  IF v_race.room_name IS NULL THEN
    RAISE EXCEPTION 'The room hasn''t been assigned yet - check back at 8am.';
  END IF;
  IF NOT p_proof_confirmed THEN
    RAISE EXCEPTION 'Confirm your proof before submitting.';
  END IF;

  IF v_race.member_a_email = v_email THEN
    UPDATE public.room_races SET member_a_submitted_at = timezone('utc'::text, now()) WHERE id = p_race_id;
  ELSIF v_race.member_b_email = v_email THEN
    UPDATE public.room_races SET member_b_submitted_at = timezone('utc'::text, now()) WHERE id = p_race_id;
  ELSE
    RAISE EXCEPTION 'You''re not part of this race.';
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_room_race_proof(BIGINT, BOOLEAN) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.submit_room_race_proof(BIGINT, BOOLEAN) FROM PUBLIC, anon;

-- Admin approval - whoever gets approved first, while the race is still
-- Active, wins on the spot. The `WHERE status = 'Active'` on the resolving
-- UPDATE gives this its atomicity: if both submissions were approved in
-- quick succession, only the first UPDATE finds the row still Active.
CREATE OR REPLACE FUNCTION public.approve_room_race_submission(p_race_id BIGINT, p_member_email TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(p_member_email);
  v_race public.room_races%ROWTYPE;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admin access required.';
  END IF;

  SELECT * INTO v_race FROM public.room_races WHERE id = p_race_id;
  IF v_race.id IS NULL THEN
    RAISE EXCEPTION 'Race not found.';
  END IF;
  -- Was previously enforced only by the admin UI's query filter
  -- (fetchAllActiveRoomRaces() excludes room_name IS NULL), not by this
  -- RPC itself - a direct call could declare a winner on a race with no
  -- room, meaning proof submission could never have actually happened.
  -- Deliberately checks room_name alone, not accepted_at too - races
  -- created before this accept-flow existed have a real room_name but a
  -- NULL accepted_at (they predate that column), and are still legitimate
  -- to approve.
  IF v_race.room_name IS NULL THEN
    RAISE EXCEPTION 'This race hasn''t been assigned a room yet.';
  END IF;

  IF v_race.member_a_email = v_email THEN
    UPDATE public.room_races SET member_a_approved_at = timezone('utc'::text, now()) WHERE id = p_race_id;
  ELSIF v_race.member_b_email = v_email THEN
    UPDATE public.room_races SET member_b_approved_at = timezone('utc'::text, now()) WHERE id = p_race_id;
  ELSE
    RAISE EXCEPTION 'That member isn''t part of this race.';
  END IF;

  UPDATE public.room_races
  SET status = 'Completed', winner_email = v_email, resolved_at = timezone('utc'::text, now())
  WHERE id = p_race_id AND status = 'Active';
END;
$$;
GRANT EXECUTE ON FUNCTION public.approve_room_race_submission(BIGINT, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.approve_room_race_submission(BIGINT, TEXT) FROM PUBLIC, anon;

-- is_member_a doubles as "am I the recipient" (the challenged member,
-- who's the only one who can accept/decline) whenever status is still
-- 'Pending' - member_b is always the one who was challenged, never the
-- challenger, so !is_member_a means "it's on me to respond."
DROP FUNCTION IF EXISTS public.get_my_room_races();
CREATE OR REPLACE FUNCTION public.get_my_room_races()
RETURNS TABLE (
  id BIGINT,
  room_name TEXT,
  room_url TEXT,
  opponent_email TEXT,
  opponent_name TEXT,
  is_member_a BOOLEAN,
  status TEXT,
  winner_email TEXT,
  accepted_at TIMESTAMP WITH TIME ZONE,
  my_submitted_at TIMESTAMP WITH TIME ZONE,
  my_approved_at TIMESTAMP WITH TIME ZONE,
  opponent_submitted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT
    r.id,
    r.room_name,
    r.room_url,
    CASE WHEN r.member_a_email = lower(auth.jwt() ->> 'email') THEN r.member_b_email ELSE r.member_a_email END,
    CASE WHEN r.member_a_email = lower(auth.jwt() ->> 'email') THEN r.member_b_name ELSE r.member_a_name END,
    r.member_a_email = lower(auth.jwt() ->> 'email'),
    r.status,
    r.winner_email,
    r.accepted_at,
    CASE WHEN r.member_a_email = lower(auth.jwt() ->> 'email') THEN r.member_a_submitted_at ELSE r.member_b_submitted_at END,
    CASE WHEN r.member_a_email = lower(auth.jwt() ->> 'email') THEN r.member_a_approved_at ELSE r.member_b_approved_at END,
    CASE WHEN r.member_a_email = lower(auth.jwt() ->> 'email') THEN r.member_b_submitted_at ELSE r.member_a_submitted_at END,
    r.created_at
  FROM public.room_races r
  WHERE r.member_a_email = lower(auth.jwt() ->> 'email') OR r.member_b_email = lower(auth.jwt() ->> 'email')
  ORDER BY r.created_at DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_room_races() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_room_races() FROM PUBLIC, anon;
