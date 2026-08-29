-- Hacking Hub Admin Dashboard - Push Notifications (hh-app)
-- Run this in the Supabase SQL Editor after 002-047 have already been
-- applied. Safe to re-run: every statement is idempotent.
--
-- Backend for hh-app's three push notifications (its own Punch List item
-- #07): a streak about to lapse, a new Job Board post, and a 1-on-1
-- starting in 30 minutes. This file only adds the schema/RPCs - the actual
-- sending happens in three new Edge Functions (push-streak-alert,
-- push-new-job, push-1on1-reminder) and needs a real Firebase project
-- (FCM_SERVICE_ACCOUNT secret) that only you can create - see each
-- function's own header comment.

-- =========================================================================
-- PART 1: DEVICE TOKENS - one row per signed-in device, keyed by its FCM
-- token. A token belongs to whichever member most recently registered it
-- (ON CONFLICT reassigns it) - correct behavior for a shared/reused device,
-- and unregister_my_push_token() removes it entirely on sign-out so a
-- reused device doesn't keep receiving the previous member's pushes.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.push_tokens (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios', 'web')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

-- A member can read/manage only their own token rows directly - not that
-- the client needs to read them, this just keeps the policy symmetrical.
-- The sending Edge Functions use the service role, which bypasses RLS
-- entirely, to read every member's tokens.
DROP POLICY IF EXISTS "members manage own push tokens" ON public.push_tokens;
CREATE POLICY "members manage own push tokens"
  ON public.push_tokens FOR ALL
  USING (email = lower(auth.jwt() ->> 'email'))
  WITH CHECK (email = lower(auth.jwt() ->> 'email'));

CREATE OR REPLACE FUNCTION public.register_my_push_token(p_token TEXT, p_platform TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.push_tokens (email, token, platform)
  VALUES (lower(auth.jwt() ->> 'email'), p_token, p_platform)
  ON CONFLICT (token) DO UPDATE SET
    email = EXCLUDED.email,
    platform = EXCLUDED.platform,
    updated_at = timezone('utc'::text, now());
END;
$$;
GRANT EXECUTE ON FUNCTION public.register_my_push_token(TEXT, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.register_my_push_token(TEXT, TEXT) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.unregister_my_push_token(p_token TEXT)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  DELETE FROM public.push_tokens WHERE token = p_token AND email = lower(auth.jwt() ->> 'email');
$$;
GRANT EXECUTE ON FUNCTION public.unregister_my_push_token(TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.unregister_my_push_token(TEXT) FROM PUBLIC, anon;

-- =========================================================================
-- PART 2: STREAK-LAPSE DEDUP - once-per-day guard on top of the existing
-- login_streak / last_login_date columns (032_login_streak.sql). A member
-- is "about to lapse" once last_login_date is exactly yesterday and it's
-- late enough in the day to be worth a nudge - push-streak-alert decides
-- the exact cutoff time, this column just stops it firing twice the same
-- evening if the cron somehow runs more than once.
-- =========================================================================

ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS last_streak_push_date DATE;

-- Members whose streak is about to lapse tonight - logged in yesterday,
-- not yet today, with at least a 2-day streak worth protecting (a lapsing
-- streak of 1 isn't worth a push), not already pushed today, and with at
-- least one registered device. Admin-or-service-role guarded, same
-- pattern as mark_roadmap_disengagement_alert_sent() in 028_roadmap.sql -
-- the service role (push-streak-alert) has no 'authenticated' JWT role so
-- bypasses this check entirely; blocks ordinary members from calling it
-- directly.
CREATE OR REPLACE FUNCTION public.get_members_with_lapsing_streak()
RETURNS TABLE (email TEXT, full_name TEXT, login_streak INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated' AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can do this.';
  END IF;

  RETURN QUERY
  SELECT mp.email, mp.full_name, mp.login_streak
  FROM public.member_profiles mp
  WHERE mp.last_login_date = CURRENT_DATE - 1
    AND mp.login_streak >= 2
    AND (mp.last_streak_push_date IS NULL OR mp.last_streak_push_date < CURRENT_DATE)
    AND mp.status != 'Left'
    AND EXISTS (SELECT 1 FROM public.push_tokens pt WHERE pt.email = mp.email);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_members_with_lapsing_streak() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_members_with_lapsing_streak() FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.mark_streak_push_sent(p_email TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated' AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can do this.';
  END IF;
  UPDATE public.member_profiles SET last_streak_push_date = CURRENT_DATE WHERE email = lower(p_email);
END;
$$;
GRANT EXECUTE ON FUNCTION public.mark_streak_push_sent(TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_streak_push_sent(TEXT) FROM PUBLIC, anon;

-- Every push token for a set of members, for the sending Edge Functions -
-- same admin-or-service-role guard as above.
CREATE OR REPLACE FUNCTION public.get_push_tokens_for_emails(p_emails TEXT[])
RETURNS TABLE (email TEXT, token TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated' AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can do this.';
  END IF;

  RETURN QUERY
  SELECT pt.email, pt.token FROM public.push_tokens pt
  WHERE pt.email = ANY (SELECT lower(unnest(p_emails)));
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_push_tokens_for_emails(TEXT[]) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_push_tokens_for_emails(TEXT[]) FROM PUBLIC, anon;

-- Every push token for every currently-registered device - used by
-- push-new-job, which (for now, see its own header comment) notifies
-- every member rather than trying to match a listing's tags against a
-- member's track.
CREATE OR REPLACE FUNCTION public.get_all_push_tokens()
RETURNS TABLE (email TEXT, token TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated' AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can do this.';
  END IF;
  RETURN QUERY SELECT pt.email, pt.token FROM public.push_tokens pt;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_all_push_tokens() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_all_push_tokens() FROM PUBLIC, anon;

-- =========================================================================
-- PART 3: GOOGLE REFRESH TOKENS - encrypted at rest, for the 1-on-1
-- reminder push. This is real scope expansion the codebase deliberately
-- avoided until now (see the "no prompt: 'consent'" comment in
-- src/views/Login.jsx) - the whole point of this table's existence is a
-- scheduled job that can read a member's calendar with nobody signed in.
--
-- The encryption key (GOOGLE_TOKEN_ENCRYPTION_KEY) lives ONLY as a
-- Supabase secret, never written into this database in any form - so a
-- database-only compromise (a leaked backup, a misconfigured policy)
-- doesn't hand over usable Google credentials on its own, the same
-- "secret never touches the DB" principle already used for
-- ROADMAP_REMINDER's CRON_SECRET. No RLS policy grants access to anyone,
-- including the owning member - there's no legitimate client-side reason
-- to ever decrypt a refresh token outside a trusted Edge Function. Only
-- the service role (which bypasses RLS) ever touches this table, and only
-- from store-google-refresh-token and push-1on1-reminder.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.google_oauth_tokens (
  email TEXT PRIMARY KEY,
  refresh_token_encrypted BYTEA NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.google_oauth_tokens ENABLE ROW LEVEL SECURITY;
-- Intentionally zero policies - see the comment above.

-- Lets a member check whether a refresh token is already on file, without
-- exposing anything about it, so hh-app only has to force Google's full
-- consent screen (prompt=consent, the only way Google reliably reissues a
-- refresh token) the one time it's actually needed instead of on every
-- sign-in.
CREATE OR REPLACE FUNCTION public.has_stored_google_refresh_token()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.google_oauth_tokens WHERE email = lower(auth.jwt() ->> 'email')
  );
$$;
GRANT EXECUTE ON FUNCTION public.has_stored_google_refresh_token() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.has_stored_google_refresh_token() FROM PUBLIC, anon;

-- The only two functions that ever see a refresh token or the encryption
-- key in plaintext, and both take the key as a caller-supplied parameter
-- rather than reading it from anywhere inside the database - there is
-- nowhere in this schema the key itself is ever stored. Explicitly locked
-- to service_role only (not just "not granted to authenticated" - actively
-- revoked from it too) since these accept a raw plaintext secret as a SQL
-- parameter, the most sensitive functions in this file by far. Only ever
-- called by store-google-refresh-token and push-1on1-reminder, both using
-- the service-role client, never a member's own JWT-authenticated one.
CREATE OR REPLACE FUNCTION public._store_encrypted_google_token(p_email TEXT, p_refresh_token TEXT, p_key TEXT)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  INSERT INTO public.google_oauth_tokens (email, refresh_token_encrypted, updated_at)
  VALUES (lower(p_email), pgp_sym_encrypt(p_refresh_token, p_key), timezone('utc'::text, now()))
  ON CONFLICT (email) DO UPDATE SET
    refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
    updated_at = timezone('utc'::text, now());
$$;
REVOKE EXECUTE ON FUNCTION public._store_encrypted_google_token(TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._get_all_decrypted_google_tokens(p_key TEXT)
RETURNS TABLE (email TEXT, refresh_token TEXT)
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT email, pgp_sym_decrypt(refresh_token_encrypted, p_key)
  FROM public.google_oauth_tokens;
$$;
REVOKE EXECUTE ON FUNCTION public._get_all_decrypted_google_tokens(TEXT) FROM PUBLIC, anon, authenticated;

-- =========================================================================
-- PART 4: 1-ON-1 PUSH DEDUP - push-1on1-reminder polls every ~15 minutes
-- looking for meetings starting in the next 30 minutes, so without this a
-- member would get the same "starting soon" push 2-3 times as the polling
-- window slides past the same meeting. Keyed by the Google Calendar event
-- ID itself (stable per meeting) rather than a date/time, so a
-- rescheduled instance of a recurring meeting is treated as new. No RLS
-- policies, same reasoning as google_oauth_tokens - only push-1on1-reminder
-- ever touches this table, always via the service role, which bypasses RLS
-- entirely, so no authenticated-callable RPC wrapper is needed here.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.push_1on1_sent (
  email TEXT NOT NULL,
  event_id TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (email, event_id)
);

ALTER TABLE public.push_1on1_sent ENABLE ROW LEVEL SECURITY;
-- Intentionally zero policies - service role only, see comment above.
