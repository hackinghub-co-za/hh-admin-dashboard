-- Hacking Hub Admin Dashboard - Focus 5 Daily Updates
-- Run this in the Supabase SQL Editor after 002-077 have already been
-- applied. Safe to re-run: every statement is idempotent.
--
-- Whoever is currently on the Focus 5 list (038_focus_five.sql - the 5
-- members getting the most attention this month) now has to answer "what
-- did you do today" once per day on login, straight to the founder's inbox
-- via the focus-five-update-email edge function - not a general
-- member-facing feature, only ever shown to whichever 5 emails are
-- currently in focus_five.
--
-- update_date defaults to the server's UTC date (not client-supplied) so
-- "today" can never be spoofed by a member's local clock, and the
-- UNIQUE(member_email, update_date) constraint is what submit_focus_five_
-- daily_update() below relies on to make one submission per person per
-- day, matching submit_daily_room_log's exact shape
-- (031_daily_room_logs.sql).

CREATE TABLE IF NOT EXISTS public.focus_five_daily_updates (
  id BIGSERIAL PRIMARY KEY,
  member_email TEXT NOT NULL,
  update_date DATE NOT NULL DEFAULT (timezone('utc'::text, now())::date),
  update_text TEXT NOT NULL,
  notified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (member_email, update_date)
);

CREATE INDEX IF NOT EXISTS idx_focus_five_daily_updates_member ON public.focus_five_daily_updates(member_email, update_date DESC);

ALTER TABLE public.focus_five_daily_updates ENABLE ROW LEVEL SECURITY;

-- No member INSERT/UPDATE policy - submissions go through
-- submit_focus_five_daily_update() below, which enforces that the caller
-- is actually on the Focus 5 list server-side rather than trusting the
-- client (the modal that prompts for this is only ever shown to a member
-- the client already believes is on the list, but RLS/the RPC is the real
-- gate).
DROP POLICY IF EXISTS "members read own focus five updates" ON public.focus_five_daily_updates;
CREATE POLICY "members read own focus five updates"
  ON public.focus_five_daily_updates FOR SELECT
  USING (member_email = lower(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "admins manage focus five updates" ON public.focus_five_daily_updates;
CREATE POLICY "admins manage focus five updates"
  ON public.focus_five_daily_updates FOR ALL
  USING (public.is_admin(auth.uid()));

-- A member checking "am I on Focus 5" (to decide whether to show the daily
-- update prompt at all) only ever needs to know about their OWN row - this
-- doesn't widen visibility to the other 4 names on the list the way a
-- blanket member-read policy would.
DROP POLICY IF EXISTS "members check own focus five status" ON public.focus_five;
CREATE POLICY "members check own focus five status"
  ON public.focus_five FOR SELECT
  USING (member_email = lower(auth.jwt() ->> 'email'));

CREATE OR REPLACE FUNCTION public.submit_focus_five_daily_update(p_update_text TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
BEGIN
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Not authenticated.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.focus_five WHERE member_email = v_email) THEN
    RAISE EXCEPTION 'You are not currently on the Focus 5 list.';
  END IF;
  IF p_update_text IS NULL OR trim(p_update_text) = '' THEN
    RAISE EXCEPTION 'Tell us what you did today before submitting.';
  END IF;

  INSERT INTO public.focus_five_daily_updates (member_email, update_date, update_text)
  VALUES (v_email, timezone('utc'::text, now())::date, trim(p_update_text))
  ON CONFLICT (member_email, update_date) DO UPDATE SET
    update_text = EXCLUDED.update_text;
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_focus_five_daily_update(TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.submit_focus_five_daily_update(TEXT) FROM PUBLIC, anon;
