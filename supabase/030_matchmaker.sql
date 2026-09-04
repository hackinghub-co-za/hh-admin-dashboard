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
