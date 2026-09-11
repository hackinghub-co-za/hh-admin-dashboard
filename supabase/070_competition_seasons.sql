-- Hacking Hub Admin Dashboard - Competition Seasons
-- Run this in the Supabase SQL Editor after 002-069 have already been
-- applied. Safe to re-run: every statement is idempotent.
--
-- competition_standings (015_competition_standings.sql) has never had a
-- notion of a competition PERIOD at all - rooms_completed/days_logged just
-- accumulate forever, and "Q3 2026 Community CTF Sprint" - its title,
-- dates, and prizes - has only ever existed as a hardcoded object in
-- MemberPortal.jsx (`currentCompetition`), not a real row anywhere.
-- Flagged by QA (QA_FINDINGS.md, 2026-09-11) as a real gap with a concrete
-- deadline: Q3 ends 2026-10-23, and whoever updates the hardcoded object
-- for Q4 would find the leaderboard still showing Q3's cumulative totals,
-- silently changing who "wins" each quarter unless someone remembers to
-- manually zero the table first.
--
-- Deliberately NOT a `competition_id` column added to competition_standings
-- (and daily_room_logs, submit_daily_room_log, review_daily_room_log,
-- correct_room_log_review, rsvp_for_competition, etc.) - that would touch
-- every one of those already-hardened functions (double-credit/concurrency
-- guards added in an earlier QA pass this same day) and change
-- competition_standings' primary key shape, for a real but avoidable risk
-- of reintroducing a bug in code that's already been carefully fixed twice
-- today. Instead: a new `competitions` table is the single source of truth
-- for "what's running right now" (title/dates/prizes, replacing the
-- hardcoded object), and starting a new one archives a lossless JSON
-- snapshot of the just-ended competition_standings onto the row that just
-- finished, then clears competition_standings for a fresh start - members
-- RSVP again for the new quarter, same "Yes I'm In" click they'd have done
-- anyway. daily_room_logs is untouched by a reset: it's already a
-- permanent, log_date-scoped audit trail, not a running tally, so there's
-- nothing on it that needs resetting.

CREATE TABLE IF NOT EXISTS public.competitions (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  platform TEXT,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL CHECK (end_date >= start_date),
  -- [{ "place": "1st", "reward": "Any certification voucher, up to R6,000", "amount": 6000 }, ...]
  -- `amount` is the real rand value behind the "up to" voucher tier - the
  -- only part the tie-splitting math (computeCompetitionPrizes in
  -- MemberPortal.jsx) actually reads; `reward` is display text only.
  prizes JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_current BOOLEAN NOT NULL DEFAULT false,
  -- Filled in only once this row is archived (see start_new_competition
  -- below) - a snapshot of every competition_standings row exactly as it
  -- stood the moment the next competition started, so history is never
  -- lost even though the live table gets cleared for the next quarter.
  standings_snapshot JSONB,
  archived_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

-- At most one competition is ever "current" at a time.
CREATE UNIQUE INDEX IF NOT EXISTS idx_competitions_one_current
  ON public.competitions (is_current) WHERE is_current;

ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;

-- Every approved member can see the current competition's details (and,
-- incidentally, past ones' archived standings too, if the admin UI ever
-- wants to surface a Hall of Fame from this same table later) - same
-- is_member_allowed() gate as competition_standings' own read policy.
DROP POLICY IF EXISTS "members read competitions" ON public.competitions;
CREATE POLICY "members read competitions"
  ON public.competitions FOR SELECT
  TO authenticated
  USING (public.is_member_allowed(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "staff manage competitions" ON public.competitions;
CREATE POLICY "staff manage competitions"
  ON public.competitions FOR ALL
  USING (public.is_admin(auth.uid()) OR public.is_community_manager(auth.uid()));

-- Seeds the real, currently-running Q3 2026 competition as an actual row -
-- exactly what MemberPortal.jsx's hardcoded `currentCompetition` object
-- already says, so switching the frontend over to read from here changes
-- nothing visible until an admin actually starts a new one. Guarded on "no
-- current competition exists yet" rather than a title match, so this only
-- ever fires once, on the first apply.
INSERT INTO public.competitions (title, platform, description, start_date, end_date, prizes, is_current)
SELECT
  'Q3 2026 Community CTF Sprint',
  'TryHackMe',
  'Complete as many rooms as you can in the HH TryHackMe team space this quarter. Standings are ranked by rooms completed — top 3 finishers win prizes. A tie for a prize-winning spot splits that combined prize money evenly among everyone tied.',
  '2026-08-31',
  '2026-10-23',
  '[
    {"place": "1st", "reward": "Any certification voucher, up to R6,000", "amount": 6000},
    {"place": "2nd", "reward": "Any certification voucher, up to R3,000", "amount": 3000},
    {"place": "3rd", "reward": "Any certification voucher, up to R1,000", "amount": 1000}
  ]'::jsonb,
  true
WHERE NOT EXISTS (SELECT 1 FROM public.competitions WHERE is_current = true);

-- Archives the current competition (if one exists) with a full standings
-- snapshot, clears competition_standings for a fresh quarter, and starts
-- the new one as current - one atomic transaction, so a failure partway
-- through never leaves the app with zero "current" competitions or a
-- lost snapshot. Same admin/community_manager pairing every other
-- Competitions-area action in this project uses.
CREATE OR REPLACE FUNCTION public.start_new_competition(
  p_title TEXT,
  p_platform TEXT,
  p_description TEXT,
  p_start_date DATE,
  p_end_date DATE,
  p_prizes JSONB
)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_new_id BIGINT;
  v_snapshot JSONB;
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_community_manager(auth.uid())) THEN
    RAISE EXCEPTION 'Only admins can start a new competition.';
  END IF;
  IF trim(coalesce(p_title, '')) = '' THEN
    RAISE EXCEPTION 'Give the competition a title.';
  END IF;
  IF p_start_date IS NULL OR p_end_date IS NULL OR p_end_date < p_start_date THEN
    RAISE EXCEPTION 'End date must be on or after the start date.';
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'email', email,
    'memberName', member_name,
    'roomsCompleted', rooms_completed,
    'daysLogged', days_logged,
    'optedOut', opted_out,
    'rsvpedAt', rsvped_at
  ) ORDER BY rooms_completed DESC, days_logged DESC)
  INTO v_snapshot
  FROM public.competition_standings;

  UPDATE public.competitions
  SET standings_snapshot = coalesce(v_snapshot, '[]'::jsonb),
      is_current = false,
      archived_at = timezone('utc'::text, now())
  WHERE is_current = true;

  -- Fresh start for the new quarter - members RSVP again, same "Yes I'm
  -- In" click every quarter has always needed anyway. daily_room_logs is
  -- deliberately untouched - see this file's header comment.
  DELETE FROM public.competition_standings;

  INSERT INTO public.competitions (title, platform, description, start_date, end_date, prizes, is_current)
  VALUES (trim(p_title), p_platform, p_description, p_start_date, p_end_date, coalesce(p_prizes, '[]'::jsonb), true)
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.start_new_competition(TEXT, TEXT, TEXT, DATE, DATE, JSONB) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.start_new_competition(TEXT, TEXT, TEXT, DATE, DATE, JSONB) FROM PUBLIC, anon;
