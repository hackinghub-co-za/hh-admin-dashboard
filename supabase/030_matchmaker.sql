-- Hacking Hub Admin Dashboard - Matchmaker (opt-in, randomized group work)
-- Run this in the Supabase SQL Editor after 002-029 have already been applied.
-- Safe to re-run: every statement is idempotent.
--
-- Redesigned from an admin-hand-picked-pair tool into an opt-in, randomized
-- one: a member chooses to join the pool (matchmaker_optins), and when an
-- admin runs a round (run_matchmaker_round()), everyone currently in the
-- pool is shuffled into groups of 2-4 and each group is randomly assigned
-- either a Project or a Presentation to work on together. Nobody - member or
-- admin - hand-picks who ends up with whom; that's the whole point, so
-- outcomes feel fair rather than like favoritism.
--
-- Drops the old two-person, admin-curated project_pairings table this
-- replaces - never run in production, so no data migration needed.
DROP TABLE IF EXISTS public.project_pairings CASCADE;

-- The opt-in pool. A member's own row, added when they join and removed
-- either when they leave voluntarily or when a round consumes the pool by
-- grouping everyone in it.
CREATE TABLE IF NOT EXISTS public.matchmaker_optins (
  member_email TEXT PRIMARY KEY,
  opted_in_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.matchmaker_optins ENABLE ROW LEVEL SECURITY;

-- Every approved member can see who else is in the pool (there's nothing
-- sensitive here, just who's opted in) - reinforces that joining is a real,
-- visible commitment, not a silent toggle.
DROP POLICY IF EXISTS "members read optin pool" ON public.matchmaker_optins;
CREATE POLICY "members read optin pool"
  ON public.matchmaker_optins FOR SELECT
  TO authenticated
  USING (public.is_member_allowed(auth.jwt() ->> 'email'));

-- Self-service join/leave, scoped to only the caller's own row - the same
-- ownership pattern as every other member-submitted table in this project.
DROP POLICY IF EXISTS "members join optin pool" ON public.matchmaker_optins;
CREATE POLICY "members join optin pool"
  ON public.matchmaker_optins FOR INSERT
  TO authenticated
  WITH CHECK (
    member_email = lower(auth.jwt() ->> 'email')
    AND public.is_member_allowed(auth.jwt() ->> 'email')
  );

DROP POLICY IF EXISTS "members leave optin pool" ON public.matchmaker_optins;
CREATE POLICY "members leave optin pool"
  ON public.matchmaker_optins FOR DELETE
  TO authenticated
  USING (member_email = lower(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "admins manage optin pool" ON public.matchmaker_optins;
CREATE POLICY "admins manage optin pool"
  ON public.matchmaker_optins FOR ALL
  USING (public.is_admin(auth.uid()));

-- A formed group: 2-4 members, working on either a Project or a
-- Presentation together. member_emails is a plain array rather than a join
-- table - the 2-4 cap keeps it small and RLS can check membership with a
-- simple ANY().
CREATE TABLE IF NOT EXISTS public.matchmaker_groups (
  id BIGSERIAL PRIMARY KEY,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('Project', 'Presentation')),
  member_emails TEXT[] NOT NULL CHECK (array_length(member_emails, 1) BETWEEN 2 AND 4),
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Completed')),
  -- How long a group has to actually present, per this project's stated
  -- norm of 3-4 weeks from the round that formed them. run_matchmaker_round()
  -- below defaults every new group to 3 weeks out; an admin can freely move
  -- it later (e.g. out to the full 4 weeks) from the Matchmaker tab.
  due_date DATE,
  -- When each member of this group was emailed to let them know they've
  -- been assigned (supabase/functions/matchmaker-group-email). Null until
  -- sent. Set once, right after sending, so re-triggering the function is
  -- always a safe no-op for a group that's already been notified.
  notified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Adds due_date/notified_at to a database where this table already existed -
-- the inline columns above only take effect on a fresh CREATE TABLE.
ALTER TABLE public.matchmaker_groups ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE public.matchmaker_groups ADD COLUMN IF NOT EXISTS notified_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.matchmaker_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read own group" ON public.matchmaker_groups;
CREATE POLICY "members read own group"
  ON public.matchmaker_groups FOR SELECT
  TO authenticated
  USING (
    lower(auth.jwt() ->> 'email') = ANY (member_emails)
    AND public.is_member_allowed(auth.jwt() ->> 'email')
  );

DROP POLICY IF EXISTS "admins manage groups" ON public.matchmaker_groups;
CREATE POLICY "admins manage groups"
  ON public.matchmaker_groups FOR ALL
  USING (public.is_admin(auth.uid()));

-- Runs one matching round: shuffles everyone currently in the opt-in pool
-- and splits them into groups sized as evenly as possible (2-4 each, never
-- a lone leftover) via round-robin assignment across ceil(N/4) groups - e.g.
-- 9 people become three groups of 3, not 4+4+1. Each group gets a coin-flip
-- activity type. The pool is fully consumed afterward, so the next round
-- starts fresh. Returns how many groups were created.
CREATE OR REPLACE FUNCTION public.run_matchmaker_round()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_groups_created INTEGER;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
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

  -- Supabase rejects a WHERE-less DELETE outright ("DELETE requires a WHERE
  -- clause") even inside a SECURITY DEFINER function - WHERE true is
  -- functionally identical to no WHERE clause, just explicit about it.
  DELETE FROM public.matchmaker_optins WHERE true;

  RETURN v_groups_created;
END;
$$;
GRANT EXECUTE ON FUNCTION public.run_matchmaker_round() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.run_matchmaker_round() FROM PUBLIC, anon;

-- =========================================================================
-- PRESENTATION RATINGS (2026-09) - once a group has actually presented,
-- they share the link to their recorded Google Meet, and the wider
-- membership (not just the two other people in the room) can rate it and
-- leave an optional anonymous comment. Two things this needs that the
-- table didn't have before: a place to put the recording link, and wider
-- read access - "members read own group" above only ever let a group see
-- itself, which is exactly wrong for a showcase meant to be watched by
-- people who weren't in it.
-- =========================================================================

ALTER TABLE public.matchmaker_groups ADD COLUMN IF NOT EXISTS recording_url TEXT;

-- Additive to "members read own group" (RLS OR's SELECT policies together) -
-- a member still always sees their own group regardless of recording
-- status, and now also sees any group at all once it has something to
-- watch. Deliberately keyed off recording_url rather than status='Completed'
-- - a group might share their recording before an admin gets around to
-- flipping status, and there's no reason to make the showcase wait on that.
DROP POLICY IF EXISTS "members read groups with recordings" ON public.matchmaker_groups;
CREATE POLICY "members read groups with recordings"
  ON public.matchmaker_groups FOR SELECT
  TO authenticated
  USING (
    recording_url IS NOT NULL
    AND public.is_member_allowed(auth.jwt() ->> 'email')
  );

-- Any member of a group can add or update its recording link - not just
-- whichever member happens to run the round or hosted the call.
CREATE OR REPLACE FUNCTION public.submit_group_recording(p_group_id BIGINT, p_recording_url TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_group RECORD;
BEGIN
  IF p_recording_url IS NULL OR trim(p_recording_url) = '' OR p_recording_url !~* '^https?://' THEN
    RAISE EXCEPTION 'Add a real link to the recording, starting with http:// or https://.';
  END IF;

  SELECT * INTO v_group FROM public.matchmaker_groups WHERE id = p_group_id;
  IF v_group IS NULL THEN
    RAISE EXCEPTION 'Group not found.';
  END IF;
  IF NOT (v_email = ANY (v_group.member_emails)) THEN
    RAISE EXCEPTION 'Only a member of this group can share its recording.';
  END IF;

  UPDATE public.matchmaker_groups SET recording_url = trim(p_recording_url) WHERE id = p_group_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_group_recording(BIGINT, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.submit_group_recording(BIGINT, TEXT) FROM PUBLIC, anon;

-- One rating per (group, rater) - re-rating just overwrites via the upsert
-- in rate_matchmaker_group() below, same "resubmitting resets the previous
-- value" convention as Projects proof. rater_email is kept for that
-- uniqueness constraint and for admin moderation only - it is never
-- returned to another member (see get_group_ratings() below, which omits
-- it entirely), which is what makes the comment genuinely anonymous rather
-- than just hidden by the UI.
CREATE TABLE IF NOT EXISTS public.matchmaker_group_ratings (
  id BIGSERIAL PRIMARY KEY,
  group_id BIGINT NOT NULL REFERENCES public.matchmaker_groups(id) ON DELETE CASCADE,
  rater_email TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (group_id, rater_email)
);

-- Widens rating from SMALLINT to INTEGER on a database where this table
-- already existed (the inline column type above only takes effect on a
-- fresh CREATE TABLE) - SMALLINT caused untyped numeric literals/JSON
-- values to fail to match the RPC overloads below without an explicit
-- cast; INTEGER matches cleanly everywhere a rating 1-5 shows up.
ALTER TABLE public.matchmaker_group_ratings ALTER COLUMN rating TYPE INTEGER;

ALTER TABLE public.matchmaker_group_ratings ENABLE ROW LEVEL SECURITY;

-- No member SELECT/INSERT policy at all, on purpose - every member read or
-- write goes through the SECURITY DEFINER RPCs below, the same "RPC-only,
-- zero direct table grant" idiom already used for portal_events, so a
-- member can never query this table directly and see who left a comment.
DROP POLICY IF EXISTS "admins manage group ratings" ON public.matchmaker_group_ratings;
CREATE POLICY "admins manage group ratings"
  ON public.matchmaker_group_ratings FOR ALL
  USING (public.is_admin(auth.uid()));

-- Rates a group's recorded presentation. Blocks the group's own members
-- from rating themselves, and requires a recording to exist first - rating
-- a presentation nobody can watch yet doesn't mean anything.
DROP FUNCTION IF EXISTS public.rate_matchmaker_group(BIGINT, SMALLINT, TEXT);
CREATE OR REPLACE FUNCTION public.rate_matchmaker_group(p_group_id BIGINT, p_rating INTEGER, p_comment TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_group RECORD;
BEGIN
  IF NOT public.is_member_allowed(v_email) THEN
    RAISE EXCEPTION 'Only approved members can rate a presentation.';
  END IF;
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5.';
  END IF;

  SELECT * INTO v_group FROM public.matchmaker_groups WHERE id = p_group_id;
  IF v_group IS NULL THEN
    RAISE EXCEPTION 'Group not found.';
  END IF;
  IF v_group.recording_url IS NULL THEN
    RAISE EXCEPTION 'This group hasn''t shared a recording yet.';
  END IF;
  IF v_email = ANY (v_group.member_emails) THEN
    RAISE EXCEPTION 'You can''t rate your own group''s presentation.';
  END IF;

  INSERT INTO public.matchmaker_group_ratings (group_id, rater_email, rating, comment)
  VALUES (p_group_id, v_email, p_rating, NULLIF(trim(COALESCE(p_comment, '')), ''))
  ON CONFLICT (group_id, rater_email)
  DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, created_at = timezone('utc'::text, now());
END;
$$;
GRANT EXECUTE ON FUNCTION public.rate_matchmaker_group(BIGINT, INTEGER, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.rate_matchmaker_group(BIGINT, INTEGER, TEXT) FROM PUBLIC, anon;

-- Every rating + comment for a group, newest first - deliberately omits
-- rater_email so the anonymity is enforced server-side, not just by the UI
-- choosing not to display it.
DROP FUNCTION IF EXISTS public.get_group_ratings(BIGINT);
CREATE OR REPLACE FUNCTION public.get_group_ratings(p_group_id BIGINT)
RETURNS TABLE (rating INTEGER, comment TEXT, created_at TIMESTAMPTZ)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT rating, comment, created_at
  FROM public.matchmaker_group_ratings
  WHERE group_id = p_group_id
  ORDER BY created_at DESC;
$$;
GRANT EXECUTE ON FUNCTION public.get_group_ratings(BIGINT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_group_ratings(BIGINT) FROM PUBLIC, anon;

-- What the calling member themselves already rated this group, if
-- anything - lets the UI show "you rated this" pre-filled instead of a
-- blank form every time they revisit the showcase.
DROP FUNCTION IF EXISTS public.get_my_group_rating(BIGINT);
CREATE OR REPLACE FUNCTION public.get_my_group_rating(p_group_id BIGINT)
RETURNS TABLE (rating INTEGER, comment TEXT)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT rating, comment
  FROM public.matchmaker_group_ratings
  WHERE group_id = p_group_id AND rater_email = lower(auth.jwt() ->> 'email');
$$;
GRANT EXECUTE ON FUNCTION public.get_my_group_rating(BIGINT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_group_rating(BIGINT) FROM PUBLIC, anon;
