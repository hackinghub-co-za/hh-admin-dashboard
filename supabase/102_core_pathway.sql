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

-- The same lane view for the member's Specialization track. One entry per
-- track the member has been on, keyed by track name:
--   {"SOC": {"started_on": "2026-11-02", "weekly_hours": 6,
--            "lab_order": ["THM SOC Level 1"], "cert_starts": {"CySA+": 4}}}
-- Specialization has no required checkpoint meetings; Projects still
-- unlocks off the existing percentage rule.
ALTER TABLE public.member_pathways ADD COLUMN IF NOT EXISTS track_prefs JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.member_pathways DROP CONSTRAINT IF EXISTS member_pathways_track_prefs_check;
ALTER TABLE public.member_pathways ADD CONSTRAINT member_pathways_track_prefs_check CHECK (jsonb_typeof(track_prefs) = 'object');

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
  v_track TEXT;
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

  -- Start the clock on the member's current Specialization track the first
  -- time they open it, so "week N" on that track keeps advancing.
  SELECT roadmap_track INTO v_track FROM public.member_profiles WHERE email = v_email;
  IF v_track IS NOT NULL AND v_track <> 'Not Assigned' AND NOT (v_row.track_prefs ? v_track) THEN
    UPDATE public.member_pathways
    SET track_prefs = track_prefs || jsonb_build_object(v_track, jsonb_build_object('started_on', v_today, 'weekly_hours', 6, 'lab_order', '[]'::jsonb, 'cert_starts', '{}'::jsonb)),
        updated_at = now()
    WHERE member_email = v_email;
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
    'meeting_dates', v_dates,
    'track', v_track,
    'track_prefs', v_row.track_prefs
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

-- Saves the lane arrangement for the member's CURRENT Specialization track.
-- Only shape is checked here; which titles belong to a track is the
-- client's catalog (SPECIALIZATION_CATALOGS), and this data only ever
-- affects the member's own view.
CREATE OR REPLACE FUNCTION public.save_my_track_pathway(p_track TEXT, p_lab_order TEXT[], p_cert_starts JSONB, p_weekly_hours INTEGER)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_current TEXT;
  v_key TEXT;
  v_val JSONB;
  v_started TEXT;
BEGIN
  IF v_email IS NULL OR NOT public.is_member_allowed(v_email) THEN
    RAISE EXCEPTION 'Not an approved member.';
  END IF;
  SELECT roadmap_track INTO v_current FROM public.member_profiles WHERE email = v_email;
  IF p_track IS NULL OR p_track = 'Not Assigned' OR p_track IS DISTINCT FROM v_current THEN
    RAISE EXCEPTION 'That is not your current track.';
  END IF;
  IF p_weekly_hours IS NULL OR p_weekly_hours NOT IN (3, 4, 6, 8, 10, 12) THEN
    RAISE EXCEPTION 'Weekly hours must be 3, 4, 6, 8, 10 or 12.';
  END IF;
  IF p_lab_order IS NULL OR cardinality(p_lab_order) > 15
     OR EXISTS (SELECT 1 FROM unnest(p_lab_order) x WHERE x IS NULL OR length(x) > 100)
     OR (SELECT count(DISTINCT x) FROM unnest(p_lab_order) x) <> cardinality(p_lab_order) THEN
    RAISE EXCEPTION 'Lab order is not valid.';
  END IF;
  IF p_cert_starts IS NULL OR jsonb_typeof(p_cert_starts) <> 'object' OR (SELECT count(*) FROM jsonb_object_keys(p_cert_starts)) > 20 THEN
    RAISE EXCEPTION 'Certificate weeks are not valid.';
  END IF;
  FOR v_key, v_val IN SELECT key, value FROM jsonb_each(p_cert_starts) LOOP
    IF length(v_key) > 100 OR jsonb_typeof(v_val) <> 'number'
       OR (v_val #>> '{}')::numeric <> floor((v_val #>> '{}')::numeric)
       OR (v_val #>> '{}')::int NOT BETWEEN 1 AND 260 THEN
      RAISE EXCEPTION 'Certificate sprints must start at a whole week between 1 and 260.';
    END IF;
  END LOOP;

  SELECT track_prefs -> p_track ->> 'started_on' INTO v_started FROM public.member_pathways WHERE member_email = v_email;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Open your roadmap once before saving changes.';
  END IF;

  UPDATE public.member_pathways
  SET track_prefs = track_prefs || jsonb_build_object(p_track, jsonb_build_object(
        'started_on', COALESCE(v_started, ((now() AT TIME ZONE 'Africa/Johannesburg')::date)::text),
        'weekly_hours', p_weekly_hours,
        'lab_order', to_jsonb(p_lab_order),
        'cert_starts', p_cert_starts)),
      updated_at = now()
  WHERE member_email = v_email;
END;
$$;
GRANT EXECUTE ON FUNCTION public.save_my_track_pathway(TEXT, TEXT[], JSONB, INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.save_my_track_pathway(TEXT, TEXT[], JSONB, INTEGER) FROM PUBLIC, anon;

-- The checkpoint (2, 4 or 5 items) the member is currently stopped at, or
-- NULL if none - a server-side mirror of activeCheckpoint()/
-- checkpointReachedDates() in src/lib/pathway.js. Needed because
-- toggle_my_roadmap_item() (028_roadmap.sql) is a public RPC a member can
-- call directly (devtools, a raw fetch with their own JWT, an old cached
-- client) - the "lock new ticks until booked or a real session is logged"
-- rule this file's header comment promises was, until now, enforced only
-- by RoadmapPathway.jsx/MemberPortal.jsx disabling the tick button, which
-- is a UI nicety, not a lock. Mirrors the client's two clear-paths exactly:
-- a self-declared "booked" (or "prior") entry in checkpoints, or a real
-- 1-on-1/synced meeting dated on or after the day the checkpoint count was
-- actually reached.
CREATE OR REPLACE FUNCTION public._core_pathway_active_checkpoint(p_email TEXT)
RETURNS INTEGER
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_done INTEGER;
  v_checkpoints JSONB;
  v_meeting_dates DATE[];
  v_completed_dates DATE[];
  v_cp INTEGER;
  v_reached DATE;
BEGIN
  v_done := public._core_foundations_done(p_email);

  SELECT checkpoints INTO v_checkpoints FROM public.member_pathways WHERE member_email = p_email;
  v_checkpoints := COALESCE(v_checkpoints, '{}'::jsonb);

  SELECT array_agg(d ORDER BY d) INTO v_meeting_dates FROM (
    SELECT session_date AS d FROM public.one_on_one_logs WHERE member_email = p_email
    UNION SELECT meeting_date FROM public.calendar_synced_meetings WHERE member_email = p_email
  ) x;

  -- Same catalog/ordering basis as checkpointReachedDates() client-side:
  -- the Nth completed item (by completed_at) is "when checkpoint N was
  -- reached" - array index 1 = the 1st done, 2 = the 2nd, etc.
  SELECT array_agg(completed_at::date ORDER BY completed_at) INTO v_completed_dates
  FROM public.roadmap_items
  WHERE member_email = p_email AND phase = 'Core Foundations' AND completed
    AND title IN ('CISCO Junior Cyber Pathway', 'Immersive Labs', 'TryHackMe Pre-Security', 'TryHackMe Cyber 101',
                  'AZ-900', 'AI-901', 'SC-900', 'CompTIA Security+');

  FOREACH v_cp IN ARRAY ARRAY[2, 4, 5] LOOP
    IF v_done < v_cp THEN RETURN NULL; END IF;
    IF v_checkpoints ? v_cp::text THEN CONTINUE; END IF;
    v_reached := v_completed_dates[v_cp];
    IF v_reached IS NOT NULL AND v_meeting_dates IS NOT NULL
       AND EXISTS (SELECT 1 FROM unnest(v_meeting_dates) d WHERE d >= v_reached) THEN
      CONTINUE;
    END IF;
    RETURN v_cp;
  END LOOP;
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION public._core_pathway_active_checkpoint(TEXT) FROM PUBLIC, anon, authenticated;

-- Re-defines toggle_my_roadmap_item() (028_roadmap.sql) to add the
-- checkpoint lock above on top of its existing Projects-phase guard. Only
-- ever blocks a false -> true transition on one of the 8 Core Foundations
-- catalog items; un-ticking, every other phase, and an already-completed
-- item (no-op re-saves from the admin's own direct table edit elsewhere)
-- are all untouched.
CREATE OR REPLACE FUNCTION public.toggle_my_roadmap_item(p_item_id BIGINT, p_completed BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_phase TEXT;
  v_title TEXT;
  v_was_completed BOOLEAN;
BEGIN
  SELECT phase, title, completed INTO v_phase, v_title, v_was_completed FROM public.roadmap_items
  WHERE id = p_item_id AND member_email = v_email;

  IF v_phase = 'Projects' THEN
    RAISE EXCEPTION 'Projects are marked done by an admin, after you submit proof - see submit_my_project_proof().';
  END IF;

  IF p_completed AND NOT v_was_completed AND v_phase = 'Core Foundations'
     AND v_title IN ('CISCO Junior Cyber Pathway', 'Immersive Labs', 'TryHackMe Pre-Security', 'TryHackMe Cyber 101',
                     'AZ-900', 'AI-901', 'SC-900', 'CompTIA Security+')
     AND public._core_pathway_active_checkpoint(v_email) IS NOT NULL THEN
    RAISE EXCEPTION 'Book your checkpoint 1-on-1 before ticking off more Core Foundations items.';
  END IF;

  UPDATE public.roadmap_items
  SET completed = p_completed, updated_at = timezone('utc'::text, now())
  WHERE id = p_item_id AND member_email = v_email;
END;
$$;
GRANT EXECUTE ON FUNCTION public.toggle_my_roadmap_item(BIGINT, BOOLEAN) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.toggle_my_roadmap_item(BIGINT, BOOLEAN) FROM PUBLIC, anon;
