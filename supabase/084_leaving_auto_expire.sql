-- Auto-expires the 'Leaving' grace period (founder-specified, 2026-09):
-- someone marked 'Leaving' and never logging back in to go through
-- OffboardingSequence (008_offboarding.sql) used to just sit in 'Leaving'
-- forever - not blocked, not resolved, since is_member_allowed() only
-- blocks 'Left'. This finalizes it after 3 days on its own, same outcome
-- as submit_exit_feedback() (status='Left', left_at stamped), just
-- triggered by time instead of the member coming back to click through.
--
-- Pure SQL, called directly by pg_cron - no edge function needed, same
-- shape as resolve_expired_duels() (062_quiz_duels.sql).
CREATE OR REPLACE FUNCTION public.expire_leaving_members()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.member_profiles
  SET status = 'Left',
      left_at = timezone('utc'::text, now())
  WHERE status = 'Leaving'
    AND offboarding_started_at IS NOT NULL
    AND offboarding_started_at <= timezone('utc'::text, now()) - interval '3 days';
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-leaving-members-daily') THEN
    PERFORM cron.unschedule('expire-leaving-members-daily');
  END IF;
END $$;

-- 03:00 UTC daily - same off-peak slot as the other daily crons in this
-- project (e.g. weekly-breakdown-email's Friday 06:00 UTC send).
SELECT cron.schedule(
  'expire-leaving-members-daily',
  '0 3 * * *',
  $$ SELECT public.expire_leaving_members(); $$
);

-- Catch anyone already past 3 days right now, rather than waiting for
-- tomorrow's 03:00 UTC run.
SELECT public.expire_leaving_members();
