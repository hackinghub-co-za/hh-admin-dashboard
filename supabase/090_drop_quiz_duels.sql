-- Hacking Hub Admin Dashboard - removes the Quiz Duel feature
-- (062_quiz_duels.sql), the last of the three original head-to-head
-- competition formats (Room Race and Live Buzzer Trivia were removed
-- earlier in 089_drop_room_races_and_trivia.sql). Run in the Supabase SQL
-- Editor. Safe to re-run.
--
-- IMPORTANT: duel_questions is NOT touched here. It's shared read-only
-- content, not Quiz Duel's alone - Cyber Question of the Day
-- (087_daily_question.sql) reuses it as its question pool (and even added
-- its own `explanation` column to it), so it must survive Quiz Duel's
-- removal exactly the way it already survived Live Buzzer Trivia's. Only
-- quiz_duels and quiz_duel_answers (the duel-specific tables) are dropped.
--
-- 067_permission_scopes.sql later redefined (CREATE OR REPLACE) the RLS
-- policies on all three tables to also allow community_manager - dropping
-- quiz_duels/quiz_duel_answers below cascades those two tables' policies
-- regardless of which migration last defined them. duel_questions' own
-- policy (unaffected by this file) stays exactly as 067 left it.

-- Quiz Duel's background resolver runs hourly via cron, unlike Room
-- Race's (which needed an explicit unschedule after being missed in
-- 086) - unschedule it explicitly here too, same lesson applied
-- pre-emptively rather than left to be discovered later.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'resolve-expired-duels-hourly') THEN
    PERFORM cron.unschedule('resolve-expired-duels-hourly');
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.announce_duel_win(BIGINT);
DROP FUNCTION IF EXISTS public.challenge_to_duel(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.get_my_duels();
DROP FUNCTION IF EXISTS public.get_duel_questions(BIGINT);
DROP FUNCTION IF EXISTS public.submit_duel_answer(BIGINT, BIGINT, INTEGER);
DROP FUNCTION IF EXISTS public.resolve_expired_duels();

-- Cascades their own RLS policies and quiz_duel_answers' FKs to
-- quiz_duels/duel_questions (only the FK column is dropped, not
-- duel_questions itself).
DROP TABLE IF EXISTS public.quiz_duel_answers CASCADE;
DROP TABLE IF EXISTS public.quiz_duels CASCADE;
