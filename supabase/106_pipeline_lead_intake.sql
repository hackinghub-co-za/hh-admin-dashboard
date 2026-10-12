-- Hacking Hub Admin Dashboard - Automatic Sales Pipeline lead intake
-- Run this in the Supabase SQL Editor after 002-105 have already been
-- applied. Safe to re-run: every statement is idempotent.
--
-- Two sources feed the Sales Pipeline (pipeline_prospects, 083) without
-- anyone typing them in: Elite Operative applications (the Google Form on
-- My Subscription's "Apply for Placement" button) and calls booked on the
-- founder's Google Calendar booking page. A small Google Apps Script
-- (scripts/google-apps-script/pipeline-leads.gs) catches each one and posts
-- it to the pipeline-lead-intake Edge Function, which calls the function
-- below with the service role.
--
-- _intake_pipeline_lead() is the single place that decides what a lead
-- becomes: one card per email address (a repeat booking or a second
-- application adds a dated note to the existing card instead of a
-- duplicate), new cards land at the bottom of the Lead column, and every
-- call carries a unique ref so a retried or re-sent message is a no-op.
-- Calls booked by someone who is already a current member are skipped (they
-- are ordinary 1-on-1 bookings, not leads); an Elite application from a
-- current member is kept, since that is an upgrade enquiry.

CREATE TABLE IF NOT EXISTS public.pipeline_lead_events (
  ref TEXT PRIMARY KEY,
  prospect_id BIGINT REFERENCES public.pipeline_prospects(id) ON DELETE SET NULL,
  source TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.pipeline_lead_events ENABLE ROW LEVEL SECURITY;
-- Intentionally zero policies: only the service role (which bypasses RLS)
-- ever touches this table, from _intake_pipeline_lead().

CREATE OR REPLACE FUNCTION public._intake_pipeline_lead(
  p_ref TEXT,
  p_source TEXT,
  p_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_notes TEXT,
  p_skip_existing_members BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email TEXT := NULLIF(lower(trim(p_email)), '');
  v_name TEXT := NULLIF(trim(p_name), '');
  v_phone TEXT := NULLIF(trim(p_phone), '');
  v_stamp TEXT := to_char(now() AT TIME ZONE 'Africa/Johannesburg', 'YYYY-MM-DD');
  v_is_member BOOLEAN := false;
  v_id BIGINT;
  v_next INTEGER;
  v_line TEXT;
BEGIN
  IF p_ref IS NULL OR length(trim(p_ref)) = 0 THEN
    RAISE EXCEPTION 'A ref is required.';
  END IF;
  IF p_source IS NULL OR length(trim(p_source)) = 0 THEN
    RAISE EXCEPTION 'A source is required.';
  END IF;

  IF EXISTS (SELECT 1 FROM public.pipeline_lead_events WHERE ref = p_ref) THEN
    RETURN jsonb_build_object('action', 'duplicate');
  END IF;

  IF v_email IS NOT NULL THEN
    v_is_member := EXISTS (
      SELECT 1 FROM public.member_profiles
      WHERE email = v_email AND status IN ('Active', 'Active (Permanent)', 'Leaving')
    );
  END IF;

  IF v_is_member AND p_skip_existing_members THEN
    INSERT INTO public.pipeline_lead_events (ref, source) VALUES (p_ref, p_source) ON CONFLICT DO NOTHING;
    RETURN jsonb_build_object('action', 'skipped_member');
  END IF;

  v_line := '[' || v_stamp || '] ' || p_source || CASE WHEN v_is_member THEN ' (current member)' ELSE '' END
            || CASE WHEN NULLIF(trim(p_notes), '') IS NOT NULL THEN E'\n' || trim(p_notes) ELSE '' END;

  IF v_email IS NOT NULL THEN
    SELECT id INTO v_id FROM public.pipeline_prospects WHERE lower(email) = v_email ORDER BY id LIMIT 1;
  END IF;

  IF v_id IS NOT NULL THEN
    UPDATE public.pipeline_prospects
    SET notes = CASE WHEN notes IS NULL OR trim(notes) = '' THEN v_line ELSE notes || E'\n\n' || v_line END,
        phone = COALESCE(phone, v_phone),
        updated_at = timezone('utc'::text, now())
    WHERE id = v_id;
    INSERT INTO public.pipeline_lead_events (ref, prospect_id, source) VALUES (p_ref, v_id, p_source) ON CONFLICT DO NOTHING;
    RETURN jsonb_build_object('action', 'updated', 'id', v_id);
  END IF;

  SELECT COALESCE(MAX(sort_order), -1) + 1 INTO v_next FROM public.pipeline_prospects WHERE phase = 'Lead';

  INSERT INTO public.pipeline_prospects (full_name, email, phone, phase, source, notes, sort_order, created_by)
  VALUES (COALESCE(v_name, v_email, 'Unknown'), v_email, v_phone, 'Lead', p_source, v_line, v_next, 'automation')
  RETURNING id INTO v_id;

  INSERT INTO public.pipeline_lead_events (ref, prospect_id, source) VALUES (p_ref, v_id, p_source) ON CONFLICT DO NOTHING;
  RETURN jsonb_build_object('action', 'created', 'id', v_id);
END;
$$;
REVOKE EXECUTE ON FUNCTION public._intake_pipeline_lead(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._intake_pipeline_lead(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO service_role;
