-- Hacking Hub Admin Dashboard - Portal Event Charts
-- Run this in the Supabase SQL Editor after 002-096 have already been
-- applied. Safe to re-run: every statement is idempotent.
--
-- Charts the five new events added alongside the Roadmap & Engagement
-- Insights section (roadmap_item_opened, resource_opened, job_board_clicked,
-- leaderboard_viewed, interview_prep_used) - both of these are brand new
-- RPCs because, unlike roadmap_items/member_profiles, portal_events isn't
-- already loaded client-side admin-wide; every Portal Usage stat already on
-- Insights (get_portal_tab_engagement etc., 050_portal_events.sql) follows
-- this same "small admin-only aggregate RPC" shape for the same reason.
-- Both will show "no data yet" until the new events have accumulated some
-- real history - that's expected, not a bug, since they only started being
-- logged today.

-- Roadmap item "opened" counts, per title - pairs with roadmap_items.
-- completed_at (already loaded client-side for the Most Completed Roadmap
-- Items card) to build an opened-vs-completed funnel per item. Counts
-- DISTINCT members, not raw clicks, so it's a fair comparison against the
-- completed-item counts (which are inherently one row per member per item).
CREATE OR REPLACE FUNCTION public.get_roadmap_item_open_counts(p_days INTEGER DEFAULT 90)
RETURNS TABLE (title TEXT, open_count INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated' AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can do this.';
  END IF;

  RETURN QUERY
  SELECT pe.metadata ->> 'title' AS title, COUNT(DISTINCT pe.email)::INTEGER AS open_count
  FROM public.portal_events pe
  WHERE pe.event_type = 'roadmap_item_opened'
    AND pe.metadata ->> 'title' IS NOT NULL
    AND pe.created_at >= timezone('utc'::text, now()) - (p_days || ' days')::interval
  GROUP BY pe.metadata ->> 'title'
  ORDER BY open_count DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_roadmap_item_open_counts(INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_roadmap_item_open_counts(INTEGER) FROM PUBLIC, anon;

-- Feature adoption - distinct members who triggered each of the five new
-- events at least once in the window. The client divides by
-- portalActiveMembers30d (already fetched for Portal Usage) for a %, same
-- convention as get_portal_tab_engagement's tab-popularity percentages.
CREATE OR REPLACE FUNCTION public.get_feature_adoption_counts(p_days INTEGER DEFAULT 30)
RETURNS TABLE (event_type TEXT, member_count INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated' AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can do this.';
  END IF;

  RETURN QUERY
  SELECT pe.event_type, COUNT(DISTINCT pe.email)::INTEGER AS member_count
  FROM public.portal_events pe
  WHERE pe.event_type IN ('roadmap_item_opened', 'resource_opened', 'job_board_clicked', 'leaderboard_viewed', 'interview_prep_used')
    AND pe.created_at >= timezone('utc'::text, now()) - (p_days || ' days')::interval
  GROUP BY pe.event_type
  ORDER BY member_count DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_feature_adoption_counts(INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_feature_adoption_counts(INTEGER) FROM PUBLIC, anon;
