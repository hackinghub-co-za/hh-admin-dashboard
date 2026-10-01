-- Hacking Hub Admin Dashboard - Hub Score Phase 2 (Leaderboard) & Phase 3
-- (Reward Claiming). Run after 002-093 have already been applied. Safe to
-- re-run: CREATE OR REPLACEs three functions, one new trigger function, and
-- CREATE TABLE IF NOT EXISTS for one new table.
--
-- Phase 1 (093_hub_score.sql) computed one member's score at a time via a
-- plpgsql function full of scalar variables. Phase 2/3 both need the SAME
-- math for every member at once (leaderboard ranking, claim eligibility) -
-- duplicating it a second time would double the maintenance surface and
-- risk drifting out of sync. Instead this refactors the scoring logic into
-- a single set-based SQL function, _hub_score_breakdown(), that computes
-- the full breakdown for either one member (p_email set) or every member at
-- once (p_email NULL) in one pass of CTEs - no per-row plpgsql loop.
-- get_my_hub_score() becomes a thin wrapper around it, so its already-live
-- callers (the Dashboard stat chip, HubScoreModal) keep working untouched -
-- same name, same signature, same behavior.
--
-- _hub_score_breakdown() and its two small helpers are intentionally
-- "internal" (underscore-prefixed, REVOKEd from PUBLIC/anon/authenticated)
-- - only SECURITY DEFINER functions owned by the same role can call them
-- (ownership carries full privileges without a grant). Nothing outside
-- this file should ever be able to call _hub_score_breakdown(someone
-- else's email) directly - that's exactly the kind of "see everyone's
-- exact breakdown on demand" surface Phase 1/2 deliberately don't expose.
-- The two real public entry points stay get_my_hub_score() (unchanged)
-- and the new get_hub_score_leaderboard().

-- =========================================================================
-- PART 1: SHARED TIER HELPERS (DRY - the Newcomer/Contributor/Regular/
-- Veteran/Legend ladder was inlined twice in 093_hub_score.sql; Phase 2/3
-- need it in two more places, so it's a single source of truth from here
-- on). Tier thresholds are finalized product numbers, not tuning knobs.
-- =========================================================================

CREATE OR REPLACE FUNCTION public._hub_score_tier_name(p_points INTEGER)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_points >= 4000 THEN 'Legend'
    WHEN p_points >= 2000 THEN 'Veteran'
    WHEN p_points >= 500 THEN 'Regular'
    WHEN p_points >= 100 THEN 'Contributor'
    ELSE 'Newcomer'
  END;
$$;

CREATE OR REPLACE FUNCTION public._hub_score_tier_min_points(p_tier TEXT)
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_tier
    WHEN 'Contributor' THEN 100
    WHEN 'Regular' THEN 500
    WHEN 'Veteran' THEN 2000
    WHEN 'Legend' THEN 4000
    ELSE NULL
  END;
$$;

REVOKE EXECUTE ON FUNCTION public._hub_score_tier_name(INTEGER) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._hub_score_tier_min_points(TEXT) FROM PUBLIC, anon, authenticated;

-- =========================================================================
-- PART 2: SHARED SCORING ENGINE - set-based, one member or all members.
-- Same 8 signals, same point values, same rules as 093_hub_score.sql's
-- header comment (certs 100/cert, roadmap 5/item, rooms 3/room via
-- SUM(room_count) not COUNT, streak 10/60/210 cumulative at 7/30/100d,
-- tenure 10/month via age(), study capped 4/SAST-day then summed, events
-- 15/event once actually over, job 250 one-time). Does NOT filter on
-- member_profiles.status - that preserves get_my_hub_score()'s existing
-- behavior of always returning a row for whoever calls it. Status
-- filtering (excluding 'Left') is applied explicitly by
-- get_hub_score_leaderboard() below instead, where it actually matters.
-- =========================================================================

CREATE OR REPLACE FUNCTION public._hub_score_breakdown(p_email TEXT DEFAULT NULL)
RETURNS TABLE (
  member_email TEXT,
  total_points INTEGER,
  cert_points INTEGER,
  cert_count INTEGER,
  roadmap_points INTEGER,
  roadmap_count INTEGER,
  room_points INTEGER,
  room_count INTEGER,
  streak_points INTEGER,
  longest_streak_days INTEGER,
  tenure_points INTEGER,
  tenure_months INTEGER,
  study_points INTEGER,
  study_session_count INTEGER,
  event_points INTEGER,
  event_count INTEGER,
  job_points INTEGER,
  job_landed BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH params AS (
    SELECT (now() AT TIME ZONE 'Africa/Johannesburg')::date AS v_today
  ),
  cert_agg AS (
    SELECT member_email, count(*) AS cert_count
    FROM public.cert_calendar
    WHERE result = 'Passed'
    GROUP BY member_email
  ),
  roadmap_agg AS (
    SELECT member_email, count(*) AS roadmap_count
    FROM public.roadmap_items
    WHERE completed_at IS NOT NULL
    GROUP BY member_email
  ),
  room_agg AS (
    SELECT member_email, COALESCE(SUM(daily_room_logs.room_count), 0) AS room_total
    FROM public.daily_room_logs
    WHERE status = 'Approved'
    GROUP BY member_email
  ),
  study_daily AS (
    SELECT member_email, (logged_at AT TIME ZONE 'Africa/Johannesburg')::date AS study_day, count(*) AS day_count
    FROM public.study_sessions
    GROUP BY member_email, (logged_at AT TIME ZONE 'Africa/Johannesburg')::date
  ),
  study_agg AS (
    SELECT member_email, SUM(LEAST(day_count, 4)) AS study_capped
    FROM study_daily
    GROUP BY member_email
  ),
  event_agg AS (
    SELECT er.email AS member_email, count(*) AS event_count
    FROM public.event_rsvps er
    JOIN public.community_events ce ON ce.id = er.event_id
    CROSS JOIN params
    WHERE COALESCE(ce.end_date, ce.date) < params.v_today
    GROUP BY er.email
  ),
  -- Driver set: when p_email is given, exactly that one email (always,
  -- even if they appear nowhere else yet - a brand-new member with zero
  -- activity and no member_profiles row must still get a valid all-zeros
  -- row back, matching 093's original per-caller behavior). When p_email
  -- is NULL, every email that appears in member_profiles OR any signal
  -- table.
  driver AS (
    SELECT DISTINCT member_email FROM (
      SELECT email AS member_email FROM public.member_profiles
      UNION SELECT member_email FROM cert_agg
      UNION SELECT member_email FROM roadmap_agg
      UNION SELECT member_email FROM room_agg
      UNION SELECT member_email FROM study_agg
      UNION SELECT member_email FROM event_agg
      UNION SELECT lower(p_email) WHERE p_email IS NOT NULL
    ) all_emails
    WHERE p_email IS NULL OR member_email = lower(p_email)
  ),
  scored AS (
    SELECT
      d.member_email,
      COALESCE(ca.cert_count, 0)::INTEGER AS cert_count,
      (COALESCE(ca.cert_count, 0) * 100)::INTEGER AS cert_points,
      COALESCE(ra.roadmap_count, 0)::INTEGER AS roadmap_count,
      (COALESCE(ra.roadmap_count, 0) * 5)::INTEGER AS roadmap_points,
      COALESCE(rm.room_total, 0)::INTEGER AS room_count,
      (COALESCE(rm.room_total, 0) * 3)::INTEGER AS room_points,
      COALESCE(mp.longest_login_streak, 0)::INTEGER AS longest_streak_days,
      (CASE
        WHEN COALESCE(mp.longest_login_streak, 0) >= 100 THEN 210
        WHEN COALESCE(mp.longest_login_streak, 0) >= 30 THEN 60
        WHEN COALESCE(mp.longest_login_streak, 0) >= 7 THEN 10
        ELSE 0
      END)::INTEGER AS streak_points,
      -- NULL-join-date guard: a member with neither manual_start_date nor
      -- onboarded_at gets 0 tenure MONTHS (and therefore 0 tenure points),
      -- never a NULL that would poison total_points downstream.
      (CASE
        WHEN COALESCE(mp.manual_start_date, mp.onboarded_at::date) IS NOT NULL
         AND COALESCE(mp.manual_start_date, mp.onboarded_at::date) <= p.v_today
        THEN GREATEST(0, (
          EXTRACT(YEAR FROM age(p.v_today::timestamp, COALESCE(mp.manual_start_date, mp.onboarded_at::date)::timestamp)) * 12
          + EXTRACT(MONTH FROM age(p.v_today::timestamp, COALESCE(mp.manual_start_date, mp.onboarded_at::date)::timestamp))
        )::INTEGER)
        ELSE 0
      END)::INTEGER AS tenure_months,
      COALESCE(sa.study_capped, 0)::INTEGER AS study_session_count,
      COALESCE(sa.study_capped, 0)::INTEGER AS study_points,
      COALESCE(ea.event_count, 0)::INTEGER AS event_count,
      (COALESCE(ea.event_count, 0) * 15)::INTEGER AS event_points,
      (mp.job_readiness = 'Job Placed') AS job_landed,
      (CASE WHEN mp.job_readiness = 'Job Placed' THEN 250 ELSE 0 END)::INTEGER AS job_points
    FROM driver d
    LEFT JOIN public.member_profiles mp ON mp.email = d.member_email
    LEFT JOIN cert_agg ca ON ca.member_email = d.member_email
    LEFT JOIN roadmap_agg ra ON ra.member_email = d.member_email
    LEFT JOIN room_agg rm ON rm.member_email = d.member_email
    LEFT JOIN study_agg sa ON sa.member_email = d.member_email
    LEFT JOIN event_agg ea ON ea.member_email = d.member_email
    CROSS JOIN params p
  ),
  scored2 AS (
    SELECT *, (tenure_months * 10)::INTEGER AS tenure_points FROM scored
  )
  SELECT
    member_email,
    (cert_points + roadmap_points + room_points + streak_points + tenure_points + study_points + event_points + job_points)::INTEGER AS total_points,
    cert_points, cert_count,
    roadmap_points, roadmap_count,
    room_points, room_count,
    streak_points, longest_streak_days,
    tenure_points, tenure_months,
    study_points, study_session_count,
    event_points, event_count,
    job_points, job_landed
  FROM scored2;
$$;

REVOKE EXECUTE ON FUNCTION public._hub_score_breakdown(TEXT) FROM PUBLIC, anon, authenticated;

-- =========================================================================
-- PART 3: get_my_hub_score() - CREATE OR REPLACE, UNCHANGED return
-- signature. Now just delegates to _hub_score_breakdown() plus the same
-- tier/next-tier layer Phase 1 had. Every existing caller
-- (src/lib/hubScoreData.js's fetchMyHubScore) keeps working untouched.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.get_my_hub_score()
RETURNS TABLE (
  total_points INTEGER,
  current_tier TEXT,
  next_tier TEXT,
  next_tier_points INTEGER,
  points_to_next_tier INTEGER,
  cert_points INTEGER,
  cert_count INTEGER,
  roadmap_points INTEGER,
  roadmap_count INTEGER,
  room_points INTEGER,
  room_count INTEGER,
  streak_points INTEGER,
  longest_streak_days INTEGER,
  tenure_points INTEGER,
  tenure_months INTEGER,
  study_points INTEGER,
  study_session_count INTEGER,
  event_points INTEGER,
  event_count INTEGER,
  job_points INTEGER,
  job_landed BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_row RECORD;
  v_tier TEXT;
  v_next_tier TEXT;
  v_next_points INTEGER;
BEGIN
  SELECT * INTO v_row FROM public._hub_score_breakdown(v_email) LIMIT 1;

  v_tier := public._hub_score_tier_name(v_row.total_points);

  SELECT t.name, t.points INTO v_next_tier, v_next_points
  FROM (VALUES ('Contributor', 100), ('Regular', 500), ('Veteran', 2000), ('Legend', 4000)) AS t(name, points)
  WHERE t.points > v_row.total_points
  ORDER BY t.points ASC
  LIMIT 1;

  RETURN QUERY SELECT
    v_row.total_points, v_tier, v_next_tier, v_next_points,
    CASE WHEN v_next_points IS NULL THEN NULL ELSE v_next_points - v_row.total_points END,
    v_row.cert_points, v_row.cert_count,
    v_row.roadmap_points, v_row.roadmap_count,
    v_row.room_points, v_row.room_count,
    v_row.streak_points, v_row.longest_streak_days,
    v_row.tenure_points, v_row.tenure_months,
    v_row.study_points, v_row.study_session_count,
    v_row.event_points, v_row.event_count,
    v_row.job_points, v_row.job_landed;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_hub_score() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_hub_score() FROM PUBLIC, anon;

-- =========================================================================
-- PART 4: Leaderboard RPC. Returns (rank, member_email, total_points,
-- tier) only - no name/avatar columns, matching this app's own
-- directory-match-client-side convention (every existing leaderboard
-- fetches raw rows then matches src/lib/memberDirectoryData.js's directory
-- client-side by lowercased email). Top N by RANK() (ties share a rank),
-- PLUS the caller's own row pinned on if they fall outside that top N
-- (the UNION below naturally dedupes if their row is already in the top
-- N, so the client doesn't need to special-case that). status != 'Left'
-- is filtered explicitly here (not baked into _hub_score_breakdown) -
-- deliberately not replicating the accidental gap study_leaderboard/
-- competition_standings have today (a left member stays visible there
-- indefinitely).
-- =========================================================================

CREATE OR REPLACE FUNCTION public.get_hub_score_leaderboard(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  rank INTEGER,
  member_email TEXT,
  total_points INTEGER,
  tier TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_caller TEXT := lower(auth.jwt() ->> 'email');
BEGIN
  RETURN QUERY
  WITH ranked AS (
    SELECT
      b.member_email AS ranked_email,
      b.total_points AS ranked_points,
      public._hub_score_tier_name(b.total_points) AS ranked_tier,
      (RANK() OVER (ORDER BY b.total_points DESC))::INTEGER AS rnk
    FROM public._hub_score_breakdown(NULL) b
    JOIN public.member_profiles mp ON mp.email = b.member_email
    WHERE mp.status != 'Left'
  ),
  top_n AS (
    SELECT * FROM ranked ORDER BY rnk ASC, ranked_email ASC LIMIT GREATEST(p_limit, 0)
  ),
  mine AS (
    SELECT * FROM ranked WHERE ranked_email = v_caller
  )
  SELECT rnk, ranked_email, ranked_points, ranked_tier FROM top_n
  UNION
  SELECT rnk, ranked_email, ranked_points, ranked_tier FROM mine
  ORDER BY 1 ASC, 2 ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_hub_score_leaderboard(INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_hub_score_leaderboard(INTEGER) FROM PUBLIC, anon;

-- =========================================================================
-- PART 5: Reward tier claims. Same self-attributed-INSERT idiom as
-- merch_orders (060_merch_orders.sql): a member inserts their own row
-- directly, RLS WITH CHECK locks member_email/status/reviewed_* to safe
-- values regardless of what the client sends, and a BEFORE INSERT trigger
-- re-derives the real truth (their actual total_points) server-side and
-- REJECTS the insert outright if they don't actually qualify - never
-- trusting the client's claim that they're eligible. One claim ever per
-- tier per member (UNIQUE). No member UPDATE policy - only admins can move
-- a claim forward, via a plain FOR ALL policy (same as merch_orders),
-- never a dedicated review RPC.
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.hub_score_tier_claims (
  id BIGSERIAL PRIMARY KEY,
  member_email TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('Contributor', 'Regular', 'Veteran', 'Legend')),
  -- 'Fulfilled' is distinct from 'Approved', same distinction merch_orders
  -- draws between 'Paid' and 'Fulfilled' - a claim can be admin-approved
  -- (reward decided/queued) before it's actually been handed over.
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Fulfilled')),
  note TEXT,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  UNIQUE (member_email, tier)
);

ALTER TABLE public.hub_score_tier_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read own hub score claims" ON public.hub_score_tier_claims;
CREATE POLICY "members read own hub score claims"
  ON public.hub_score_tier_claims FOR SELECT
  TO authenticated
  USING (member_email = lower(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "members create own hub score claims" ON public.hub_score_tier_claims;
CREATE POLICY "members create own hub score claims"
  ON public.hub_score_tier_claims FOR INSERT
  TO authenticated
  WITH CHECK (
    member_email = lower(auth.jwt() ->> 'email')
    AND status = 'Pending'
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
  );

-- No member UPDATE policy at all - intentional, same as merch_orders. Only
-- admins (below) can ever move a claim's status forward.

DROP POLICY IF EXISTS "admins manage hub score claims" ON public.hub_score_tier_claims;
CREATE POLICY "admins manage hub score claims"
  ON public.hub_score_tier_claims FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_hub_score_tier_claims_member_email ON public.hub_score_tier_claims (member_email);
CREATE INDEX IF NOT EXISTS idx_hub_score_tier_claims_status ON public.hub_score_tier_claims (status);

-- Eligibility trigger - SECURITY DEFINER (not just the table's RLS) so it
-- can call the locked-down _hub_score_breakdown() even though the
-- inserting member's own role has no direct EXECUTE grant on it; this
-- function runs as its owner for the duration, same privilege model as
-- every SECURITY DEFINER RPC in this project. Runs BEFORE the INSERT
-- policy's WITH CHECK is evaluated, so normalizing NEW.member_email here
-- also protects that comparison from a case mismatch.
CREATE OR REPLACE FUNCTION public._validate_hub_score_tier_claim()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_real_points INTEGER;
  v_min_points INTEGER;
BEGIN
  NEW.member_email := lower(NEW.member_email);

  v_min_points := public._hub_score_tier_min_points(NEW.tier);
  IF v_min_points IS NULL THEN
    RAISE EXCEPTION 'Unknown Hub Score tier: %', NEW.tier;
  END IF;

  SELECT b.total_points INTO v_real_points
  FROM public._hub_score_breakdown(NEW.member_email) b;

  IF v_real_points IS NULL OR v_real_points < v_min_points THEN
    RAISE EXCEPTION 'Not eligible to claim % yet (% of % points required).', NEW.tier, COALESCE(v_real_points, 0), v_min_points;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_hub_score_tier_claim ON public.hub_score_tier_claims;
CREATE TRIGGER trg_validate_hub_score_tier_claim
  BEFORE INSERT ON public.hub_score_tier_claims
  FOR EACH ROW
  EXECUTE FUNCTION public._validate_hub_score_tier_claim();
