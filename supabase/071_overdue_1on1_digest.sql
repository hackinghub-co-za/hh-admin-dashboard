-- Hacking Hub Admin Dashboard - Overdue 1-on-1 Digest
-- Run this in the Supabase SQL Editor after 002-070 have already been
-- applied. Safe to re-run: every statement is idempotent.
--
-- A daily digest for the founder: every active member who hasn't had a
-- completed 1-on-1 in the last 30 days - or ever - sent by the
-- overdue-1on1-digest edge function (cron in 072_overdue_1on1_digest_cron.sql).
--
-- one_on_ones.member_id is a profiles.id (schema.sql), not an email, so
-- this joins through profiles.email to member_profiles the same way
-- identity is resolved everywhere else in this project that needs to cross
-- from the auth-facing profiles table to the roster-facing member_profiles
-- one. "Overdue" deliberately includes a member with NO completed 1-on-1
-- row at all (MAX(...) is NULL for them), not just one whose last one has
-- aged out - someone who's never had one is at least as much a miss as
-- someone whose 31st day just ticked over.

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
    MAX(oo.time) FILTER (WHERE oo.status = 'completed') AS last_1on1_at
  FROM public.member_profiles mp
  JOIN public.profiles p ON p.email = mp.email
  LEFT JOIN public.one_on_ones oo ON oo.member_id = p.id
  WHERE mp.status IN ('Active', 'Active (Permanent)')
    -- The founder's own member_profiles row (if one exists) isn't a real
    -- coaching relationship to flag back to themselves.
    AND mp.email != 'siya@hackinghub.co.za'
  GROUP BY mp.email, mp.full_name
  HAVING MAX(oo.time) FILTER (WHERE oo.status = 'completed') IS NULL
      OR MAX(oo.time) FILTER (WHERE oo.status = 'completed') < timezone('utc'::text, now()) - (p_days || ' days')::interval
  ORDER BY last_1on1_at ASC NULLS FIRST;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_members_overdue_for_1on1(INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_members_overdue_for_1on1(INTEGER) FROM PUBLIC, anon;
