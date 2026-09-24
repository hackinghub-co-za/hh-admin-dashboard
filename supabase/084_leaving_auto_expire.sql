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

-- Time-limited access (founder-specified, 2026-09) - a deliberate,
-- short-term grant (a trial, a guest, someone being evaluated) rather than
-- a real membership. NULL for every normal member; only set when an admin
-- explicitly grants a bounded window. Same self-enforcing shape as
-- expire_leaving_members() above, just a second independent expiry
-- condition on the same table, checked in the same daily sweep - kept as
-- its own column/function rather than overloading offboarding_started_at,
-- since this never goes through the Leaving grace period or
-- OffboardingSequence at all: access just ends.
ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS access_expires_at TIMESTAMP WITH TIME ZONE;

CREATE OR REPLACE FUNCTION public.expire_time_limited_access()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.member_profiles
  SET status = 'Left',
      left_at = timezone('utc'::text, now())
  WHERE status != 'Left'
    AND access_expires_at IS NOT NULL
    AND access_expires_at <= timezone('utc'::text, now());
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-time-limited-access-daily') THEN
    PERFORM cron.unschedule('expire-time-limited-access-daily');
  END IF;
END $$;

SELECT cron.schedule(
  'expire-time-limited-access-daily',
  '0 3 * * *',
  $$ SELECT public.expire_time_limited_access(); $$
);

SELECT public.expire_time_limited_access();

-- Consolidation note (2026-09-24): two pre-existing one-off trial grants
-- were already running as bespoke, individually-named pg_cron jobs
-- created directly against the database (expire-trial-<name>, a
-- hardcoded one-shot schedule + UPDATE + self-unschedule) - never
-- tracked in any migration file. Folded into this mechanism instead:
-- their expiry moments were copied into access_expires_at and their
-- standalone cron jobs unscheduled, so there's exactly one system
-- governing time-limited access going forward, not two doing the same
-- job differently.
