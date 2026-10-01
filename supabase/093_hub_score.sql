-- Hacking Hub Admin Dashboard - Hub Score (Phase 1 of the Hub Score design
-- artifact)
-- Run this in the Supabase SQL Editor after 002-092 have already been
-- applied. Safe to re-run: this file only ever CREATE OR REPLACEs a single
-- read-only function, no tables.
--
-- A composite, never-resetting point total per member across 8 existing
-- real signals, unlocking reward tiers. Phase 1 is read-only: one RPC that
-- computes the caller's own score and breakdown on demand, surfaced on
-- their Dashboard. There is deliberately no leaderboard, no tier/reward
-- claiming, and no admin configuration surface yet - those are later
-- phases on top of this same function.
--
-- Every signal reads from a table that already exists and is already
-- trusted for something else in this app - nothing new is logged here.
-- One signal, Job Landed, isn't backed by a dated history the way the
-- other 7 are: it's 250 points for job_readiness currently reading 'Job
-- Placed' on member_profiles (a plain text column, not a SQL CHECK - see
-- JOB_READINESS_STAGES in src/lib/memberOptions.js), not a permanent
-- record of the day it happened. If that value is ever edited away from
-- 'Job Placed' later, those 250 points go with it. Finalized this way on
-- purpose for Phase 1 - flagged here in case it ever needs revisiting.
--
-- TryHackMe rooms: daily_room_logs (031) is one row per CALENDAR DAY, with
-- a room_count column (1-3) for how many rooms that day covered - NOT one
-- row per room. The point value is "per room," so this sums room_count
-- across Approved rows rather than counting rows, which would undercount.
--
-- Study sessions: study_sessions (081) is an append-only log, one row per
-- completed Pomodoro session, with no daily cap of its own (that only
-- exists for the Study Hours leaderboard's streak math, not for counting).
-- Hub Score applies its OWN cap - 4 points/day - by grouping sessions into
-- SAST calendar days and taking LEAST(count, 4) per day before summing.
--
-- Events: an event only counts once it's actually over - COALESCE(end_date,
-- date) < today (SAST), same multi-day-event rule already established by
-- 019_events.sql's own end_date column, strictly less-than so an event
-- ending today doesn't count until tomorrow.
--
-- Community tenure: COALESCE(manual_start_date, onboarded_at::date), same
-- join-date rule already used by sync_new_joiner_accountability() (091) and
-- the My Journey timeline - 10 points per full calendar month elapsed,
-- computed via age() so a partial month never rounds up.
--
-- Tier thresholds (finalized numbers, not tuning knobs - don't change
-- without product sign-off): Newcomer < 100, Contributor >= 100,
-- Regular >= 500, Veteran >= 2000, Legend >= 4000 (top tier - next_tier/
-- next_tier_points come back NULL once here, there's nothing above it).
-- Email identity follows this repo's own convention (e.g. 028_roadmap.sql,
-- 024_cert_calendar.sql): compare the stored column directly against
-- lower(auth.jwt()->>'email') with no lower() on the column side, since
-- every write path into these columns already lowercases on the way in.

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
  v_today DATE := (now() AT TIME ZONE 'Africa/Johannesburg')::date;

  v_cert_count INTEGER;
  v_roadmap_count INTEGER;
  v_room_total INTEGER;
  v_longest_streak INTEGER;
  v_join_date DATE;
  v_job_readiness TEXT;
  v_tenure_months INTEGER;
  v_study_capped INTEGER;
  v_event_count INTEGER;

  v_cert_points INTEGER;
  v_roadmap_points INTEGER;
  v_room_points INTEGER;
  v_streak_points INTEGER;
  v_tenure_points INTEGER;
  v_study_points INTEGER;
  v_event_points INTEGER;
  v_job_points INTEGER;
  v_job_landed BOOLEAN;
  v_total INTEGER;
  v_tier TEXT;
  v_next_tier TEXT;
  v_next_points INTEGER;
BEGIN
  SELECT count(*) INTO v_cert_count
  FROM public.cert_calendar
  WHERE member_email = v_email AND result = 'Passed';
  v_cert_points := v_cert_count * 100;

  SELECT count(*) INTO v_roadmap_count
  FROM public.roadmap_items
  WHERE member_email = v_email AND completed_at IS NOT NULL;
  v_roadmap_points := v_roadmap_count * 5;

  -- SUM(daily_room_logs.room_count), explicitly qualified: the bare column
  -- name is ambiguous here against this function's own room_count OUT
  -- parameter (RETURNS TABLE columns become implicit PL/pgSQL variables).
  SELECT COALESCE(SUM(daily_room_logs.room_count), 0) INTO v_room_total
  FROM public.daily_room_logs
  WHERE member_email = v_email AND status = 'Approved';
  v_room_points := v_room_total * 3;

  SELECT mp.longest_login_streak,
         COALESCE(mp.manual_start_date, mp.onboarded_at::date),
         mp.job_readiness
  INTO v_longest_streak, v_join_date, v_job_readiness
  FROM public.member_profiles mp
  WHERE mp.email = v_email;

  v_longest_streak := COALESCE(v_longest_streak, 0);
  v_streak_points := CASE
    WHEN v_longest_streak >= 100 THEN 210
    WHEN v_longest_streak >= 30 THEN 60
    WHEN v_longest_streak >= 7 THEN 10
    ELSE 0
  END;

  IF v_join_date IS NOT NULL AND v_join_date <= v_today THEN
    v_tenure_months := GREATEST(0,
      (EXTRACT(YEAR FROM age(v_today::timestamp, v_join_date::timestamp)) * 12
       + EXTRACT(MONTH FROM age(v_today::timestamp, v_join_date::timestamp)))::INTEGER
    );
  ELSE
    v_tenure_months := 0;
  END IF;
  v_tenure_points := v_tenure_months * 10;

  v_job_landed := (v_job_readiness = 'Job Placed');
  v_job_points := CASE WHEN v_job_landed THEN 250 ELSE 0 END;

  SELECT COALESCE(SUM(LEAST(day_count, 4)), 0) INTO v_study_capped
  FROM (
    SELECT count(*) AS day_count
    FROM public.study_sessions
    WHERE member_email = v_email
    GROUP BY (logged_at AT TIME ZONE 'Africa/Johannesburg')::date
  ) daily;
  v_study_points := v_study_capped;

  SELECT count(*) INTO v_event_count
  FROM public.event_rsvps er
  JOIN public.community_events ce ON ce.id = er.event_id
  WHERE er.email = v_email
    AND COALESCE(ce.end_date, ce.date) < v_today;
  v_event_points := v_event_count * 15;

  v_total := v_cert_points + v_roadmap_points + v_room_points + v_streak_points
    + v_tenure_points + v_study_points + v_event_points + v_job_points;

  v_tier := CASE
    WHEN v_total >= 4000 THEN 'Legend'
    WHEN v_total >= 2000 THEN 'Veteran'
    WHEN v_total >= 500 THEN 'Regular'
    WHEN v_total >= 100 THEN 'Contributor'
    ELSE 'Newcomer'
  END;

  SELECT t.name, t.points INTO v_next_tier, v_next_points
  FROM (VALUES ('Contributor', 100), ('Regular', 500), ('Veteran', 2000), ('Legend', 4000)) AS t(name, points)
  WHERE t.points > v_total
  ORDER BY t.points ASC
  LIMIT 1;

  RETURN QUERY SELECT
    v_total, v_tier, v_next_tier, v_next_points,
    CASE WHEN v_next_points IS NULL THEN NULL ELSE v_next_points - v_total END,
    v_cert_points, v_cert_count,
    v_roadmap_points, v_roadmap_count,
    v_room_points, v_room_total,
    v_streak_points, v_longest_streak,
    v_tenure_points, v_tenure_months,
    v_study_points, v_study_capped,
    v_event_points, v_event_count,
    v_job_points, v_job_landed;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_hub_score() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_hub_score() FROM PUBLIC, anon;
