-- Hacking Hub Admin Dashboard - Core Foundations Pathway
-- Run this in the Supabase SQL Editor after 002-101 have already been
-- applied. Safe to re-run: every statement is idempotent.
--
-- The new look for Core Foundations on My Roadmap: a two-lane pathway
-- (labs always running, certificate sprints on top) that a member can
-- rearrange, with a checkpoint 1-on-1 they must book at 2, 4 and 5 items.
--
-- What a member has DONE still lives where it always has (roadmap_items +
-- roadmap_item_subtasks), so Hub Score, the 5-of-8 Specialization unlock
-- and staff views keep working unchanged. This table only holds the
-- member's own pathway choices and their checkpoint bookings.
--
-- Existing members: no backfill. The first time a member opens the
-- pathway, get_my_pathway() creates their row starting today, and any
-- checkpoint they had already passed is recorded as cleared ("prior"), so
-- nobody is stopped retroactively. Already-completed items never appear in
-- the lanes because the client builds the lanes from what is still undone.

CREATE TABLE IF NOT EXISTS public.member_pathways (
  member_email TEXT PRIMARY KEY,
  started_on DATE NOT NULL,
  weekly_hours INTEGER NOT NULL DEFAULT 6 CHECK (weekly_hours IN (3, 4, 6, 8, 10, 12)),
  -- Preferred order of the three lab items, by catalog title.
  lab_order TEXT[] NOT NULL DEFAULT '{}',
  -- Pathway week each certificate sprint starts, e.g. {"AZ-900": 3, "SC-900": 9}.
  cert_starts JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(cert_starts) = 'object'),
  -- Checkpoint (2, 4 or 5 items done) -> how it was cleared, e.g.
  -- {"2": {"how": "booked", "on": "2026-10-12"}, "4": {"how": "prior", "on": "2026-10-04"}}.
  checkpoints JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(checkpoints) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.member_pathways ENABLE ROW LEVEL SECURITY;

-- Members never touch the table directly - only through the RPCs below.
-- Staff can read every row, so a 1-on-1 can see a member's custom order and
-- which checkpoints were self-declared rather than backed by a real meeting.
DROP POLICY IF EXISTS "staff read member pathways" ON public.member_pathways;
CREATE POLICY "staff read member pathways"
  ON public.member_pathways FOR SELECT TO authenticated
  USING (public.is_community_manager(auth.uid()) OR public.is_mentor(auth.uid()));

-- How many of the 8 Core Foundations catalog items a member has completed
-- (same titles as CORE_FOUNDATIONS_CATALOG in src/lib/memberOptions.js).
CREATE OR REPLACE FUNCTION public._core_foundations_done(p_email TEXT)
RETURNS INTEGER
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT count(*)::int
  FROM public.roadmap_items ri
  WHERE ri.member_email = lower(p_email)
    AND ri.phase = 'Core Foundations'
    AND ri.completed
    AND ri.title IN ('CISCO Junior Cyber Pathway', 'Immersive Labs', 'TryHackMe Pre-Security', 'TryHackMe Cyber 101',
                     'AZ-900', 'AI-901', 'SC-900', 'CompTIA Security+');
$$;
REVOKE EXECUTE ON FUNCTION public._core_foundations_done(TEXT) FROM PUBLIC, anon, authenticated;

-- The caller's pathway, created on first call. Also returns the dates of
-- the caller's real 1-on-1s (staff-logged sessions and synced calendar
-- meetings), which clear a checkpoint automatically when one falls after
-- the checkpoint was reached.
CREATE OR REPLACE FUNCTION public.get_my_pathway()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_today DATE := (now() AT TIME ZONE 'Africa/Johannesburg')::date;
  v_done INTEGER;
  v_prior JSONB := '{}'::jsonb;
  v_row public.member_pathways%ROWTYPE;
  v_dates JSONB;
BEGIN
  IF v_email IS NULL OR NOT public.is_member_allowed(v_email) THEN
    RAISE EXCEPTION 'Not an approved member.';
  END IF;

  SELECT * INTO v_row FROM public.member_pathways WHERE member_email = v_email;
  IF NOT FOUND THEN
    v_done := public._core_foundations_done(v_email);
    SELECT COALESCE(jsonb_object_agg(t::text, jsonb_build_object('how', 'prior', 'on', v_today)), '{}'::jsonb)
      INTO v_prior FROM unnest(ARRAY[2, 4, 5]) t WHERE t <= v_done;
    INSERT INTO public.member_pathways (member_email, started_on, checkpoints)
    VALUES (v_email, v_today, v_prior)
    ON CONFLICT (member_email) DO NOTHING;
    SELECT * INTO v_row FROM public.member_pathways WHERE member_email = v_email;
  END IF;

  SELECT COALESCE(jsonb_agg(DISTINCT d ORDER BY d), '[]'::jsonb) INTO v_dates FROM (
    SELECT session_date AS d FROM public.one_on_one_logs WHERE member_email = v_email
    UNION SELECT meeting_date FROM public.calendar_synced_meetings WHERE member_email = v_email
  ) x;

  RETURN jsonb_build_object(
    'started_on', v_row.started_on,
    'weekly_hours', v_row.weekly_hours,
    'lab_order', to_jsonb(v_row.lab_order),
    'cert_starts', v_row.cert_starts,
    'checkpoints', v_row.checkpoints,
    'meeting_dates', v_dates
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_pathway() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_pathway() FROM PUBLIC, anon;

-- Saves a member's rearranged lanes and pace. Shape is validated here; the
-- scheduling rules (no overlapping sprints, nothing in the past) are the
-- client's job, since they depend on progress the client already has.
CREATE OR REPLACE FUNCTION public.save_my_pathway(p_lab_order TEXT[], p_cert_starts JSONB, p_weekly_hours INTEGER)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_key TEXT;
  v_val JSONB;
BEGIN
  IF v_email IS NULL OR NOT public.is_member_allowed(v_email) THEN
    RAISE EXCEPTION 'Not an approved member.';
  END IF;
  IF p_weekly_hours IS NULL OR p_weekly_hours NOT IN (3, 4, 6, 8, 10, 12) THEN
    RAISE EXCEPTION 'Weekly hours must be 3, 4, 6, 8, 10 or 12.';
  END IF;
  IF p_lab_order IS NULL
     OR cardinality(p_lab_order) > 3
     OR (SELECT count(DISTINCT x) FROM unnest(p_lab_order) x) <> cardinality(p_lab_order)
     OR EXISTS (SELECT 1 FROM unnest(p_lab_order) x WHERE x NOT IN ('Immersive Labs', 'TryHackMe Pre-Security', 'TryHackMe Cyber 101')) THEN
    RAISE EXCEPTION 'Lab order can only list the three lab items, once each.';
  END IF;
  IF p_cert_starts IS NULL OR jsonb_typeof(p_cert_starts) <> 'object' THEN
    RAISE EXCEPTION 'Certificate weeks are missing.';
  END IF;
  FOR v_key, v_val IN SELECT key, value FROM jsonb_each(p_cert_starts) LOOP
    IF v_key NOT IN ('AZ-900', 'SC-900') OR jsonb_typeof(v_val) <> 'number'
       OR (v_val #>> '{}')::numeric <> floor((v_val #>> '{}')::numeric)
       OR (v_val #>> '{}')::int NOT BETWEEN 1 AND 104 THEN
      RAISE EXCEPTION 'Certificate sprints must be AZ-900 or SC-900, at a week between 1 and 104.';
    END IF;
  END LOOP;

  UPDATE public.member_pathways
  SET lab_order = p_lab_order, cert_starts = p_cert_starts, weekly_hours = p_weekly_hours, updated_at = now()
  WHERE member_email = v_email;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Open your pathway once before saving changes.';
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.save_my_pathway(TEXT[], JSONB, INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.save_my_pathway(TEXT[], JSONB, INTEGER) FROM PUBLIC, anon;

-- "I've booked my checkpoint 1-on-1." Only accepted once the member has
-- actually reached that checkpoint. Recorded as self-declared so staff can
-- see it and follow up if no real meeting appears.
CREATE OR REPLACE FUNCTION public.book_my_pathway_checkpoint(p_checkpoint INTEGER)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_today DATE := (now() AT TIME ZONE 'Africa/Johannesburg')::date;
  v_out JSONB;
BEGIN
  IF v_email IS NULL OR NOT public.is_member_allowed(v_email) THEN
    RAISE EXCEPTION 'Not an approved member.';
  END IF;
  IF p_checkpoint IS NULL OR p_checkpoint NOT IN (2, 4, 5) THEN
    RAISE EXCEPTION 'Unknown checkpoint.';
  END IF;
  IF public._core_foundations_done(v_email) < p_checkpoint THEN
    RAISE EXCEPTION 'You have not reached this checkpoint yet.';
  END IF;

  UPDATE public.member_pathways
  SET checkpoints = CASE
        WHEN checkpoints ? p_checkpoint::text THEN checkpoints
        ELSE checkpoints || jsonb_build_object(p_checkpoint::text, jsonb_build_object('how', 'booked', 'on', v_today))
      END,
      updated_at = now()
  WHERE member_email = v_email
  RETURNING checkpoints INTO v_out;
  IF v_out IS NULL THEN
    RAISE EXCEPTION 'Open your pathway once before booking a checkpoint.';
  END IF;
  RETURN v_out;
END;
$$;
GRANT EXECUTE ON FUNCTION public.book_my_pathway_checkpoint(INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.book_my_pathway_checkpoint(INTEGER) FROM PUBLIC, anon;
