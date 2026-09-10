-- Hacking Hub Admin Dashboard - Weekly Incident Breakdowns
-- Run after 002-067 have been applied. Safe to re-run.
--
-- The SOC track's weekly ritual: a technical breakdown of one real
-- security incident, sent to every active member as an email from Gemma
-- (a short blurb + a "read it" link, deliberately driving traffic to the
-- portal) and archived on a member-facing Breakdowns tab where the full
-- write-up lives.
--
-- The pipeline (see the "Friday Send" design doc):
--   - A facilitator drafts a breakdown into this table during the week -
--     status 'Draft'.
--   - A Community Manager OR the founder reviews it and calls
--     approve_weekly_breakdown() - status 'Approved'. This is the gate:
--     nothing an LLM helped write ships to 94 members without a human
--     flipping this.
--   - Friday 06:00 UTC (= 08:00 SAST) the weekly-breakdown-email edge
--     function runs (cron in 069_weekly_breakdown_cron.sql). If there's an
--     Approved row for that send_date it mails it, posts a
--     community_broadcasts row, and marks this row 'Sent'. If there
--     ISN'T one, it alerts the founder and sends nothing.
--   - Wednesday 13:00 UTC the breakdown-nudge function reminds the
--     facilitators if the coming Friday still has no Approved breakdown.
--
-- Same "one opt-out per email type" convention as roadmap_reminder_opted_out
-- (028) and linkedin_reminder_opted_out (059) - breakdown_email_opted_out
-- below is its own column so unsubscribing from one HH email never touches
-- another.

CREATE TABLE IF NOT EXISTS public.weekly_breakdowns (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  source_label TEXT,                       -- e.g. 'CISA AA23-320A', 'The DFIR Report'
  difficulty TEXT CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  blurb TEXT NOT NULL,                     -- 2-3 sentences: the email body, the broadcast, the archive card
  body_md TEXT NOT NULL,                   -- the full breakdown, markdown, rendered on the Breakdowns tab
  full_url TEXT,                           -- optional: a richer hosted version (illustrated, with the diagram)
  send_date DATE NOT NULL,                 -- the Friday it goes out
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft', 'Approved', 'Sent')),
  approved_by TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  recipient_count INTEGER,
  broadcast_id BIGINT,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

-- At most one breakdown per send date - a Friday has exactly one edition.
CREATE UNIQUE INDEX IF NOT EXISTS idx_weekly_breakdowns_send_date
  ON public.weekly_breakdowns(send_date);

ALTER TABLE public.weekly_breakdowns ENABLE ROW LEVEL SECURITY;

-- Members only ever see breakdowns that have actually gone out - a Draft or
-- an Approved-but-not-yet-sent edition is invisible to them.
DROP POLICY IF EXISTS "members read sent breakdowns" ON public.weekly_breakdowns;
CREATE POLICY "members read sent breakdowns"
  ON public.weekly_breakdowns FOR SELECT
  TO authenticated
  USING (
    status = 'Sent'
    AND public.is_member_allowed(auth.jwt() ->> 'email')
  );

-- Admins and Community Managers author and manage every edition - the
-- same pair that already runs the rest of community content
-- (067_permission_scopes.sql). Mentors and members cannot.
DROP POLICY IF EXISTS "staff manage breakdowns" ON public.weekly_breakdowns;
CREATE POLICY "staff manage breakdowns"
  ON public.weekly_breakdowns FOR ALL
  USING (public.is_admin(auth.uid()) OR public.is_community_manager(auth.uid()));

-- Approve an edition - a Community Manager or the founder. Only moves
-- Draft -> Approved, and only if it's actually complete: an empty blurb or
-- body can't be approved into the Friday send. Records who signed off.
CREATE OR REPLACE FUNCTION public.approve_weekly_breakdown(p_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_row public.weekly_breakdowns%ROWTYPE;
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_community_manager(auth.uid())) THEN
    RAISE EXCEPTION 'Only the founder or a Community Manager can approve a breakdown.';
  END IF;

  SELECT * INTO v_row FROM public.weekly_breakdowns WHERE id = p_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Breakdown not found.';
  END IF;
  IF v_row.status <> 'Draft' THEN
    RAISE EXCEPTION 'Only a Draft can be approved (this one is %).', v_row.status;
  END IF;
  IF coalesce(trim(v_row.blurb), '') = '' OR coalesce(trim(v_row.body_md), '') = '' THEN
    RAISE EXCEPTION 'Add a blurb and the full breakdown before approving.';
  END IF;

  UPDATE public.weekly_breakdowns
  SET status = 'Approved',
      approved_by = lower(auth.jwt() ->> 'email'),
      approved_at = timezone('utc'::text, now()),
      updated_at = timezone('utc'::text, now())
  WHERE id = p_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.approve_weekly_breakdown(BIGINT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.approve_weekly_breakdown(BIGINT) FROM PUBLIC, anon;

-- Pull an approval back to Draft - same gate. For catching a mistake
-- before Friday. A Sent edition is final and can't be un-approved.
CREATE OR REPLACE FUNCTION public.unapprove_weekly_breakdown(p_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_community_manager(auth.uid())) THEN
    RAISE EXCEPTION 'Only the founder or a Community Manager can do this.';
  END IF;

  UPDATE public.weekly_breakdowns
  SET status = 'Draft', approved_by = NULL, approved_at = NULL,
      updated_at = timezone('utc'::text, now())
  WHERE id = p_id AND status = 'Approved';
END;
$$;
GRANT EXECUTE ON FUNCTION public.unapprove_weekly_breakdown(BIGINT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.unapprove_weekly_breakdown(BIGINT) FROM PUBLIC, anon;

-- Called by the send edge function once the mail is out. Service-role
-- (the function) has no 'authenticated' JWT role, so the guard below only
-- ever blocks a signed-in non-admin, same pattern as
-- mark_roadmap_reminder_sent (028). Approved -> Sent, records the count
-- and the broadcast it spawned.
CREATE OR REPLACE FUNCTION public.mark_weekly_breakdown_sent(p_id BIGINT, p_recipient_count INTEGER, p_broadcast_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated' AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can do this.';
  END IF;

  UPDATE public.weekly_breakdowns
  SET status = 'Sent',
      sent_at = timezone('utc'::text, now()),
      recipient_count = p_recipient_count,
      broadcast_id = p_broadcast_id,
      updated_at = timezone('utc'::text, now())
  WHERE id = p_id AND status = 'Approved';
END;
$$;
GRANT EXECUTE ON FUNCTION public.mark_weekly_breakdown_sent(BIGINT, INTEGER, BIGINT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_weekly_breakdown_sent(BIGINT, INTEGER, BIGINT) FROM PUBLIC, anon;

-- =========================================================================
-- RECIPIENTS + OPT-OUT
-- =========================================================================

ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS breakdown_email_opted_out BOOLEAN NOT NULL DEFAULT false;

-- Same anonymous, no-token unsubscribe as
-- unsubscribe_from_linkedin_reminders (059) - a cold click from an email
-- client with no Supabase session.
CREATE OR REPLACE FUNCTION public.unsubscribe_from_breakdown_emails(p_email TEXT)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.member_profiles
  SET breakdown_email_opted_out = true
  WHERE email = lower(p_email);
$$;
GRANT EXECUTE ON FUNCTION public.unsubscribe_from_breakdown_emails(TEXT) TO anon, authenticated;

-- Every active, opted-in member - the Friday recipient list. Callable by
-- the service role (the edge function) or an admin; never an ordinary
-- member. Computed here rather than pulled into Deno and filtered there.
CREATE OR REPLACE FUNCTION public.get_breakdown_recipients()
RETURNS TABLE (email TEXT, full_name TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated' AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can view this.';
  END IF;

  RETURN QUERY
  SELECT mp.email, mp.full_name
  FROM public.member_profiles mp
  WHERE mp.status IN ('Active', 'Active (Permanent)')
    AND mp.breakdown_email_opted_out = false;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_breakdown_recipients() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_breakdown_recipients() FROM PUBLIC, anon;

-- Who to nudge on Wednesday if Friday still has no Approved edition -
-- every admin and Community Manager email. Same service-role/admin gate.
CREATE OR REPLACE FUNCTION public.get_breakdown_facilitator_emails()
RETURNS TABLE (email TEXT, full_name TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated' AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can view this.';
  END IF;

  RETURN QUERY
  SELECT p.email, p.full_name
  FROM public.profiles p
  WHERE p.role IN ('admin', 'community_manager')
    AND p.email IS NOT NULL;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_breakdown_facilitator_emails() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_breakdown_facilitator_emails() FROM PUBLIC, anon;

-- The single edition due to go out on a given Friday, if one exists and is
-- approved - what the send function asks for first. Returns nothing (not an
-- error) when there's no approved edition for that date, which is the
-- signal to send the founder the "nothing went out" alert instead.
CREATE OR REPLACE FUNCTION public.get_approved_breakdown_for_date(p_send_date DATE)
RETURNS SETOF public.weekly_breakdowns
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated' AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can view this.';
  END IF;

  RETURN QUERY
  SELECT * FROM public.weekly_breakdowns
  WHERE send_date = p_send_date AND status = 'Approved'
  LIMIT 1;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_approved_breakdown_for_date(DATE) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_approved_breakdown_for_date(DATE) FROM PUBLIC, anon;
