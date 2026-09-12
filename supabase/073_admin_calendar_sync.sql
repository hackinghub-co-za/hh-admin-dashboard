-- Hacking Hub Admin Dashboard - Automated Calendar Sync for Last 1-on-1 Dates
-- Run this in the Supabase SQL Editor after 002-072 have already been
-- applied. Safe to re-run: every statement is idempotent.
--
-- The Members tab's "Sync Last 1on1 Dates" button (handleSyncLastMeetings,
-- AdminDashboard.jsx) only ever works while whoever clicks it is signed in -
-- it reads their live browser session's short-lived Google access token.
-- That's fine for an on-demand refresh, but it can't run unattended on a
-- schedule: there's nothing durable to authenticate with once the browser
-- tab is closed. This file adds that durable piece, following the exact
-- precedent already in this codebase for the same problem
-- (google_oauth_tokens, 048_push_notifications.sql PART 3) - a staff
-- member's Google refresh token, encrypted at rest, so a cron-triggered
-- Edge Function can mint a fresh access token on its own each morning.
--
-- Deliberately a separate table from 048's google_oauth_tokens rather than
-- reusing it: that table is hh-app's (the member mobile app) own
-- member-consent store for a completely different feature (a "starting
-- soon" push nudge, member-initiated). This one is staff-only and
-- admin-dashboard-initiated. Same encryption approach, same "zero RLS
-- policies, service-role only" posture, different table so the two
-- features can evolve independently.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================================
-- PART 1: REFRESH TOKEN STORAGE - one row per staff member who has granted
-- calendar consent for this feature. The encryption key
-- (GOOGLE_TOKEN_ENCRYPTION_KEY) lives only as a Supabase Edge Function
-- secret, never in this database - a leaked backup or misconfigured policy
-- alone can't decrypt anything here. No RLS policy grants access to
-- anyone, including the owning staff member - only the service role
-- (bypasses RLS) ever reads or writes this table, and only from
-- store-calendar-sync-token and sync-last-1on1-dates.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.calendar_sync_tokens (
  email TEXT PRIMARY KEY,
  refresh_token_encrypted BYTEA NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.calendar_sync_tokens ENABLE ROW LEVEL SECURITY;
-- Intentionally zero policies - see the comment above.

-- Lets the admin dashboard check whether the signed-in staff member still
-- needs to go through the one-time consent flow, without exposing anything
-- about the stored token itself.
CREATE OR REPLACE FUNCTION public.has_stored_calendar_sync_token()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.calendar_sync_tokens WHERE email = lower(auth.jwt() ->> 'email')
  );
$$;
GRANT EXECUTE ON FUNCTION public.has_stored_calendar_sync_token() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.has_stored_calendar_sync_token() FROM PUBLIC, anon;

-- The only two functions that ever see a refresh token or the encryption
-- key in plaintext, both taking the key as a caller-supplied parameter -
-- same "the key itself is never stored anywhere in this schema" principle
-- as 048's equivalent pair. Locked to service_role only (actively revoked
-- from authenticated, not just left ungranted) since these accept a raw
-- plaintext secret as a SQL parameter.
-- pgp_sym_encrypt/pgp_sym_decrypt live in the "extensions" schema on
-- Supabase (not public), so both calls below are schema-qualified rather
-- than widening SET search_path beyond the "public only" convention every
-- other SECURITY DEFINER function in this codebase deliberately uses.
CREATE OR REPLACE FUNCTION public._store_encrypted_calendar_sync_token(p_email TEXT, p_refresh_token TEXT, p_key TEXT)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  INSERT INTO public.calendar_sync_tokens (email, refresh_token_encrypted, updated_at)
  VALUES (lower(p_email), extensions.pgp_sym_encrypt(p_refresh_token, p_key), timezone('utc'::text, now()))
  ON CONFLICT (email) DO UPDATE SET
    refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
    updated_at = timezone('utc'::text, now());
$$;
REVOKE EXECUTE ON FUNCTION public._store_encrypted_calendar_sync_token(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._get_all_decrypted_calendar_sync_tokens(p_key TEXT)
RETURNS TABLE (email TEXT, refresh_token TEXT)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT email, extensions.pgp_sym_decrypt(refresh_token_encrypted, p_key)
  FROM public.calendar_sync_tokens;
$$;
REVOKE EXECUTE ON FUNCTION public._get_all_decrypted_calendar_sync_tokens(TEXT) FROM PUBLIC, anon, authenticated;

-- =========================================================================
-- PART 2: SYNCED MEETING DATES - the persisted result of the daily sync,
-- so the digest and the admin UI both have somewhere to read "last
-- meeting, per calendar" from without anyone needing to be signed in.
-- Every sync run replaces the table's contents wholesale (same semantics
-- as the manual button: a fresh full re-read of the window, not an
-- incremental append) - a rescheduled or cancelled recurring event
-- shouldn't leave stale rows behind.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.calendar_synced_meetings (
  member_email TEXT NOT NULL,
  meeting_date DATE NOT NULL,
  synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (member_email, meeting_date)
);

ALTER TABLE public.calendar_synced_meetings ENABLE ROW LEVEL SECURITY;

-- Staff can read the whole table directly (same pattern as one_on_one_logs'
-- "staff manage" policy covering an unfiltered SELECT) - no RPC needed for
-- the admin dashboard to merge this in alongside the manual logs and the
-- on-demand sync. Only the sync function (service role, bypasses RLS)
-- ever writes.
DROP POLICY IF EXISTS "staff read calendar synced meetings" ON public.calendar_synced_meetings;
CREATE POLICY "staff read calendar synced meetings"
  ON public.calendar_synced_meetings FOR SELECT
  USING (public.is_admin(auth.uid()) OR public.is_mentor(auth.uid()));

-- Atomic wholesale replace, so staff reading mid-sync never see a
-- momentarily-empty table. p_rows is a JSON array of
-- {"member_email": ..., "meeting_date": "YYYY-MM-DD"} objects built by the
-- sync-last-1on1-dates Edge Function.
CREATE OR REPLACE FUNCTION public._replace_calendar_synced_meetings(p_rows JSONB)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  DELETE FROM public.calendar_synced_meetings;
  INSERT INTO public.calendar_synced_meetings (member_email, meeting_date)
  SELECT DISTINCT lower(r->>'member_email'), (r->>'meeting_date')::date
  FROM jsonb_array_elements(p_rows) r
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE EXECUTE ON FUNCTION public._replace_calendar_synced_meetings(JSONB) FROM PUBLIC, anon, authenticated;

-- =========================================================================
-- PART 3: FOLD INTO THE DIGEST - get_members_overdue_for_1on1 (071) only
-- ever read one_on_one_logs (manual entries). Without this, automating the
-- calendar sync would update the admin UI but leave the digest just as
-- blind to real, un-logged sessions as before. Same GREATEST-of-both-
-- sources merge already used client-side in AdminDashboard.jsx for the
-- Member Sheet / Members tab / Insights.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.get_members_overdue_for_1on1(p_days INTEGER DEFAULT 30)
RETURNS TABLE (email TEXT, full_name TEXT, last_1on1_at TIMESTAMP WITH TIME ZONE)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated' AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can view this.';
  END IF;

  RETURN QUERY
  SELECT
    mp.email,
    mp.full_name,
    GREATEST(MAX(l.session_date), MAX(c.meeting_date))::TIMESTAMP WITH TIME ZONE AS last_1on1_at
  FROM public.member_profiles mp
  LEFT JOIN public.one_on_one_logs l ON l.member_email = mp.email
  LEFT JOIN public.calendar_synced_meetings c ON c.member_email = mp.email
  WHERE mp.status IN ('Active', 'Active (Permanent)')
    -- The founder's own member_profiles row (if one exists) isn't a real
    -- coaching relationship to flag back to themselves.
    AND mp.email != 'siya@hackinghub.co.za'
  GROUP BY mp.email, mp.full_name
  HAVING GREATEST(MAX(l.session_date), MAX(c.meeting_date)) IS NULL
      OR GREATEST(MAX(l.session_date), MAX(c.meeting_date)) < (timezone('utc'::text, now())::date - p_days)
  ORDER BY last_1on1_at ASC NULLS FIRST;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_members_overdue_for_1on1(INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_members_overdue_for_1on1(INTEGER) FROM PUBLIC, anon;
