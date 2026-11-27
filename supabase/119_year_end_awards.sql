-- Hacking Hub Admin Dashboard - HH Year-End Awards
-- Run after 002-118. Safe to re-run: every statement is idempotent.
--
-- Members vote once per category for the member who inspired, helped or
-- made them laugh this year, on the Competitions tab. 13 categories are
-- voted; 6 more are decided from portal data, so nobody can campaign for
-- them. The category list lives in src/lib/yearEndAwardsData.js; the voted
-- ids are repeated in _award_voted_categories() below so the server can
-- check them.
--
-- Rules, enforced here rather than in the browser:
-- - Only members with portal access vote. Staff (any profiles.role other
--   than 'member') can't vote and can't be voted for, except that Mentor of
--   the Year is only for the four mentors.
-- - One vote per category, changeable or removable until voting closes.
-- - You can't vote for yourself, and only for current (not Left) members.
-- - Votes are private. Members only ever read their own; the founder sees
--   totals on the admin Year-End Awards tab.
-- - Voting is open from opens_on to closes_on (SAST, inclusive), set on
--   that tab. Winners are shown to members once results_published is on.
-- Nominees are sent to the browser with an opaque key (md5 of the email),
-- never the email itself.

CREATE TABLE IF NOT EXISTS public.award_settings (
  award_year INTEGER PRIMARY KEY,
  opens_on DATE NOT NULL,
  closes_on DATE NOT NULL,
  announce_on DATE NOT NULL,
  results_published BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  CHECK (closes_on >= opens_on)
);
ALTER TABLE public.award_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admins manage award settings" ON public.award_settings;
CREATE POLICY "admins manage award settings" ON public.award_settings
  FOR ALL USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

INSERT INTO public.award_settings (award_year, opens_on, closes_on, announce_on)
VALUES (2026, '2026-12-01', '2026-12-14', '2026-12-18')
ON CONFLICT (award_year) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.award_votes (
  id BIGSERIAL PRIMARY KEY,
  award_year INTEGER NOT NULL,
  category TEXT NOT NULL,
  voter_email TEXT NOT NULL,
  nominee_key TEXT NOT NULL,
  nominee_email TEXT,
  nominee_name TEXT NOT NULL,
  reason TEXT CHECK (reason IS NULL OR char_length(reason) <= 300),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (award_year, category, voter_email)
);
ALTER TABLE public.award_votes ENABLE ROW LEVEL SECURITY;
-- Admin read only; members go through the functions below.
DROP POLICY IF EXISTS "admins read award votes" ON public.award_votes;
CREATE POLICY "admins read award votes" ON public.award_votes
  FOR SELECT USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public._award_voted_categories()
RETURNS TEXT[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['newcomer','funny','helpful','hype','comeback','glowup','linkedin',
               'improved','grinder','buddy','story','project','mentor'];
$$;

CREATE OR REPLACE FUNCTION public._award_mentors()
RETURNS TEXT[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['Nonhlanhla','Nokulunga','Momelezi','Tshepo'];
$$;

-- Current members who can be voted for (and who can vote): not Left, not
-- staff. Some staff also have a member profile under a personal email, so a
-- profile whose name matches a staff account, or any @hackinghub.co.za
-- address, counts as staff too.
CREATE OR REPLACE FUNCTION public._award_members()
RETURNS TABLE (email TEXT, name TEXT, headshot_url TEXT, nominee_key TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.email,
         COALESCE(NULLIF(btrim(m.full_name), ''), split_part(m.email, '@', 1)),
         m.headshot_url,
         'm:' || md5(m.email)
  FROM public.member_profiles m
  WHERE m.status <> 'Left'
    AND m.email NOT LIKE '%@hackinghub.co.za'
    AND NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.role <> 'member'
        AND (lower(p.email) = m.email
             OR (NULLIF(btrim(m.full_name), '') IS NOT NULL AND lower(btrim(p.full_name)) = lower(btrim(m.full_name))))
    );
$$;
REVOKE EXECUTE ON FUNCTION public._award_members() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._award_year() RETURNS INTEGER LANGUAGE sql STABLE AS $$
  SELECT extract(year FROM (now() AT TIME ZONE 'Africa/Johannesburg'))::int;
$$;

-- Everything the Competitions tab needs: dates, phase, nominees, mentors and
-- the caller's own votes.
CREATE OR REPLACE FUNCTION public.get_award_ballot()
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_year INTEGER := public._award_year();
  v_today DATE := (now() AT TIME ZONE 'Africa/Johannesburg')::date;
  s public.award_settings%ROWTYPE;
  v_is_member BOOLEAN;
BEGIN
  IF v_email IS NULL OR NOT public.is_member_allowed(v_email) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  SELECT * INTO s FROM public.award_settings WHERE award_year = v_year;
  IF NOT FOUND THEN RETURN jsonb_build_object('phase', 'none'); END IF;
  v_is_member := EXISTS (SELECT 1 FROM public._award_members() a WHERE a.email = v_email);

  RETURN jsonb_build_object(
    'year', v_year,
    'opens_on', s.opens_on,
    'closes_on', s.closes_on,
    'announce_on', s.announce_on,
    'phase', CASE
      WHEN s.results_published THEN 'results'
      WHEN v_today < s.opens_on THEN 'upcoming'
      WHEN v_today <= s.closes_on THEN 'open'
      ELSE 'closed' END,
    'can_vote', v_is_member,
    'nominees', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('key', a.nominee_key, 'name', a.name, 'headshot', a.headshot_url) ORDER BY lower(a.name))
      FROM public._award_members() a WHERE a.email <> v_email), '[]'::jsonb),
    'mentors', to_jsonb(public._award_mentors()),
    'my_votes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('category', v.category, 'nominee_key', v.nominee_key, 'nominee_name', v.nominee_name, 'reason', v.reason))
      FROM public.award_votes v WHERE v.award_year = v_year AND v.voter_email = v_email), '[]'::jsonb)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_award_ballot() TO authenticated;

CREATE OR REPLACE FUNCTION public.cast_award_vote(p_category TEXT, p_nominee_key TEXT, p_reason TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_year INTEGER := public._award_year();
  v_today DATE := (now() AT TIME ZONE 'Africa/Johannesburg')::date;
  s public.award_settings%ROWTYPE;
  v_nominee_email TEXT;
  v_nominee_name TEXT;
  v_reason TEXT := NULLIF(btrim(COALESCE(p_reason, '')), '');
BEGIN
  IF v_email IS NULL OR NOT EXISTS (SELECT 1 FROM public._award_members() a WHERE a.email = v_email) THEN
    RAISE EXCEPTION 'Only members can vote in the Year-End Awards.';
  END IF;
  SELECT * INTO s FROM public.award_settings WHERE award_year = v_year;
  IF NOT FOUND OR s.results_published OR v_today < s.opens_on OR v_today > s.closes_on THEN
    RAISE EXCEPTION 'Voting isn''t open right now.';
  END IF;
  IF NOT (p_category = ANY (public._award_voted_categories())) THEN
    RAISE EXCEPTION 'That category isn''t voted for.';
  END IF;
  IF v_reason IS NOT NULL AND char_length(v_reason) > 300 THEN
    RAISE EXCEPTION 'Keep your reason to 300 characters.';
  END IF;

  IF p_category = 'mentor' THEN
    IF NOT (substr(p_nominee_key, 8) = ANY (public._award_mentors())) OR left(p_nominee_key, 7) <> 'mentor:' THEN
      RAISE EXCEPTION 'Pick one of the mentors.';
    END IF;
    v_nominee_name := substr(p_nominee_key, 8);
  ELSE
    SELECT a.email, a.name INTO v_nominee_email, v_nominee_name FROM public._award_members() a WHERE a.nominee_key = p_nominee_key;
    IF v_nominee_email IS NULL THEN RAISE EXCEPTION 'That member can''t be voted for.'; END IF;
    IF v_nominee_email = v_email THEN RAISE EXCEPTION 'You can''t vote for yourself.'; END IF;
  END IF;

  INSERT INTO public.award_votes (award_year, category, voter_email, nominee_key, nominee_email, nominee_name, reason)
  VALUES (v_year, p_category, v_email, p_nominee_key, v_nominee_email, v_nominee_name, v_reason)
  ON CONFLICT (award_year, category, voter_email) DO UPDATE
    SET nominee_key = EXCLUDED.nominee_key, nominee_email = EXCLUDED.nominee_email,
        nominee_name = EXCLUDED.nominee_name, reason = EXCLUDED.reason, updated_at = now();
END;
$$;
GRANT EXECUTE ON FUNCTION public.cast_award_vote(TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.remove_award_vote(p_category TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_year INTEGER := public._award_year();
  v_today DATE := (now() AT TIME ZONE 'Africa/Johannesburg')::date;
  s public.award_settings%ROWTYPE;
BEGIN
  SELECT * INTO s FROM public.award_settings WHERE award_year = v_year;
  IF NOT FOUND OR s.results_published OR v_today < s.opens_on OR v_today > s.closes_on THEN
    RAISE EXCEPTION 'Voting isn''t open right now.';
  END IF;
  DELETE FROM public.award_votes WHERE award_year = v_year AND category = p_category AND voter_email = v_email;
END;
$$;
GRANT EXECUTE ON FUNCTION public.remove_award_vote(TEXT) TO authenticated;

-- The 6 data awards, worked out live. Top p_limit per category, staff and
-- members who have left excluded.
CREATE OR REPLACE FUNCTION public._award_data_leaders(p_year INTEGER, p_limit INTEGER DEFAULT 3)
RETURNS TABLE (category TEXT, rank INTEGER, name TEXT, score NUMERIC, unit TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH members AS (SELECT email, name FROM public._award_members()),
  certs AS (
    SELECT 'certs'::text AS category, m.name, count(*)::numeric AS score, 'certs passed'::text AS unit
    FROM public.cert_calendar c JOIN members m ON m.email = lower(c.member_email)
    WHERE c.result = 'Passed' AND extract(year FROM c.date) = p_year
    GROUP BY m.name
  ),
  consistent AS (
    SELECT 'consistent', m.name, round(s.total_minutes / 60.0, 1), 'hours studied'
    FROM public.study_leaderboard s JOIN members m ON m.email = lower(s.email)
    WHERE NOT s.opted_out AND s.eliminated_at IS NULL AND s.total_minutes > 0
  ),
  hubscore AS (
    SELECT 'hubscore', m.name, b.total_points::numeric, 'points'
    FROM public._hub_score_breakdown(NULL) b JOIN members m ON m.email = b.member_email
    WHERE b.total_points > 0
  ),
  days AS (
    SELECT DISTINCT lower(member_email) AS email, (logged_at AT TIME ZONE 'Africa/Johannesburg')::date AS d
    FROM public.study_sessions
    WHERE extract(year FROM (logged_at AT TIME ZONE 'Africa/Johannesburg')) = p_year
  ),
  runs AS (
    SELECT email, count(*) AS len
    FROM (SELECT email, d - (row_number() OVER (PARTITION BY email ORDER BY d))::int AS grp FROM days) x
    GROUP BY email, grp
  ),
  streak AS (
    SELECT 'streak', m.name, max(r.len)::numeric, 'days in a row'
    FROM runs r JOIN members m ON m.email = r.email GROUP BY m.name
  ),
  interviews AS (
    SELECT 'interviews', m.name, mp.interviews_had::numeric, 'interviews'
    FROM public.member_profiles mp JOIN members m ON m.email = mp.email
    WHERE COALESCE(mp.interviews_had, 0) > 0
  ),
  events AS (
    SELECT 'events', m.name, count(*)::numeric, 'event RSVPs'
    FROM public.event_rsvps r
    JOIN public.community_events e ON e.id = r.event_id
    JOIN members m ON m.email = lower(r.email)
    WHERE extract(year FROM e.date::date) = p_year
    GROUP BY m.name
  ),
  all_rows AS (
    SELECT * FROM certs UNION ALL SELECT * FROM consistent UNION ALL SELECT * FROM hubscore
    UNION ALL SELECT * FROM streak UNION ALL SELECT * FROM interviews UNION ALL SELECT * FROM events
  ),
  ranked AS (
    SELECT category, (RANK() OVER (PARTITION BY category ORDER BY score DESC))::int AS rank, name, score, unit FROM all_rows
  )
  SELECT category, rank, name, score, unit FROM ranked WHERE rank <= p_limit ORDER BY category, rank, name;
$$;
REVOKE EXECUTE ON FUNCTION public._award_data_leaders(INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;

-- Admin: turnout, the vote totals per category (with reasons), and the data
-- award leaders.
CREATE OR REPLACE FUNCTION public.get_award_results(p_year INTEGER DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_year INTEGER := COALESCE(p_year, public._award_year());
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  RETURN jsonb_build_object(
    'year', v_year,
    'voters', (SELECT count(DISTINCT voter_email) FROM public.award_votes WHERE award_year = v_year),
    'eligible_voters', (SELECT count(*) FROM public._award_members()),
    'votes', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('category', category, 'name', nominee_name, 'votes', votes, 'reasons', reasons) ORDER BY category, votes DESC, nominee_name)
      FROM (
        SELECT category, nominee_name, count(*) AS votes,
               COALESCE(jsonb_agg(reason) FILTER (WHERE reason IS NOT NULL), '[]'::jsonb) AS reasons
        FROM public.award_votes WHERE award_year = v_year
        GROUP BY category, nominee_key, nominee_name
      ) t), '[]'::jsonb),
    'data', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('category', category, 'rank', rank, 'name', name, 'score', score, 'unit', unit))
      FROM public._award_data_leaders(v_year, 5)), '[]'::jsonb)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_award_results(INTEGER) TO authenticated;

-- Members: the winners, once the founder has published them. The most votes
-- wins a voted category (ties share it); the top of each data award wins it.
CREATE OR REPLACE FUNCTION public.get_award_winners()
RETURNS TABLE (category TEXT, name TEXT, detail TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_year INTEGER := public._award_year();
BEGIN
  IF v_email IS NULL OR NOT public.is_member_allowed(v_email) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.award_settings WHERE award_year = v_year AND results_published) THEN RETURN; END IF;
  RETURN QUERY
  WITH tally AS (
    SELECT v.category, v.nominee_name, count(*) AS votes,
           RANK() OVER (PARTITION BY v.category ORDER BY count(*) DESC) AS rnk
    FROM public.award_votes v WHERE v.award_year = v_year
    GROUP BY v.category, v.nominee_key, v.nominee_name
  )
  SELECT t.category, t.nominee_name, NULL::text FROM tally t WHERE t.rnk = 1
  UNION ALL
  SELECT d.category, d.name, trim(to_char(d.score, 'FM999999990.##')) || ' ' || d.unit
  FROM public._award_data_leaders(v_year, 1) d;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_award_winners() TO authenticated;
