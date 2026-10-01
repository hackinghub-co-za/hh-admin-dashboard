-- Hacking Hub Admin Dashboard - Accountability Check-ins
-- Run this in the Supabase SQL Editor after 002-090 have already been
-- applied. Safe to re-run: every statement is idempotent.
--
-- A staff-curated list of members who need closer attention, plus a dated,
-- attributed log of every personal check-in (what they said they're working
-- on). Unlike Focus 5 there's no cap, and unlike Focus 5's daily update the
-- notes are written BY staff ABOUT a member, never by the member - members
-- have no access to any of this.
--
-- Open to admins and community managers alike (is_community_manager() is
-- already true for admins - see 067_permission_scopes.sql).
--
-- The daily email to the community manager(s) is sent by the
-- accountability-digest edge function; its cron is in
-- 092_accountability_digest_cron.sql.

-- Who's currently on the list. Removing someone deletes this row only -
-- their check-in history below stays on record.
CREATE TABLE IF NOT EXISTS public.accountability_list (
  member_email TEXT PRIMARY KEY,
  added_by TEXT NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Every check-in note, kept forever. logged_by/logged_by_name are
-- client-supplied, same trust level as one_on_one_logs.logged_by
-- (071_overdue_1on1_digest.sql) - an internal staff action, not a security
-- boundary; RLS already limits writes to staff.
CREATE TABLE IF NOT EXISTS public.accountability_checkins (
  id BIGSERIAL PRIMARY KEY,
  member_email TEXT NOT NULL,
  note TEXT NOT NULL CHECK (length(trim(note)) > 0),
  logged_by TEXT NOT NULL,
  logged_by_name TEXT,
  logged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS accountability_checkins_member_idx
  ON public.accountability_checkins (member_email, logged_at DESC);

-- Single-row settings - just the daily email on/off switch for now.
CREATE TABLE IF NOT EXISTS public.accountability_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  email_enabled BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO public.accountability_settings (id, email_enabled)
VALUES (1, true)
ON CONFLICT (id) DO NOTHING;

-- Who the daily email goes to. NULL/empty = every community manager (see
-- get_accountability_digest_recipients() below); set = exactly these.
-- The actual addresses are set directly in the live database, never here -
-- this repo is public, and the pre-commit PII check rejects real member
-- emails in tracked files. Clear it back to NULL to widen to every
-- community manager again.
ALTER TABLE public.accountability_settings ADD COLUMN IF NOT EXISTS recipient_emails TEXT[];

-- New joiners: every member is automatically on the list for their first
-- NEW_JOINER_DAYS (21) days, assigned to this staff member, then comes off
-- again by itself (sync_new_joiner_accountability() below). Like
-- recipient_emails, the actual address is set in the live database only.
ALTER TABLE public.accountability_settings ADD COLUMN IF NOT EXISTS new_joiner_assignee TEXT;

-- Who a list entry belongs to (NULL = shared, nobody in particular) and how
-- it got there - 'new_joiner' rows are the only ones the sync ever removes,
-- so a member staff added by hand is never taken off automatically.
ALTER TABLE public.accountability_list ADD COLUMN IF NOT EXISTS assigned_to TEXT;
ALTER TABLE public.accountability_list ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual';
ALTER TABLE public.accountability_list DROP CONSTRAINT IF EXISTS accountability_list_source_check;
ALTER TABLE public.accountability_list ADD CONSTRAINT accountability_list_source_check CHECK (source IN ('manual', 'new_joiner'));

ALTER TABLE public.accountability_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accountability_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accountability_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff manage accountability list" ON public.accountability_list;
CREATE POLICY "staff manage accountability list"
  ON public.accountability_list FOR ALL
  USING (public.is_community_manager(auth.uid()))
  WITH CHECK (public.is_community_manager(auth.uid()));

DROP POLICY IF EXISTS "staff manage accountability checkins" ON public.accountability_checkins;
CREATE POLICY "staff manage accountability checkins"
  ON public.accountability_checkins FOR ALL
  USING (public.is_community_manager(auth.uid()))
  WITH CHECK (public.is_community_manager(auth.uid()));

DROP POLICY IF EXISTS "staff manage accountability settings" ON public.accountability_settings;
CREATE POLICY "staff manage accountability settings"
  ON public.accountability_settings FOR ALL
  USING (public.is_community_manager(auth.uid()))
  WITH CHECK (public.is_community_manager(auth.uid()));

-- Who to pick from and how to label them. A community manager can't read
-- member_profiles directly (it holds money_owed/phone/age, and has no
-- column-level RLS - see 067's header), so this is the dedicated column
-- whitelist that header says was missing: name, track and photo only.
CREATE OR REPLACE FUNCTION public.get_accountability_roster()
RETURNS TABLE (email TEXT, full_name TEXT, specialty TEXT, roadmap_track TEXT, headshot_url TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE
AS $$
BEGIN
  IF NOT public.is_community_manager(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins and community managers can view this.';
  END IF;
  RETURN QUERY
  SELECT mp.email, mp.full_name, mp.specialty, mp.roadmap_track, mp.headshot_url
  FROM public.member_profiles mp
  WHERE mp.status != 'Left'
  ORDER BY lower(coalesce(mp.full_name, mp.email));
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_accountability_roster() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_accountability_roster() FROM PUBLIC, anon;

-- Everyone on the list who's due: never checked in on, or not within the
-- last p_days (SAST calendar days). Shared by the admin tab's "Due Today"
-- and the daily email, so the two can never disagree. Callable by staff,
-- or by the edge function via the service role (auth.uid() is NULL there).
DROP FUNCTION IF EXISTS public.get_accountability_due(INTEGER);
CREATE FUNCTION public.get_accountability_due(p_days INTEGER DEFAULT 7)
RETURNS TABLE (email TEXT, full_name TEXT, specialty TEXT, last_checkin_at TIMESTAMP WITH TIME ZONE, assigned_to TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE
AS $$
BEGIN
  IF auth.role() = 'authenticated' AND NOT public.is_community_manager(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins and community managers can view this.';
  END IF;
  RETURN QUERY
  SELECT
    al.member_email,
    mp.full_name,
    mp.specialty,
    MAX(ac.logged_at) AS last_checkin_at,
    al.assigned_to
  FROM public.accountability_list al
  LEFT JOIN public.member_profiles mp ON mp.email = al.member_email
  LEFT JOIN public.accountability_checkins ac ON ac.member_email = al.member_email
  GROUP BY al.member_email, mp.full_name, mp.specialty, al.assigned_to
  HAVING MAX(ac.logged_at) IS NULL
      OR (MAX(ac.logged_at) AT TIME ZONE 'Africa/Johannesburg')::date
         <= (now() AT TIME ZONE 'Africa/Johannesburg')::date - p_days
  ORDER BY MAX(ac.logged_at) ASC NULLS FIRST;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_accountability_due(INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_accountability_due(INTEGER) FROM PUBLIC, anon;

-- Who the daily email goes to: accountability_settings.recipient_emails if
-- set, otherwise every community manager. Falls back to the founder if
-- nobody holds that role yet, so the email always lands somewhere real
-- rather than silently going nowhere.
CREATE OR REPLACE FUNCTION public.get_accountability_digest_recipients()
RETURNS TABLE (email TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE
AS $$
BEGIN
  IF auth.role() = 'authenticated' AND NOT public.is_community_manager(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins and community managers can view this.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.accountability_settings s WHERE s.id = 1 AND cardinality(s.recipient_emails) > 0) THEN
    RETURN QUERY
    SELECT DISTINCT lower(r) FROM public.accountability_settings s, unnest(s.recipient_emails) AS r WHERE s.id = 1;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT lower(p.email) FROM public.profiles p WHERE p.role = 'community_manager' AND p.email IS NOT NULL
  UNION
  SELECT 'siya@hackinghub.co.za'
  -- p2-qualified on purpose: a bare "email" here is ambiguous with this
  -- function's own RETURNS TABLE (email) column and errors at runtime.
  WHERE NOT EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.role = 'community_manager' AND p2.email IS NOT NULL);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_accountability_digest_recipients() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_accountability_digest_recipients() FROM PUBLIC, anon;

-- Keeps the new-joiner entries in step with join dates: adds every member
-- who joined within the last 21 SAST days (and hasn't left), assigned to
-- accountability_settings.new_joiner_assignee, and removes new-joiner
-- entries whose 21 days are up. Join date is the same rule the member
-- portal uses: COALESCE(manual_start_date, onboarded_at).
--
-- Never touches 'manual' rows, and a member staff already added by hand
-- stays exactly as they were (ON CONFLICT DO NOTHING). Run by the daily
-- digest function and whenever the admin tab loads, so the list is never
-- more than a page-load stale. Returns how many rows it added/removed.
CREATE OR REPLACE FUNCTION public.sync_new_joiner_accountability(p_days INTEGER DEFAULT 21)
RETURNS TABLE (added INTEGER, removed INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_today DATE := (now() AT TIME ZONE 'Africa/Johannesburg')::date;
  v_assignee TEXT;
  v_added INTEGER;
  v_removed INTEGER;
BEGIN
  IF auth.role() = 'authenticated' AND NOT public.is_community_manager(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins and community managers can do this.';
  END IF;

  SELECT lower(s.new_joiner_assignee) INTO v_assignee FROM public.accountability_settings s WHERE s.id = 1;

  INSERT INTO public.accountability_list (member_email, added_by, assigned_to, source)
  SELECT lower(mp.email), 'auto: new joiner', v_assignee, 'new_joiner'
  FROM public.member_profiles mp
  WHERE mp.status != 'Left'
    AND lower(mp.email) != 'siya@hackinghub.co.za'
    AND COALESCE(mp.manual_start_date, mp.onboarded_at::date) >= v_today - p_days
  ON CONFLICT (member_email) DO NOTHING;
  GET DIAGNOSTICS v_added = ROW_COUNT;

  DELETE FROM public.accountability_list al
  WHERE al.source = 'new_joiner'
    AND NOT EXISTS (
      SELECT 1 FROM public.member_profiles mp
      WHERE lower(mp.email) = al.member_email
        AND mp.status != 'Left'
        AND COALESCE(mp.manual_start_date, mp.onboarded_at::date) >= v_today - p_days
    );
  GET DIAGNOSTICS v_removed = ROW_COUNT;

  RETURN QUERY SELECT v_added, v_removed;
END;
$$;
GRANT EXECUTE ON FUNCTION public.sync_new_joiner_accountability(INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_new_joiner_accountability(INTEGER) FROM PUBLIC, anon;
