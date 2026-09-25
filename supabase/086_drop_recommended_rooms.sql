-- Hacking Hub Admin Dashboard - removes the "TryHackMe Room of the Day"
-- feature (064_recommended_rooms.sql). Replaced by Cyber Question of the
-- Day (087_daily_question.sql). Confirmed with the founder: remove
-- entirely, not hide - the admin-side "Daily Room Pool" management UI
-- existed only to feed this widget, and no other code references
-- recommended_rooms or get_todays_recommended_room().
-- Run in the Supabase SQL Editor. Safe to re-run.

DROP FUNCTION IF EXISTS public.get_todays_recommended_room();
DROP TABLE IF EXISTS public.recommended_rooms;
