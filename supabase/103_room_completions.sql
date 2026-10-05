-- Hacking Hub Admin Dashboard - Room Completions (real screenshot proof)
-- Run this in the Supabase SQL Editor after 002-102 have already been applied.
-- Safe to re-run: every statement is idempotent.
--
-- Adds a second, stronger way to log a completed TryHackMe room alongside
-- daily_room_logs (031_daily_room_logs.sql): instead of a daily count plus
-- a bare "I posted a once-view photo in WhatsApp" checkbox, a member
-- attaches the actual screenshot to one specific room, submitted from the
-- hh-app mobile tab. daily_room_logs is untouched and keeps working for
-- anyone still using the WhatsApp flow - both credit the same
-- competition_standings.rooms_completed, so neither path is required.
--
-- Deliberately per-room, not per-day: a screenshot is naturally evidence
-- for exactly one room, and this also gives a member a real, visible log
-- of which rooms they've done - daily_room_logs could only ever show a
-- count. No daily cap here (unlike daily_room_logs' 3/2 weekday/weekend
-- limit) since there's nothing to cap: each submission is one real room,
-- not a self-reported number.
--
-- Still not automated verification - an admin still has to look at the
-- screenshot and judge it, same trust model as every other Pending/
-- Approved/Rejected table in this codebase. The real upgrade over
-- daily_room_logs is that there's now something to actually look at.

CREATE TABLE IF NOT EXISTS public.room_completions (
  id BIGSERIAL PRIMARY KEY,
  member_email TEXT NOT NULL,
  room_name TEXT NOT NULL CHECK (char_length(trim(room_name)) > 0),
  screenshot_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  reviewed_by TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  admin_note TEXT,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ROOM PROOF STORAGE - public bucket, member-owned folder, same convention
-- as member-headshots (010_member_directory.sql): a screenshot's URL is
-- effectively unguessable (random file name under the uploader's own
-- email-prefixed folder) rather than actually access-controlled, same
-- tradeoff this codebase already makes for every other member-owned image.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('room-proofs', 'room-proofs', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "public read room proofs" ON storage.objects;
CREATE POLICY "public read room proofs"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'room-proofs');

DROP POLICY IF EXISTS "members upload own room proof" ON storage.objects;
CREATE POLICY "members upload own room proof"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'room-proofs'
    AND (storage.foldername(name))[1] = lower(auth.jwt() ->> 'email')
    AND public.is_member_allowed(auth.jwt() ->> 'email')
  );

ALTER TABLE public.room_completions ENABLE ROW LEVEL SECURITY;

-- Unlike community_events, there's no "browse other members' submissions"
-- use case here - the leaderboard (competition_standings) already serves
-- the public aggregate view, so a member only ever needs to see their own
-- screenshots and review history.
DROP POLICY IF EXISTS "members read own room completions" ON public.room_completions;
CREATE POLICY "members read own room completions"
  ON public.room_completions FOR SELECT
  TO authenticated
  USING (
    member_email = lower(auth.jwt() ->> 'email')
    AND public.is_member_allowed(auth.jwt() ->> 'email')
  );

-- Same reviewer set as daily_room_logs (067_permission_scopes.sql widened
-- that one to admin OR community_manager - matched here from the start
-- rather than needing a later widening migration of its own).
DROP POLICY IF EXISTS "admins manage room completions" ON public.room_completions;
CREATE POLICY "admins manage room completions"
  ON public.room_completions FOR ALL
  USING (public.is_admin(auth.uid()) OR public.is_community_manager(auth.uid()));

-- No member INSERT policy - submissions go through
-- submit_room_completion() below, same "server decides the starting
-- status, never the client" reasoning as submit_daily_room_log().
CREATE OR REPLACE FUNCTION public.submit_room_completion(p_room_name TEXT, p_screenshot_path TEXT)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_id BIGINT;
BEGIN
  IF p_room_name IS NULL OR char_length(trim(p_room_name)) = 0 THEN
    RAISE EXCEPTION 'Enter which room this screenshot proves.';
  END IF;
  IF p_screenshot_path IS NULL OR char_length(trim(p_screenshot_path)) = 0 THEN
    RAISE EXCEPTION 'Attach a screenshot before submitting.';
  END IF;

  -- Same RSVP gate as submit_daily_room_log() - without a
  -- competition_standings row, an approval below would silently credit
  -- nothing (the UPDATE just matches zero rows), which is a confusing
  -- dead end to hit two steps later instead of catching it here.
  IF NOT EXISTS (SELECT 1 FROM public.competition_standings WHERE email = v_email) THEN
    RAISE EXCEPTION 'RSVP for the competition first before submitting a room.';
  END IF;

  IF NOT public.is_member_allowed(v_email) THEN
    RAISE EXCEPTION 'Only active members can submit room proof.';
  END IF;

  INSERT INTO public.room_completions (member_email, room_name, screenshot_path, status)
  VALUES (v_email, trim(p_room_name), p_screenshot_path, 'Pending')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_room_completion(TEXT, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.submit_room_completion(TEXT, TEXT) FROM PUBLIC, anon;

-- Approving credits rooms_completed by exactly 1 - points stays
-- admin-manual-entry-only, same as every other room-completion path
-- (015_competition_standings.sql: "no live TryHackMe API integration to
-- pull real scores from"). Pending-only UPDATE guard is the same
-- double-review race protection review_daily_room_log() already uses.
CREATE OR REPLACE FUNCTION public.review_room_completion(p_completion_id BIGINT, p_approved BOOLEAN, p_admin_note TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_member_email TEXT;
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_community_manager(auth.uid())) THEN
    RAISE EXCEPTION 'Only admins can review room completions.';
  END IF;

  SELECT member_email INTO v_member_email
  FROM public.room_completions WHERE id = p_completion_id;

  IF v_member_email IS NULL THEN
    RAISE EXCEPTION 'Room completion not found.';
  END IF;

  UPDATE public.room_completions
  SET status = CASE WHEN p_approved THEN 'Approved' ELSE 'Rejected' END,
      reviewed_by = lower(auth.jwt() ->> 'email'),
      reviewed_at = timezone('utc'::text, now()),
      admin_note = p_admin_note
  WHERE id = p_completion_id AND status = 'Pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This submission has already been reviewed - refresh the page.';
  END IF;

  IF p_approved THEN
    UPDATE public.competition_standings
    SET rooms_completed = rooms_completed + 1
    WHERE email = v_member_email;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.review_room_completion(BIGINT, BOOLEAN, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.review_room_completion(BIGINT, BOOLEAN, TEXT) FROM PUBLIC, anon;
