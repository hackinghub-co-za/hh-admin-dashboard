-- Hacking Hub Admin Dashboard - Weekly Updates (2026-11-07)
-- Run this in the Supabase SQL Editor after 111. Safe to re-run.
--
-- Every week, the first time an active member signs in from Sunday onwards,
-- the portal asks four questions before it opens (WeeklyUpdateGate.jsx):
-- what they did this week, what they'll work on next week, any major
-- achievements, any major blockers. The first two are required; the other
-- two can be "Nothing this week" / "No blockers" (stored as NULL).
--
-- A week is keyed by its Sunday (week_ending, SAST): the update covers
-- Monday to that Sunday, and can be filled in from that Sunday until the
-- next Saturday. A week that was never answered isn't carried over. The
-- first week asked is the one ending Sunday 8 November 2026.
--
-- Who is asked: member_profiles status Active or Active (Permanent) who
-- finished onboarding before that week's Sunday (onboarded_at; members with
-- none predate it) and aren't on a Take a break (14 days at most). Never
-- staff (admin, community manager, mentor role) or inactivity_exempt
-- members (the mentors who aren't a role).
--
-- Answers can be personal (blockers), so they are founder-only: members
-- reach the table only through the two "my" RPCs, and get_weekly_updates()
-- checks is_admin().

CREATE TABLE IF NOT EXISTS public.weekly_updates (
  id BIGSERIAL PRIMARY KEY,
  member_email TEXT NOT NULL,
  week_ending DATE NOT NULL,
  did_this_week TEXT NOT NULL CHECK (char_length(btrim(did_this_week)) BETWEEN 10 AND 600),
  next_week TEXT NOT NULL CHECK (char_length(btrim(next_week)) BETWEEN 10 AND 600),
  achievement TEXT CHECK (achievement IS NULL OR char_length(btrim(achievement)) BETWEEN 1 AND 600),
  blocker TEXT CHECK (blocker IS NULL OR char_length(btrim(blocker)) BETWEEN 1 AND 600),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (member_email, week_ending)
);
CREATE INDEX IF NOT EXISTS weekly_updates_week_idx ON public.weekly_updates (week_ending);
ALTER TABLE public.weekly_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins read weekly updates" ON public.weekly_updates;
CREATE POLICY "admins read weekly updates"
  ON public.weekly_updates FOR SELECT
  USING (public.is_admin(auth.uid()));

-- The Sunday on or before a SAST date.
CREATE OR REPLACE FUNCTION public._week_ending(p_day DATE)
RETURNS DATE
LANGUAGE sql IMMUTABLE
AS $$
  SELECT p_day - EXTRACT(DOW FROM p_day)::INT;
$$;

CREATE OR REPLACE FUNCTION public._sast_today()
RETURNS DATE
LANGUAGE sql STABLE
AS $$
  SELECT (now() AT TIME ZONE 'Africa/Johannesburg')::date;
$$;

-- Whether this member is asked at all for the week ending p_week.
CREATE OR REPLACE FUNCTION public._weekly_update_eligible(p_email TEXT, p_week DATE)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.member_profiles mp
    WHERE p_week >= DATE '2026-11-08' -- first Sunday of Weekly Updates
      AND mp.email = lower(p_email)
      AND mp.status IN ('Active', 'Active (Permanent)')
      AND NOT COALESCE(mp.inactivity_exempt, false)
      AND (mp.onboarded_at IS NULL OR (mp.onboarded_at AT TIME ZONE 'Africa/Johannesburg')::date < p_week)
      AND (mp.break_started_at IS NULL OR mp.break_started_at < now() - interval '14 days')
      AND NOT EXISTS (
        SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id = p.id
        WHERE lower(u.email) = lower(p_email) AND p.role IN ('admin', 'community_manager', 'mentor')
      )
  );
$$;
REVOKE EXECUTE ON FUNCTION public._weekly_update_eligible(TEXT, DATE) FROM PUBLIC, anon, authenticated;

-- Consecutive answered weeks ending at p_week (0 if p_week isn't answered).
CREATE OR REPLACE FUNCTION public._weekly_update_streak(p_email TEXT, p_week DATE)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE
AS $$
DECLARE
  v_n INT := 0;
  v_week DATE := p_week;
BEGIN
  WHILE EXISTS (SELECT 1 FROM public.weekly_updates WHERE member_email = lower(p_email) AND week_ending = v_week) LOOP
    v_n := v_n + 1;
    v_week := v_week - 7;
  END LOOP;
  RETURN v_n;
END;
$$;
REVOKE EXECUTE ON FUNCTION public._weekly_update_streak(TEXT, DATE) FROM PUBLIC, anon, authenticated;

-- For the gate: is this week's update still owed? Returns the week too, so
-- the card can show "Week of 2 – 8 Nov".
CREATE OR REPLACE FUNCTION public.get_my_weekly_update_status()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_week DATE := public._week_ending(public._sast_today());
BEGIN
  RETURN jsonb_build_object(
    'week_ending', v_week,
    'due', public._weekly_update_eligible(v_email, v_week)
      AND NOT EXISTS (SELECT 1 FROM public.weekly_updates WHERE member_email = v_email AND week_ending = v_week)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_my_weekly_update(p_did TEXT, p_next TEXT, p_achievement TEXT DEFAULT NULL, p_blocker TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_week DATE := public._week_ending(public._sast_today());
  v_did TEXT := btrim(COALESCE(p_did, ''));
  v_next TEXT := btrim(COALESCE(p_next, ''));
  v_ach TEXT := NULLIF(btrim(COALESCE(p_achievement, '')), '');
  v_block TEXT := NULLIF(btrim(COALESCE(p_blocker, '')), '');
BEGIN
  IF NOT public._weekly_update_eligible(v_email, v_week) THEN
    RAISE EXCEPTION 'Weekly updates are only for active members.';
  END IF;
  IF char_length(v_did) < 10 THEN RAISE EXCEPTION 'Tell us what you did this week (a sentence is enough).'; END IF;
  IF char_length(v_next) < 10 THEN RAISE EXCEPTION 'Add what you will work on next week.'; END IF;
  IF greatest(char_length(v_did), char_length(v_next), char_length(COALESCE(v_ach, '')), char_length(COALESCE(v_block, ''))) > 600 THEN
    RAISE EXCEPTION 'Each answer can be up to 600 characters.';
  END IF;

  INSERT INTO public.weekly_updates (member_email, week_ending, did_this_week, next_week, achievement, blocker)
  VALUES (v_email, v_week, v_did, v_next, v_ach, v_block)
  ON CONFLICT (member_email, week_ending) DO NOTHING;

  RETURN jsonb_build_object('week_ending', v_week, 'streak', public._weekly_update_streak(v_email, v_week));
END;
$$;

-- Founder-only responses page: every answer for one week, who is still to
-- answer, and the headline numbers.
CREATE OR REPLACE FUNCTION public.get_weekly_updates(p_week_ending DATE DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE
AS $$
DECLARE
  v_week DATE := public._week_ending(COALESCE(p_week_ending, public._sast_today()));
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Admins only.';
  END IF;
  RETURN (
    WITH eligible AS (
      SELECT mp.email, NULLIF(btrim(mp.full_name), '') AS full_name, mp.location
      FROM public.member_profiles mp
      WHERE public._weekly_update_eligible(mp.email, v_week)
    ),
    answers AS (
      SELECT w.*, COALESCE(NULLIF(btrim(mp.full_name), ''), w.member_email) AS full_name, mp.location
      FROM public.weekly_updates w
      LEFT JOIN public.member_profiles mp ON mp.email = w.member_email
      WHERE w.week_ending = v_week
    )
    SELECT jsonb_build_object(
      'week_ending', v_week,
      'eligible', (SELECT count(*) FROM eligible),
      'submitted', (SELECT count(*) FROM answers),
      'with_blocker', (SELECT count(*) FROM answers WHERE blocker IS NOT NULL),
      'with_achievement', (SELECT count(*) FROM answers WHERE achievement IS NOT NULL),
      'previous_rate', (
        SELECT CASE WHEN e.n = 0 THEN NULL ELSE round(100.0 * s.n / e.n) END
        FROM (SELECT count(*) AS n FROM public.member_profiles mp WHERE public._weekly_update_eligible(mp.email, v_week - 7)) e,
             (SELECT count(*) AS n FROM public.weekly_updates WHERE week_ending = v_week - 7) s
      ),
      'answers', COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'id', a.id, 'email', a.member_email, 'name', a.full_name, 'location', a.location,
          'did', a.did_this_week, 'next', a.next_week, 'achievement', a.achievement, 'blocker', a.blocker,
          'submitted_at', a.created_at
        ) ORDER BY (a.blocker IS NULL), a.created_at DESC) FROM answers a), '[]'::jsonb),
      'missing', COALESCE((SELECT jsonb_agg(jsonb_build_object('email', e.email, 'name', COALESCE(e.full_name, e.email)) ORDER BY COALESCE(e.full_name, e.email))
          FROM eligible e WHERE NOT EXISTS (SELECT 1 FROM answers a WHERE a.member_email = e.email)), '[]'::jsonb)
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_weekly_update_status() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.submit_my_weekly_update(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_weekly_updates(DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_weekly_update_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_my_weekly_update(TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_weekly_updates(DATE) TO authenticated;

-- For Monday's 06:00 daily report (daily-report-email): the week that ended
-- the day before - how many answered, every blocker and every achievement.
-- Service role only.
CREATE OR REPLACE FUNCTION public.weekly_updates_digest(p_week_ending DATE)
RETURNS JSONB
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  WITH answers AS (
    SELECT w.*, COALESCE(NULLIF(btrim(mp.full_name), ''), w.member_email) AS full_name
    FROM public.weekly_updates w
    LEFT JOIN public.member_profiles mp ON mp.email = w.member_email
    WHERE w.week_ending = p_week_ending
  )
  SELECT jsonb_build_object(
    'week_ending', p_week_ending,
    'eligible', (SELECT count(*) FROM public.member_profiles mp WHERE public._weekly_update_eligible(mp.email, p_week_ending)),
    'submitted', (SELECT count(*) FROM answers),
    'blockers', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', full_name, 'text', blocker) ORDER BY created_at) FROM answers WHERE blocker IS NOT NULL), '[]'::jsonb),
    'achievements', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', full_name, 'text', achievement) ORDER BY created_at) FROM answers WHERE achievement IS NOT NULL), '[]'::jsonb)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.weekly_updates_digest(DATE) FROM PUBLIC, anon, authenticated;
