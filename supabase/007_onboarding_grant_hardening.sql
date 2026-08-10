-- Hacking Hub Admin Dashboard - Harden mark_onboarding_complete's grants
-- Run this in the Supabase SQL Editor after 006_onboarding.sql.
--
-- Postgres grants EXECUTE on new functions to PUBLIC by default, regardless of the
-- explicit `GRANT ... TO authenticated` in 006 - so the anon role could still call
-- mark_onboarding_complete(). It was harmless in practice (anon has no `email` claim
-- in its JWT, so the function's WHERE clause matches zero rows and no-ops), but the
-- anon role shouldn't be able to invoke it at all. This closes that off explicitly.

REVOKE EXECUTE ON FUNCTION public.mark_onboarding_complete() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.mark_onboarding_complete() FROM anon;
GRANT EXECUTE ON FUNCTION public.mark_onboarding_complete() TO authenticated;
