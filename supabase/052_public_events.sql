-- Hacking Hub Admin Dashboard - Public Read-Only Events Feed
-- Run this in the Supabase SQL Editor after 002-051 have already been
-- applied. Safe to re-run: every statement is idempotent.
--
-- The public marketing site (hackinghub.co.za, a separate static repo with
-- no login of its own) wants to show the same community_events members see
-- in the portal, so visitors can see we're an active, real community before
-- ever signing up - no login required.
--
-- community_events today has no anon-facing read path at all: the only
-- existing SELECT policy (019_events.sql, "members read community events")
-- is scoped to `TO authenticated` and additionally requires
-- is_member_allowed(), so an anon (logged-out) request returns nothing.
-- Rather than add a second RLS policy for `anon` - which would only filter
-- rows, not columns, and could not stop `created_by` (a member's real email
-- address) from being selected - this exposes a single narrow
-- SECURITY DEFINER RPC that hand-picks exactly the columns that are safe for
-- the public: never created_by, never a Pending row, never a raw RSVP row
-- (only an aggregate count, no emails). Same idiom as the admin-only
-- aggregate RPCs in 050_portal_events.sql, just granted to anon instead of
-- restricted to admins, matching the anon-facing SECURITY DEFINER functions
-- already in this codebase (is_member_allowed, has_completed_onboarding,
-- is_offboarding_pending, unsubscribe_from_roadmap_reminders).
--
-- Defaults to upcoming events only (date >= today) - a public marketing page
-- showing events that already happened reads as an abandoned community, and
-- there's no "browse history" use case for a logged-out visitor the way
-- there might be for a member. p_upcoming_only can be passed false by a
-- future caller that wants the full approved history, but nothing calls it
-- that way today.

DROP FUNCTION IF EXISTS public.get_public_community_events(BOOLEAN);
CREATE FUNCTION public.get_public_community_events(p_upcoming_only BOOLEAN DEFAULT true)
RETURNS TABLE (
  id BIGINT,
  type TEXT,
  title TEXT,
  description TEXT,
  date DATE,
  "time" TEXT,
  location TEXT,
  link TEXT,
  rsvp_count INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ce.id,
    ce.type,
    ce.title,
    ce.description,
    ce.date,
    ce."time",
    ce.location,
    ce.link,
    COUNT(er.email)::INTEGER AS rsvp_count
  FROM public.community_events ce
  LEFT JOIN public.event_rsvps er ON er.event_id = ce.id
  WHERE ce.status = 'Approved'
    AND (NOT p_upcoming_only OR ce.date >= (timezone('utc'::text, now()))::date)
  GROUP BY ce.id
  ORDER BY ce.date ASC, ce."time" ASC NULLS LAST
  LIMIT 24;
$$;

-- Intentionally public: no REVOKE FROM PUBLIC/anon here, unlike the
-- admin-only RPCs in 050_portal_events.sql - this function's own body is
-- the security boundary (Approved-only, no created_by, no raw RSVP rows),
-- not caller identity. Same "grant straight to anon" idiom as
-- is_member_allowed (004_member_access_control.sql).
GRANT EXECUTE ON FUNCTION public.get_public_community_events(BOOLEAN) TO anon, authenticated;
