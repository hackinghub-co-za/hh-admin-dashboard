-- Hacking Hub Admin Dashboard - removes the Room Race (063_room_races.sql)
-- and Live Buzzer Trivia (066_live_trivia.sql) features entirely. Neither
-- was getting real use, and Room Race's daily cron has in fact been
-- silently failing since 086_drop_recommended_rooms.sql dropped the
-- recommended_rooms table assign_room_race_rooms() reads from - confirmed
-- via research before writing this file, not assumed.
-- Run in the Supabase SQL Editor. Safe to re-run.
--
-- IMPORTANT: duel_questions (062_quiz_duels.sql) is NOT touched here, even
-- though Live Buzzer Trivia read from it - it's shared with Quiz Duel
-- (still a live feature) and Cyber Question of the Day
-- (087_daily_question.sql, which also added its own `explanation` column
-- to it). This file only ever reads duel_questions' id via a FK on
-- trivia_buzzes, dropped below along with the rest of that table.
--
-- 067_permission_scopes.sql later redefined (CREATE OR REPLACE) 4 of Room
-- Race's functions and re-did both features' RLS policies to also allow
-- community_manager - those redefinitions are what's actually live today,
-- not 063/066's originals, but DROP FUNCTION with a matching signature
-- removes whichever version is current either way.

-- Room Race's cron job reads recommended_rooms (dropped in 086) every run
-- and has been failing silently ever since - unschedule it explicitly
-- rather than relying on DROP FUNCTION to clean up the registration.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'assign-room-race-rooms-daily') THEN
    PERFORM cron.unschedule('assign-room-race-rooms-daily');
  END IF;
END $$;

-- Room Race functions
DROP FUNCTION IF EXISTS public.challenge_to_room_race(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.accept_room_race(BIGINT);
DROP FUNCTION IF EXISTS public.decline_room_race(BIGINT);
DROP FUNCTION IF EXISTS public.assign_room_race_rooms();
DROP FUNCTION IF EXISTS public.submit_room_race_proof(BIGINT, BOOLEAN);
DROP FUNCTION IF EXISTS public.approve_room_race_submission(BIGINT, TEXT);
DROP FUNCTION IF EXISTS public.get_my_room_races();

-- Room Race table - cascades its own 2 RLS policies and 2 indexes
DROP TABLE IF EXISTS public.room_races CASCADE;

-- Live Buzzer Trivia functions
DROP FUNCTION IF EXISTS public.create_trivia_session(TEXT, INTEGER);
DROP FUNCTION IF EXISTS public.start_trivia_session(BIGINT);
DROP FUNCTION IF EXISTS public.advance_trivia_question(BIGINT);
DROP FUNCTION IF EXISTS public.end_trivia_session(BIGINT);
DROP FUNCTION IF EXISTS public.join_trivia_session(BIGINT);
DROP FUNCTION IF EXISTS public.get_current_trivia_question(BIGINT);
DROP FUNCTION IF EXISTS public.buzz_in_trivia(BIGINT, INTEGER);
DROP FUNCTION IF EXISTS public.get_trivia_leaderboard(BIGINT);

-- Live Buzzer Trivia tables - cascades their own RLS policies, indexes,
-- and trivia_buzzes' FKs to trivia_sessions/trivia_participants/
-- duel_questions (the FK to duel_questions is dropped along with the
-- referencing column here, not the referenced table itself).
DROP TABLE IF EXISTS public.trivia_buzzes CASCADE;
DROP TABLE IF EXISTS public.trivia_participants CASCADE;
DROP TABLE IF EXISTS public.trivia_sessions CASCADE;
