-- Hacking Hub Admin Dashboard - Overdue 1-on-1 Digest
-- Run this in the Supabase SQL Editor after 002-070 have already been
-- applied. Safe to re-run: every statement is idempotent.
--
-- A daily digest for the founder: every active member who hasn't had a
-- 1-on-1 logged in the last 30 days - or ever - sent by the
-- overdue-1on1-digest edge function (cron in 072_overdue_1on1_digest_cron.sql).
--
-- REVISION (2026-09-12): this originally read supabase/schema.sql's
-- one_on_ones table, joined via profiles.id. That table turned out to be
-- dead - nothing in the live app has ever written to it. Booking a 1-on-1
-- ("Book a 1on1 Strategy Session" in MemberPortal.jsx) just opens the
-- mentor's live Google Calendar as a plain external link; no Supabase row
-- is ever created. The digest was flagging real, recently-met members as
-- "never had one" because there was, quite literally, nothing in the
-- database saying otherwise - a real bug caught the same day this shipped,
-- by the founder noticing the emails were wrong.
--
-- Real fix, for later: read a mentor's actual Google Calendar server-side
-- (there's already a working precedent for this exact pattern -
-- push-1on1-reminder, 048_push_notifications.sql PART 3, refreshes a
-- member's stored Google token and checks their Calendar for an event
-- organized by a known mentor email - just scoped to upcoming events for a
-- push notification, not past ones for a digest). That needs its own
-- design pass (it would only ever cover members who've connected calendar
-- access via hh-app - a web-only member has no stored refresh token at
-- all, so "no data" and "genuinely overdue" would need to read as two
-- different things, not get flattened into one) - deliberately not
-- attempted here.
--
-- For now: a new one_on_one_logs table, manually logged by an admin or
-- mentor right after a real session happens - buildable today with no
-- Google integration, at the cost of only being as accurate as whoever's
-- supposed to remember to log it. member_email-keyed, matching the join
-- convention every other table built after the original schema.sql uses
-- (daily_room_logs, roadmap_items, etc.) - not profiles.id like the dead
-- one_on_ones was.

CREATE TABLE IF NOT EXISTS public.one_on_one_logs (
  id BIGSERIAL PRIMARY KEY,
  member_email TEXT NOT NULL,
  mentor_name TEXT NOT NULL,
  session_date DATE NOT NULL,
  topic TEXT,
  logged_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.one_on_one_logs ENABLE ROW LEVEL SECURITY;

-- A member can see their own logged history (so it's not a one-way black
-- box only the founder sees) but never write to it themselves - matches
-- the "member owns reading their own row, staff owns writing it" pattern
-- already used for cert_calendar/roadmap_items.
DROP POLICY IF EXISTS "members read own 1on1 logs" ON public.one_on_one_logs;
CREATE POLICY "members read own 1on1 logs"
  ON public.one_on_one_logs FOR SELECT
  TO authenticated
  USING (
    member_email = lower(auth.jwt() ->> 'email')
    AND public.is_member_allowed(auth.jwt() ->> 'email')
  );

-- Admin or mentor - a 1-on-1 is squarely a mentor's own job (this file's
-- header in 067_permission_scopes.sql already describes mentor as
-- reviewing "roadmap/cert/CV/interview progress"; logging the session
-- itself belongs right alongside that). No RPC needed - logged_by is
-- client-supplied, same trust level as created_by/reviewed_by elsewhere in
-- this schema for an internal admin/mentor action, not a security boundary.
DROP POLICY IF EXISTS "staff manage 1on1 logs" ON public.one_on_one_logs;
CREATE POLICY "staff manage 1on1 logs"
  ON public.one_on_one_logs FOR ALL
  USING (public.is_admin(auth.uid()) OR public.is_mentor(auth.uid()));

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
    MAX(l.session_date)::TIMESTAMP WITH TIME ZONE AS last_1on1_at
  FROM public.member_profiles mp
  LEFT JOIN public.one_on_one_logs l ON l.member_email = mp.email
  WHERE mp.status IN ('Active', 'Active (Permanent)')
    -- The founder's own member_profiles row (if one exists) isn't a real
    -- coaching relationship to flag back to themselves.
    AND mp.email != 'siya@hackinghub.co.za'
  GROUP BY mp.email, mp.full_name
  HAVING MAX(l.session_date) IS NULL
      OR MAX(l.session_date) < (timezone('utc'::text, now())::date - p_days)
  ORDER BY last_1on1_at ASC NULLS FIRST;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_members_overdue_for_1on1(INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_members_overdue_for_1on1(INTEGER) FROM PUBLIC, anon;
