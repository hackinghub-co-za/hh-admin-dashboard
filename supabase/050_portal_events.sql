-- Hacking Hub Admin Dashboard - Portal Usage Analytics
-- Run this in the Supabase SQL Editor after 002-049 have already been
-- applied. Safe to re-run: every statement is idempotent.
--
-- Backend for the "Portal Usage Analytics" plan: one generic, append-only
-- event stream so the admin Insights tab can show which tabs/features
-- members actually use, instead of guessing. Deliberately narrow - see
-- the client-side call sites for exactly which events get logged
-- (session_start, tab_view, and a handful of curated "did something"
-- actions). No polling anywhere reads this table; the admin side is
-- fetch-on-mount plus the existing manual Refresh button, same as every
-- other tab in this app.

-- =========================================================================
-- EVENTS TABLE - one row per occurrence, keyed by whichever member did it.
-- Admin-only RLS, same shape as eft_payments/payfast_transactions
-- (002_member_persistence.sql, 033_payfast_transactions.sql) - members
-- have no reason to read their own usage log back, so there's no member
-- SELECT policy at all, only the write RPC below.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.portal_events (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  event_type TEXT NOT NULL,
  -- Stays structural (tab names, ids, counts) - never free-text member
  -- content. Free-form on purpose: a new event_type needs zero migration,
  -- just a new call site.
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_portal_events_type_created ON public.portal_events(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_portal_events_email_created ON public.portal_events(email, created_at);

ALTER TABLE public.portal_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins manage portal events" ON public.portal_events;
CREATE POLICY "admins manage portal events"
  ON public.portal_events FOR ALL
  USING (public.is_admin(auth.uid()));

-- The only way a row gets written - SECURITY DEFINER, pulls identity from
-- the caller's own JWT so the client never sends its own email (same idiom
-- as register_my_push_token/record_daily_login). Fire-and-forget from the
-- client; never awaited in a render path.
CREATE OR REPLACE FUNCTION public.log_my_portal_event(p_event_type TEXT, p_metadata JSONB DEFAULT '{}'::jsonb)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  INSERT INTO public.portal_events (email, event_type, metadata)
  VALUES (lower(auth.jwt() ->> 'email'), p_event_type, COALESCE(p_metadata, '{}'::jsonb));
$$;
GRANT EXECUTE ON FUNCTION public.log_my_portal_event(TEXT, JSONB) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.log_my_portal_event(TEXT, JSONB) FROM PUBLIC, anon;

-- =========================================================================
-- ADMIN AGGREGATION - counting/grouping happens in Postgres, not by
-- shipping raw rows to the client and looping (unlike the rest of
-- Insights, which is fine looping client-side over roster-sized data;
-- this table won't stay roster-sized). Same admin-or-service-role guard
-- idiom as get_members_with_lapsing_streak() (048_push_notifications.sql).
-- =========================================================================

-- Distinct members with any event in the last p_days - the single "is the
-- portal actually being used" top-line number. Also doubles as the % of
-- active members" denominator for get_portal_tab_engagement below.
CREATE OR REPLACE FUNCTION public.get_portal_active_member_count(p_days INTEGER DEFAULT 7)
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  IF auth.role() = 'authenticated' AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can do this.';
  END IF;

  SELECT COUNT(DISTINCT email) INTO v_count
  FROM public.portal_events
  WHERE created_at >= timezone('utc'::text, now()) - (p_days || ' days')::interval;

  RETURN v_count;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_portal_active_member_count(INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_portal_active_member_count(INTEGER) FROM PUBLIC, anon;

-- Distinct members per tab, from tab_view events' metadata->>'tab', over
-- the last p_days - the "tab popularity" breakdown.
CREATE OR REPLACE FUNCTION public.get_portal_tab_engagement(p_days INTEGER DEFAULT 30)
RETURNS TABLE (tab TEXT, member_count INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated' AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can do this.';
  END IF;

  RETURN QUERY
  SELECT pe.metadata ->> 'tab' AS tab, COUNT(DISTINCT pe.email)::INTEGER AS member_count
  FROM public.portal_events pe
  WHERE pe.event_type = 'tab_view'
    AND pe.metadata ->> 'tab' IS NOT NULL
    AND pe.created_at >= timezone('utc'::text, now()) - (p_days || ' days')::interval
  GROUP BY pe.metadata ->> 'tab'
  ORDER BY member_count DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_portal_tab_engagement(INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_portal_tab_engagement(INTEGER) FROM PUBLIC, anon;

-- Weekly active members per calendar week, for the last p_weeks - powers
-- the Insights "Engagement trend" line chart. Buckets by ISO week start
-- (Monday) so the trend reads as clean weekly points rather than a noisy
-- daily line.
CREATE OR REPLACE FUNCTION public.get_portal_weekly_trend(p_weeks INTEGER DEFAULT 8)
RETURNS TABLE (week_start DATE, active_members INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated' AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can do this.';
  END IF;

  RETURN QUERY
  SELECT date_trunc('week', pe.created_at)::DATE AS week_start, COUNT(DISTINCT pe.email)::INTEGER AS active_members
  FROM public.portal_events pe
  WHERE pe.created_at >= timezone('utc'::text, now()) - (p_weeks || ' weeks')::interval
  GROUP BY date_trunc('week', pe.created_at)
  ORDER BY week_start ASC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_portal_weekly_trend(INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_portal_weekly_trend(INTEGER) FROM PUBLIC, anon;
