-- Hacking Hub Admin Dashboard - Room Race (Phase 2 of the head-to-head
-- competitions roadmap - see the "Duel Protocol" planning artifact)
-- Run in the Supabase SQL Editor after 062_quiz_duels.sql.
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
-- Two defaults below were not explicitly asked about and are worth
-- flagging: (1) admin approval reuses the existing Room Logs queue rather
-- than a new admin surface, since that's already the exact same "approve
-- a claimed room completion" workflow; (2) either player can name any
-- room to race on (no restriction to a fixed catalog, no filtering out
-- rooms already completed) - kept simple, matching the plan's own "room-
-- target selection kept simple" note.

CREATE TABLE IF NOT EXISTS public.room_races (
  id BIGSERIAL PRIMARY KEY,
  room_name TEXT NOT NULL,
  room_url TEXT,
  member_a_email TEXT NOT NULL,
  member_a_name TEXT,
  member_b_email TEXT NOT NULL,
  member_b_name TEXT,
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Completed', 'Cancelled')),
  winner_email TEXT,
  member_a_submitted_at TIMESTAMP WITH TIME ZONE,
  member_a_approved_at TIMESTAMP WITH TIME ZONE,
  member_b_submitted_at TIMESTAMP WITH TIME ZONE,
  member_b_approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  resolved_at TIMESTAMP WITH TIME ZONE
);

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

-- Starts a race immediately, no accept/decline step - same "you pick your
-- rival" simplicity as challenge_to_duel().
CREATE OR REPLACE FUNCTION public.challenge_to_room_race(p_opponent_email TEXT, p_opponent_name TEXT, p_room_name TEXT, p_room_url TEXT)
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
  IF trim(coalesce(p_room_name, '')) = '' THEN
    RAISE EXCEPTION 'Pick a room to race on.';
  END IF;

  SELECT full_name INTO v_name FROM public.member_profiles WHERE email = v_email;

  INSERT INTO public.room_races (room_name, room_url, member_a_email, member_a_name, member_b_email, member_b_name)
  VALUES (trim(p_room_name), nullif(trim(coalesce(p_room_url, '')), ''), v_email, v_name, v_opponent, p_opponent_name)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.challenge_to_room_race(TEXT, TEXT, TEXT, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.challenge_to_room_race(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;

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
