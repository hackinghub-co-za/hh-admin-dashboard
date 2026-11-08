-- Sales pipeline tracker (admin-only) - people who are interested in or
-- about to join Hacking Hub, tracked from first contact through to
-- actually joining (or not). Deliberately NOT tied to member_profiles,
-- which only ever has rows for people who've actually joined - this is
-- the pre-join funnel. No overlap with manual_members (bookkeeping for
-- members who already joined outside the normal PayFast flow) or
-- referrals (a narrow, referral-reward-specific flow with its own
-- outcome-only status enum) - checked both before adding this table.

CREATE TABLE IF NOT EXISTS public.pipeline_prospects (
  id BIGSERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  -- 'Joined'/'Not Interested'/'Not Qualified' are terminal columns, kept visible rather
  -- than deleted - the same "Won/Lost" idea a real sales board uses, so
  -- there's a visual record of how people actually moved through instead
  -- of just vanishing from the board.
  phase TEXT NOT NULL DEFAULT 'Lead' CHECK (phase IN ('Lead', 'Contacted', 'Ready to Join', 'Joined', 'Not Interested', 'Not Qualified')),
  -- How they heard about HH - free text (referral, social media, event,
  -- etc.), same free-text convention cert_calendar.cert_name already uses
  -- rather than a CHECK enum that would need updating every time a new
  -- channel shows up.
  source TEXT,
  notes TEXT,
  -- Card position within its phase column - same sort_order pattern
  -- suggested_content (044_community_content.sql) already uses.
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.pipeline_prospects ENABLE ROW LEVEL SECURITY;

-- Admin-only, full stop - no member-facing read/write at all. Matches
-- manual_members/Focus 5's own admin-exclusive RLS shape. Direct
-- .from().insert()/.update()/.delete() from the client is safe here (no
-- RPC needed) since this FOR ALL policy already gates every operation.
DROP POLICY IF EXISTS "admins manage pipeline prospects" ON public.pipeline_prospects;
CREATE POLICY "admins manage pipeline prospects"
  ON public.pipeline_prospects FOR ALL
  USING (public.is_admin(auth.uid()));

-- 2026-11-01: the 'Interested' column was removed (everyone in it moved to
-- 'Ready to Join', after the cards already there) and a terminal 'Not
-- Qualified' column was added. Idempotent: once nothing is 'Interested' the
-- UPDATE moves no rows, and the constraint is simply re-created.
ALTER TABLE public.pipeline_prospects DROP CONSTRAINT IF EXISTS pipeline_prospects_phase_check;
WITH base AS (
  SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM public.pipeline_prospects WHERE phase = 'Ready to Join'
), moved AS (
  SELECT id, row_number() OVER (ORDER BY sort_order, id) - 1 AS rn FROM public.pipeline_prospects WHERE phase = 'Interested'
)
UPDATE public.pipeline_prospects p
SET phase = 'Ready to Join', sort_order = base.n + moved.rn, updated_at = now()
FROM moved, base
WHERE p.id = moved.id;
ALTER TABLE public.pipeline_prospects ADD CONSTRAINT pipeline_prospects_phase_check
  CHECK (phase IN ('Lead', 'Contacted', 'Ready to Join', 'Joined', 'Not Interested', 'Not Qualified'));

-- 2026-11-08: STALE CARDS COME OFF THE BOARD, AND PROGRESS NOTES.
--
-- A card not updated for 21 days is taken off the board automatically
-- (archived_at set by archive_stale_pipeline_prospects(), daily at 03:15 UTC
-- = 05:15 SAST). It is kept, not deleted: the board's "Removed" list shows it
-- and can put it back. Any real activity on a removed card brings it back on
-- its own (the trigger below): an edit, a note, a phase change, or the person
-- booking or applying again through the lead intake. A same-column reorder
-- doesn't touch updated_at, so it never counts as activity.
--
-- pipeline_notes is a timestamped progress log per card, separate from the
-- free-text notes field (which the lead intake still appends to). Adding a
-- note counts as an update, so it resets the 21 days. Admin only, like the
-- board.
ALTER TABLE public.pipeline_prospects ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP WITH TIME ZONE;

CREATE OR REPLACE FUNCTION public._pipeline_unarchive_on_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.archived_at IS NOT NULL
     AND NEW.archived_at IS NOT DISTINCT FROM OLD.archived_at
     AND NEW.updated_at > OLD.updated_at THEN
    NEW.archived_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS pipeline_unarchive_on_activity ON public.pipeline_prospects;
CREATE TRIGGER pipeline_unarchive_on_activity
  BEFORE UPDATE ON public.pipeline_prospects
  FOR EACH ROW EXECUTE FUNCTION public._pipeline_unarchive_on_activity();

CREATE TABLE IF NOT EXISTS public.pipeline_notes (
  id BIGSERIAL PRIMARY KEY,
  prospect_id BIGINT NOT NULL REFERENCES public.pipeline_prospects(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 2000),
  author_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS pipeline_notes_prospect_idx ON public.pipeline_notes (prospect_id, created_at);
ALTER TABLE public.pipeline_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admins manage pipeline notes" ON public.pipeline_notes;
CREATE POLICY "admins manage pipeline notes"
  ON public.pipeline_notes FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public._pipeline_note_touches_card()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.pipeline_prospects SET updated_at = timezone('utc'::text, now()) WHERE id = NEW.prospect_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS pipeline_note_touches_card ON public.pipeline_notes;
CREATE TRIGGER pipeline_note_touches_card
  AFTER INSERT ON public.pipeline_notes
  FOR EACH ROW EXECUTE FUNCTION public._pipeline_note_touches_card();

CREATE OR REPLACE FUNCTION public.archive_stale_pipeline_prospects()
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_n INT;
BEGIN
  UPDATE public.pipeline_prospects
  SET archived_at = timezone('utc'::text, now())
  WHERE archived_at IS NULL
    AND updated_at < timezone('utc'::text, now()) - interval '21 days';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.archive_stale_pipeline_prospects() FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'archive-stale-pipeline-daily') THEN
    PERFORM cron.unschedule('archive-stale-pipeline-daily');
  END IF;
END $$;
SELECT cron.schedule(
  'archive-stale-pipeline-daily',
  '15 3 * * *',
  $$ SELECT public.archive_stale_pipeline_prospects(); $$
);

-- 2026-11-08: LEAD CHANNEL TAG - where the person first heard about Hacking
-- Hub (TikTok, YouTube, LinkedIn, Referral...), picked from a fixed list in
-- the board (LEAD_CHANNELS in SalesPipelineBoard.jsx). Separate from
-- `source`, which records how they came in (the Elite application form or a
-- call booking). No CHECK constraint, so a new channel only needs adding to
-- that list. Cards whose source already said TikTok are tagged once here.
ALTER TABLE public.pipeline_prospects ADD COLUMN IF NOT EXISTS lead_channel TEXT;
UPDATE public.pipeline_prospects SET lead_channel = 'TikTok'
WHERE lead_channel IS NULL AND source ILIKE '%tiktok%';

-- 2026-11-08: REACH-OUT DATE - the day the founder plans to contact a
-- Contacted or Ready to Join card again. Shown on the card (red when
-- overdue), listed under "Needs you" in the 06:00 daily report
-- (pipeline_followups_due(), daily-report-email), and only counted for those
-- two phases. A card with a reach-out date isn't taken off the board until
-- 21 days after that date, even if nothing else changed.
ALTER TABLE public.pipeline_prospects ADD COLUMN IF NOT EXISTS follow_up_on DATE;

CREATE OR REPLACE FUNCTION public.archive_stale_pipeline_prospects()
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_n INT;
BEGIN
  UPDATE public.pipeline_prospects
  SET archived_at = timezone('utc'::text, now())
  WHERE archived_at IS NULL
    AND updated_at < timezone('utc'::text, now()) - interval '21 days'
    AND (follow_up_on IS NULL
         OR phase NOT IN ('Contacted', 'Ready to Join')
         OR follow_up_on < (now() AT TIME ZONE 'Africa/Johannesburg')::date - 21);
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.archive_stale_pipeline_prospects() FROM PUBLIC, anon, authenticated;

-- For the daily report: reach-outs due on or before p_day (SAST), oldest
-- first, with the latest progress note for context. Service role only.
CREATE OR REPLACE FUNCTION public.pipeline_followups_due(p_day DATE)
RETURNS JSONB
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'name', p.full_name,
    'phase', p.phase,
    'follow_up_on', p.follow_up_on,
    'days_overdue', p_day - p.follow_up_on,
    'last_note', (SELECT n.body FROM public.pipeline_notes n WHERE n.prospect_id = p.id ORDER BY n.created_at DESC LIMIT 1)
  ) ORDER BY p.follow_up_on, p.full_name), '[]'::jsonb)
  FROM public.pipeline_prospects p
  WHERE p.archived_at IS NULL
    AND p.phase IN ('Contacted', 'Ready to Join')
    AND p.follow_up_on IS NOT NULL
    AND p.follow_up_on <= p_day;
$$;
REVOKE EXECUTE ON FUNCTION public.pipeline_followups_due(DATE) FROM PUBLIC, anon, authenticated;

-- 2026-11-08: LINKEDIN LINK on a card. Typed in by the founder, or picked
-- out of the card's notes: the Elite application form's "Linkedin Profile
-- URL" answer lands in notes through the lead intake, and the trigger below
-- copies the first real linkedin.com link it finds there into linkedin_url
-- when a card is created, or when its notes change and it has no link yet.
-- Answers that aren't a LinkedIn link (blank, a phone number) are ignored.
-- No change to the Google Form script or the intake function is needed.
ALTER TABLE public.pipeline_prospects ADD COLUMN IF NOT EXISTS linkedin_url TEXT;

CREATE OR REPLACE FUNCTION public._extract_linkedin_url(p_text TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
AS $$
  SELECT 'https://' || regexp_replace(m[1], '^(https?://)', '', 'i')
  FROM regexp_match(COALESCE(p_text, ''), '((?:https?://)?(?:[a-z]{2,3}\.)?linkedin\.com/[A-Za-z0-9_\-/%.]+)', 'i') AS m
  WHERE m IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public._pipeline_fill_linkedin()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NULLIF(btrim(NEW.linkedin_url), '') IS NULL
     AND (TG_OP = 'INSERT' OR NEW.notes IS DISTINCT FROM OLD.notes) THEN
    NEW.linkedin_url := public._extract_linkedin_url(NEW.notes);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS pipeline_fill_linkedin ON public.pipeline_prospects;
CREATE TRIGGER pipeline_fill_linkedin
  BEFORE INSERT OR UPDATE ON public.pipeline_prospects
  FOR EACH ROW EXECUTE FUNCTION public._pipeline_fill_linkedin();

-- One-time fill for cards that already have a link in their notes. Doesn't
-- touch updated_at, so nothing comes back from Removed or resets its 21 days.
UPDATE public.pipeline_prospects
SET linkedin_url = public._extract_linkedin_url(notes)
WHERE NULLIF(btrim(linkedin_url), '') IS NULL
  AND public._extract_linkedin_url(notes) IS NOT NULL;

-- 2026-11-08: COLUMN-MOVE HISTORY, for the Sales Pipeline stats (time to
-- first contact, lead to join). Every new card and every change of phase is
-- recorded by the trigger below, whoever or whatever made it (a drag, the
-- edit form, the lead intake). A same-column reorder isn't a change. Nothing
-- was recorded before this, so timings only cover cards from 8 November 2026
-- onwards; counts and conversion use the cards themselves. Admin only.
CREATE TABLE IF NOT EXISTS public.pipeline_phase_changes (
  id BIGSERIAL PRIMARY KEY,
  prospect_id BIGINT NOT NULL REFERENCES public.pipeline_prospects(id) ON DELETE CASCADE,
  from_phase TEXT,
  to_phase TEXT NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS pipeline_phase_changes_prospect_idx ON public.pipeline_phase_changes (prospect_id, changed_at);
ALTER TABLE public.pipeline_phase_changes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admins read pipeline phase changes" ON public.pipeline_phase_changes;
CREATE POLICY "admins read pipeline phase changes"
  ON public.pipeline_phase_changes FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public._pipeline_record_phase_change()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.pipeline_phase_changes (prospect_id, from_phase, to_phase, changed_at)
    VALUES (NEW.id, NULL, NEW.phase, NEW.created_at);
  ELSIF NEW.phase IS DISTINCT FROM OLD.phase THEN
    INSERT INTO public.pipeline_phase_changes (prospect_id, from_phase, to_phase)
    VALUES (NEW.id, OLD.phase, NEW.phase);
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS pipeline_record_phase_change ON public.pipeline_prospects;
CREATE TRIGGER pipeline_record_phase_change
  AFTER INSERT OR UPDATE OF phase ON public.pipeline_prospects
  FOR EACH ROW EXECUTE FUNCTION public._pipeline_record_phase_change();
