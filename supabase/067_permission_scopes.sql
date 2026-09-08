-- Hacking Hub Admin Dashboard - Scoped Team Permissions
-- Run this in the Supabase SQL Editor after 002-066 have already been applied.
-- Safe to re-run: every statement is idempotent.
--
-- Until now, "admin" has been a single binary flag (profiles.role IN
-- ('admin', 'member')), and it was granted completely automatically: the
-- moment any Google account ending in @hackinghub.co.za signed in for the
-- first time, handle_new_user() (schema.sql) wrote role='admin' - full
-- access to every admin-gated table in the schema, including finances,
-- payments, and every member's sensitive profile fields. There was no way
-- to give someone partial access.
--
-- This adds two real, narrower roles - community_manager (runs
-- competitions, moderates community content, keeps people accountable)
-- and mentor (reviews roadmap/cert/CV/interview progress) - alongside the
-- existing admin (founder-level, unchanged) and member. is_admin() itself
-- is deliberately left meaning exactly what it always has (founder-level
-- only) rather than redefined, since it's referenced in 35 other migration
-- files - redefining it would silently widen every one of them at once,
-- with no per-table review. Instead, each table/RPC that should open to a
-- new role is widened individually, right here, via the same idempotent
-- DROP POLICY + CREATE POLICY / CREATE OR REPLACE FUNCTION pattern already
-- used everywhere else in this schema to evolve an existing object from a
-- later file - e.g. 010_member_directory.sql widening a CHECK constraint
-- from 002, or 019_events.sql consolidating fixes from since-deleted
-- 022/023. This file runs after every table/RPC it touches, so every
-- DROP+CREATE below is guaranteed to find the object it's replacing.
--
-- Deliberately NOT widened to the new roles: Members' financial fields
-- (money_owed, monthly_remuneration, phone, age - member_profiles has no
-- column-level RLS, only row-level, so there's no safe way to grant "read
-- the roster but not the money" without a dedicated whitelist function,
-- which doesn't exist yet), Finances, Payments & Subs, Merch Orders, Job
-- Board, Insights, and role assignment itself - all stay founder-only.

-- =========================================================================
-- PART 1: ROLE INFRASTRUCTURE
-- =========================================================================

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'community_manager', 'mentor', 'member'));

-- Was: any @hackinghub.co.za sign-in auto-became a full admin. Now: every
-- new sign-in, regardless of domain, starts as a plain member - the
-- founder assigns community_manager/mentor/admin explicitly afterward via
-- set_member_role() below (surfaced as the Team & Roles admin tab). This
-- doesn't touch any existing profiles row - only affects new signups from
-- here on, so the founder's own existing admin row is unaffected.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
    VALUES (
        new.id,
        new.email,
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'avatar_url',
        'member'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_community_manager(uid UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE profiles.id = uid AND profiles.role IN ('admin', 'community_manager')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_mentor(uid UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE profiles.id = uid AND profiles.role IN ('admin', 'mentor')
  );
$$;

-- The client currently has no way to know a signed-in user's real role
-- except guessing from their email domain - this is what actually replaces
-- that guess (see App.jsx). Anyone can read their own role; there's
-- nothing sensitive in the value itself.
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_role() FROM PUBLIC, anon;

-- Founder-only, deliberately - letting a community_manager or mentor grant
-- roles (even to themselves) would be a privilege-escalation hole.
CREATE OR REPLACE FUNCTION public.set_member_role(p_email TEXT, p_role TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only the founder can assign roles.';
  END IF;
  IF p_role NOT IN ('admin', 'community_manager', 'mentor', 'member') THEN
    RAISE EXCEPTION 'Not a real role.';
  END IF;

  UPDATE public.profiles SET role = p_role WHERE email = lower(p_email);
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No account found for that email - they need to have signed in at least once first.';
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_member_role(TEXT, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.set_member_role(TEXT, TEXT) FROM PUBLIC, anon;

-- Everyone with a non-member role, for the Team & Roles admin tab.
-- Founder-only - this is a real internal roster, not directory content.
CREATE OR REPLACE FUNCTION public.list_team_members()
RETURNS TABLE (email TEXT, full_name TEXT, role TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only the founder can view the team roster.';
  END IF;

  RETURN QUERY
  SELECT p.email, p.full_name, p.role
  FROM public.profiles p
  WHERE p.role != 'member'
  ORDER BY CASE p.role WHEN 'admin' THEN 0 WHEN 'community_manager' THEN 1 WHEN 'mentor' THEN 2 ELSE 3 END, p.email;
END;
$$;
GRANT EXECUTE ON FUNCTION public.list_team_members() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.list_team_members() FROM PUBLIC, anon;

-- =========================================================================
-- PART 2: COMMUNITY MANAGER - competitions + community content
-- =========================================================================

DROP POLICY IF EXISTS "admins manage room logs" ON public.daily_room_logs;
CREATE POLICY "admins manage room logs"
  ON public.daily_room_logs FOR ALL
  USING (public.is_admin(auth.uid()) OR public.is_community_manager(auth.uid()));

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

DROP POLICY IF EXISTS "admins manage room races" ON public.room_races;
CREATE POLICY "admins manage room races"
  ON public.room_races FOR ALL
  USING (public.is_admin(auth.uid()) OR public.is_community_manager(auth.uid()));

CREATE OR REPLACE FUNCTION public.approve_room_race_submission(p_race_id BIGINT, p_member_email TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(p_member_email);
  v_race public.room_races%ROWTYPE;
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_community_manager(auth.uid())) THEN
    RAISE EXCEPTION 'Admin access required.';
  END IF;

  SELECT * INTO v_race FROM public.room_races WHERE id = p_race_id;
  IF v_race.id IS NULL THEN
    RAISE EXCEPTION 'Race not found.';
  END IF;
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

DROP POLICY IF EXISTS "admins manage optin pool" ON public.matchmaker_optins;
CREATE POLICY "admins manage optin pool"
  ON public.matchmaker_optins FOR ALL
  USING (public.is_admin(auth.uid()) OR public.is_community_manager(auth.uid()));

DROP POLICY IF EXISTS "admins manage groups" ON public.matchmaker_groups;
CREATE POLICY "admins manage groups"
  ON public.matchmaker_groups FOR ALL
  USING (public.is_admin(auth.uid()) OR public.is_community_manager(auth.uid()));

DROP POLICY IF EXISTS "admins manage group ratings" ON public.matchmaker_group_ratings;
CREATE POLICY "admins manage group ratings"
  ON public.matchmaker_group_ratings FOR ALL
  USING (public.is_admin(auth.uid()) OR public.is_community_manager(auth.uid()));

CREATE OR REPLACE FUNCTION public.run_matchmaker_round()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_groups_created INTEGER;
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_community_manager(auth.uid())) THEN
    RAISE EXCEPTION 'Only admins can run a matchmaker round.';
  END IF;

  IF (SELECT count(*) FROM public.matchmaker_optins) < 2 THEN
    RAISE EXCEPTION 'Need at least 2 opted-in members to run a round.';
  END IF;

  WITH shuffled AS (
    SELECT
      member_email,
      row_number() OVER (ORDER BY random()) AS rn,
      count(*) OVER () AS total
    FROM public.matchmaker_optins
  ),
  sized AS (
    SELECT member_email, mod(rn - 1, ceil(total / 4.0)::int) AS grp
    FROM shuffled
  ),
  grouped AS (
    SELECT grp, array_agg(member_email) AS emails
    FROM sized
    GROUP BY grp
  ),
  inserted AS (
    INSERT INTO public.matchmaker_groups (activity_type, member_emails, due_date)
    SELECT
      CASE WHEN random() < 0.5 THEN 'Project' ELSE 'Presentation' END,
      emails,
      (timezone('utc'::text, now())::date + 21)
    FROM grouped
    RETURNING id
  )
  SELECT count(*) INTO v_groups_created FROM inserted;

  DELETE FROM public.matchmaker_optins WHERE true;

  RETURN v_groups_created;
END;
$$;
GRANT EXECUTE ON FUNCTION public.run_matchmaker_round() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.run_matchmaker_round() FROM PUBLIC, anon;

DROP POLICY IF EXISTS "admins manage broadcasts" ON public.community_broadcasts;
CREATE POLICY "admins manage broadcasts"
  ON public.community_broadcasts FOR ALL
  USING (public.is_admin(auth.uid()) OR public.is_community_manager(auth.uid()));

DROP POLICY IF EXISTS "admins manage wins" ON public.community_wins;
CREATE POLICY "admins manage wins"
  ON public.community_wins FOR ALL
  USING (public.is_admin(auth.uid()) OR public.is_community_manager(auth.uid()));

DROP POLICY IF EXISTS "admins manage recommended rooms" ON public.recommended_rooms;
CREATE POLICY "admins manage recommended rooms"
  ON public.recommended_rooms FOR ALL
  USING (public.is_admin(auth.uid()) OR public.is_community_manager(auth.uid()));

DROP POLICY IF EXISTS "admins manage trivia sessions" ON public.trivia_sessions;
CREATE POLICY "admins manage trivia sessions"
  ON public.trivia_sessions FOR ALL
  USING (public.is_admin(auth.uid()) OR public.is_community_manager(auth.uid()));

DROP POLICY IF EXISTS "admins manage trivia participants" ON public.trivia_participants;
CREATE POLICY "admins manage trivia participants"
  ON public.trivia_participants FOR ALL
  USING (public.is_admin(auth.uid()) OR public.is_community_manager(auth.uid()));

DROP POLICY IF EXISTS "admins manage trivia buzzes" ON public.trivia_buzzes;
CREATE POLICY "admins manage trivia buzzes"
  ON public.trivia_buzzes FOR ALL
  USING (public.is_admin(auth.uid()) OR public.is_community_manager(auth.uid()));

CREATE OR REPLACE FUNCTION public.create_trivia_session(p_title TEXT, p_question_count INTEGER DEFAULT 10)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_question_ids JSONB;
  v_id BIGINT;
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_community_manager(auth.uid())) THEN
    RAISE EXCEPTION 'Only admins can create a trivia session.';
  END IF;
  IF trim(coalesce(p_title, '')) = '' THEN
    RAISE EXCEPTION 'Give the session a title.';
  END IF;

  SELECT jsonb_agg(id) INTO v_question_ids FROM (
    SELECT id FROM public.duel_questions ORDER BY random() LIMIT greatest(p_question_count, 1)
  ) q;

  IF v_question_ids IS NULL OR jsonb_array_length(v_question_ids) = 0 THEN
    RAISE EXCEPTION 'No trivia questions are set up yet.';
  END IF;

  INSERT INTO public.trivia_sessions (title, question_ids, created_by)
  VALUES (trim(p_title), v_question_ids, lower(auth.jwt() ->> 'email'))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_trivia_session(TEXT, INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_trivia_session(TEXT, INTEGER) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.start_trivia_session(p_session_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_community_manager(auth.uid())) THEN
    RAISE EXCEPTION 'Only admins can start a trivia session.';
  END IF;

  UPDATE public.trivia_sessions
  SET status = 'Active',
      current_question_index = 0,
      current_question_locked = false,
      current_question_started_at = timezone('utc'::text, now()),
      started_at = timezone('utc'::text, now())
  WHERE id = p_session_id AND status = 'Waiting';
END;
$$;
GRANT EXECUTE ON FUNCTION public.start_trivia_session(BIGINT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.start_trivia_session(BIGINT) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.advance_trivia_question(p_session_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_session public.trivia_sessions%ROWTYPE;
  v_total INTEGER;
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_community_manager(auth.uid())) THEN
    RAISE EXCEPTION 'Only admins can advance the session.';
  END IF;

  SELECT * INTO v_session FROM public.trivia_sessions WHERE id = p_session_id;
  IF v_session.id IS NULL OR v_session.status != 'Active' THEN
    RAISE EXCEPTION 'This session is not active.';
  END IF;

  v_total := jsonb_array_length(v_session.question_ids);

  IF v_session.current_question_index + 1 >= v_total THEN
    UPDATE public.trivia_sessions
    SET status = 'Completed', completed_at = timezone('utc'::text, now())
    WHERE id = p_session_id;
  ELSE
    UPDATE public.trivia_sessions
    SET current_question_index = current_question_index + 1,
        current_question_locked = false,
        current_question_started_at = timezone('utc'::text, now())
    WHERE id = p_session_id;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.advance_trivia_question(BIGINT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.advance_trivia_question(BIGINT) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.end_trivia_session(p_session_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_community_manager(auth.uid())) THEN
    RAISE EXCEPTION 'Only admins can end a trivia session.';
  END IF;

  UPDATE public.trivia_sessions
  SET status = 'Completed', completed_at = timezone('utc'::text, now())
  WHERE id = p_session_id AND status IN ('Waiting', 'Active');
END;
$$;
GRANT EXECUTE ON FUNCTION public.end_trivia_session(BIGINT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.end_trivia_session(BIGINT) FROM PUBLIC, anon;

-- =========================================================================
-- PART 3: MENTOR - roadmap review, certs, CV review, interview prep
-- =========================================================================

DROP POLICY IF EXISTS "admins manage roadmap" ON public.roadmap_items;
CREATE POLICY "admins manage roadmap"
  ON public.roadmap_items FOR ALL
  USING (public.is_admin(auth.uid()) OR public.is_mentor(auth.uid()));

CREATE OR REPLACE FUNCTION public.review_project_submission(p_item_id BIGINT, p_approved BOOLEAN, p_note TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_member_email TEXT;
  v_phase TEXT;
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_mentor(auth.uid())) THEN
    RAISE EXCEPTION 'Only admins can review Project submissions.';
  END IF;

  SELECT member_email, phase INTO v_member_email, v_phase
  FROM public.roadmap_items WHERE id = p_item_id;

  IF v_member_email IS NULL THEN
    RAISE EXCEPTION 'Item not found.';
  END IF;
  IF v_phase != 'Projects' THEN
    RAISE EXCEPTION 'This item is not a Projects submission.';
  END IF;

  UPDATE public.roadmap_items
  SET review_status = CASE WHEN p_approved THEN 'Approved' ELSE 'Rejected' END,
      completed = p_approved,
      review_note = p_note,
      reviewed_at = timezone('utc'::text, now()),
      updated_at = timezone('utc'::text, now())
  WHERE id = p_item_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.review_project_submission(BIGINT, BOOLEAN, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.review_project_submission(BIGINT, BOOLEAN, TEXT) FROM PUBLIC, anon;

-- Also open to community_manager, not just mentor - founder confirmed
-- Community Manager should be able to mark cert results too.
DROP POLICY IF EXISTS "admins manage cert calendar" ON public.cert_calendar;
CREATE POLICY "admins manage cert calendar"
  ON public.cert_calendar FOR ALL
  USING (public.is_admin(auth.uid()) OR public.is_mentor(auth.uid()) OR public.is_community_manager(auth.uid()));

DROP POLICY IF EXISTS "admins manage cv reviews" ON public.cv_reviews;
CREATE POLICY "admins manage cv reviews"
  ON public.cv_reviews FOR ALL
  USING (public.is_admin(auth.uid()) OR public.is_mentor(auth.uid()));

DROP POLICY IF EXISTS "admins manage interview prep sessions" ON public.interview_prep_sessions;
CREATE POLICY "admins manage interview prep sessions"
  ON public.interview_prep_sessions FOR ALL
  USING (public.is_admin(auth.uid()) OR public.is_mentor(auth.uid()));

DROP POLICY IF EXISTS "admins manage interviews" ON public.member_interviews;
CREATE POLICY "admins manage interviews"
  ON public.member_interviews FOR ALL
  USING (public.is_admin(auth.uid()) OR public.is_mentor(auth.uid()));

-- =========================================================================
-- PART 4: COMMUNITY MANAGER, widened further (2026-09) - Job Board and
-- Events, per the founder's follow-up. Job Board never had a moderation
-- step (member-submitted listings already go live immediately, see
-- 025_job_board.sql), so this only ever affects who can edit/remove any
-- listing. Events is the more interesting one: it already had TWO separate
-- admin gates - a general "admins manage community events" RLS policy
-- (add/edit/delete any event) and a narrower, deliberately
-- exact-email-only approve_community_event() RPC (only siya@hackinghub.co.za,
-- specifically to keep event approval out of every admin's hands) - both
-- are widened below to also accept a community_manager, alongside siya
-- specifically, not instead of her.
-- =========================================================================

DROP POLICY IF EXISTS "admins manage job board" ON public.job_board;
CREATE POLICY "admins manage job board"
  ON public.job_board FOR ALL
  USING (public.is_admin(auth.uid()) OR public.is_community_manager(auth.uid()));

DROP POLICY IF EXISTS "admins manage community events" ON public.community_events;
CREATE POLICY "admins manage community events"
  ON public.community_events FOR ALL
  USING (public.is_admin(auth.uid()) OR public.is_community_manager(auth.uid()));

DROP POLICY IF EXISTS "admins manage event rsvps" ON public.event_rsvps;
CREATE POLICY "admins manage event rsvps"
  ON public.event_rsvps FOR ALL
  USING (public.is_admin(auth.uid()) OR public.is_community_manager(auth.uid()));

-- Approval itself stays deliberately narrower than general community_events
-- management (matching the original design intent - see 019_events.sql's
-- own comment on why this is a dedicated RPC rather than a policy): now
-- exactly siya@hackinghub.co.za OR any community_manager, not every admin.
DROP FUNCTION IF EXISTS public.approve_community_event(BIGINT);
CREATE FUNCTION public.approve_community_event(p_event_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF lower(auth.jwt() ->> 'email') != 'siya@hackinghub.co.za' AND NOT public.is_community_manager(auth.uid()) THEN
    RAISE EXCEPTION 'Only siya@hackinghub.co.za or a Community Manager can approve events';
  END IF;
  UPDATE public.community_events SET status = 'Approved' WHERE id = p_event_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.approve_community_event(BIGINT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.approve_community_event(BIGINT) FROM PUBLIC, anon;
