-- Hacking Hub Admin Dashboard - Community Broadcast & Recent Wins
-- Run this in the Supabase SQL Editor after 002-021 have already been
-- applied. Safe to re-run: every statement is idempotent.
--
-- Both the Dashboard's "Community Broadcast" feed and "Recent Wins" feed
-- were hardcoded arrays in MemberPortal.jsx - every update needed a code
-- change and a deploy instead of something an admin could edit directly.
-- Now two real tables, read-only for members (only active=true rows, same
-- "no member write path" reasoning as payfast_transactions/expenses - this
-- is admin-authored content, not a member submission), full CRUD for
-- admins.
--
-- community_wins.achieved_date is a real date, not a static "Today"/
-- "Recently" label - the member-side card now computes a live relative
-- label from it ("Today", "3 days ago", etc.) instead of a string that was
-- accurate once and then just sat there. Ordered by achieved_date DESC
-- (soonest win first) rather than a manual sort_order, since "Recent Wins"
-- is inherently time-ordered. Broadcasts aren't time-ordered the same way
-- (an evergreen announcement isn't more or less "recent" than another), so
-- those keep an admin-settable sort_order instead.

CREATE TABLE IF NOT EXISTS public.community_broadcasts (
  id BIGSERIAL PRIMARY KEY,
  emoji TEXT,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Optional "Book now" style link shown under the broadcast (2026-10-16).
ALTER TABLE public.community_broadcasts ADD COLUMN IF NOT EXISTS link_url TEXT;

ALTER TABLE public.community_broadcasts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read active broadcasts" ON public.community_broadcasts;
CREATE POLICY "members read active broadcasts"
  ON public.community_broadcasts FOR SELECT
  TO authenticated
  USING (active = true AND public.is_member_allowed(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "admins manage broadcasts" ON public.community_broadcasts;
CREATE POLICY "admins manage broadcasts"
  ON public.community_broadcasts FOR ALL
  USING (public.is_admin(auth.uid()));

-- Seeded with today's real, live broadcast content, carried over from the
-- hardcoded array it's replacing.
INSERT INTO public.community_broadcasts (id, emoji, title, body, sort_order) VALUES
  (1, '🤝', 'Matchmaker is live:', 'Opt in and get randomly grouped with 1-3 other members for a project or presentation. Head to Matchmaker → Count Me In.', 10),
  (2, '🏆', 'TryHackMe Competition kicks off 31 August:', 'Complete as many rooms as you can this quarter — 1st place wins a R6,000 cert voucher, 2nd R3,000, 3rd R1,000. Get logging early once it opens.', 20)
ON CONFLICT (id) DO NOTHING;

-- GREATEST against the real current max, not a bare 2 - a bare value here
-- would silently rewind the sequence backward past real admin-added rows
-- every time this file gets safely re-run for an unrelated later change,
-- causing every subsequent insert to collide with an existing id (the same
-- bug this fixed in cert_calendar/job_board - see those files' own
-- comments). Matches community_wins' setval below, which already had this
-- fix.
SELECT setval(pg_get_serial_sequence('public.community_broadcasts', 'id'), GREATEST((SELECT COALESCE(max(id), 0) FROM public.community_broadcasts), 2), true);

-- Corrects the row above for anyone who already ran this migration before the
-- competition's real start date and prize tiers were finalized (was "24
-- August" / a single "up to R10,000" placeholder) - the INSERT's
-- ON CONFLICT DO NOTHING means editing the seed text alone wouldn't reach a
-- database that already has this row.
UPDATE public.community_broadcasts
SET title = 'TryHackMe Competition kicks off 31 August:',
    body = 'Complete as many rooms as you can this quarter — 1st place wins a R6,000 cert voucher, 2nd R3,000, 3rd R1,000. Get logging early once it opens.'
WHERE id = 2;

CREATE TABLE IF NOT EXISTS public.community_wins (
  id BIGSERIAL PRIMARY KEY,
  member_name TEXT NOT NULL,
  achievement TEXT NOT NULL,
  achieved_date DATE NOT NULL,
  linkedin_url TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

-- member_name is free text, which made it impossible to reliably show a
-- win's real headshot next to their name (the same problem, and the same
-- fix, as cert_calendar's member_email - see 024_cert_calendar.sql). An
-- admin sets this when adding/editing a win; the member side resolves the
-- headshot client-side against the already-loaded directory by email, not
-- by fuzzy-matching member_name.
ALTER TABLE public.community_wins ADD COLUMN IF NOT EXISTS member_email TEXT;

ALTER TABLE public.community_wins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read active wins" ON public.community_wins;
CREATE POLICY "members read active wins"
  ON public.community_wins FOR SELECT
  TO authenticated
  USING (active = true AND public.is_member_allowed(auth.jwt() ->> 'email'));

-- WARNING - do not re-run this file alone against a database that has
-- already run 067_permission_scopes.sql: that later file widens this same
-- policy to also allow community_manager, and re-running just this file
-- afterward silently reverts it back to admin-only. Not fixed by widening
-- here directly - is_community_manager() isn't defined until 067, so a
-- fresh sequential bootstrap would fail on this exact line if it were
-- widened this early. Real live incident, 2026-09-16 - see
-- daily_room_logs' identical warning in 031_daily_room_logs.sql for the
-- full story. If this file ever needs to be re-run in isolation again,
-- re-run 067_permission_scopes.sql immediately after to restore the
-- widened policy.
DROP POLICY IF EXISTS "admins manage wins" ON public.community_wins;
CREATE POLICY "admins manage wins"
  ON public.community_wins FOR ALL
  USING (public.is_admin(auth.uid()));

-- Seeded with the 2 real wins already live on the Dashboard. Their exact
-- achieved_date wasn't tracked before (the old array just had static
-- "Today"/"Recently" labels) - these are reasonable real-world approximations
-- that preserve which one happened more recently, not exact record dates.
INSERT INTO public.community_wins (id, member_name, achievement, achieved_date, linkedin_url) VALUES
  (1, 'Philisiwe N.', 'earned SC-900: Security, Compliance & Identity Fundamentals', '2026-08-20', 'https://www.linkedin.com/posts/philisiwe-ncube-258263360_sc900-microsoftcertified-cybersecurity-activity-7494082635091251201-xzT6'),
  (2, 'Kiolin', 'landed a Software Developer internship', '2026-08-15', 'https://www.linkedin.com/in/kiolinharisanker/')
ON CONFLICT (id) DO NOTHING;

-- GREATEST against the table's real current max(id), not a bare literal -
-- a bare 2 is only correct the very first time this runs; re-running this
-- idempotent script after real wins have accumulated past id 2 rewinds the
-- sequence backward, and the next insert collides with an existing row
-- ("duplicate key value violates unique constraint community_wins_pkey").
-- Same bug, same fix, as community_events' id sequence (019_events.sql).
SELECT setval(pg_get_serial_sequence('public.community_wins', 'id'), GREATEST((SELECT COALESCE(max(id), 0) FROM public.community_wins), 2), true);

-- Added after the fact, same guarded-by-content pattern as
-- 026_resources.sql's post-seed additions (no explicit id, since a real
-- admin may have already added their own win at id 3+ through the live
-- Community Content tab by the time this runs).
INSERT INTO public.community_wins (member_name, achievement, achieved_date, linkedin_url)
SELECT 'Callum', 'landed an IT Audit role', '2026-08-22', 'https://www.linkedin.com/in/callum-molver-02c/'
WHERE NOT EXISTS (
  SELECT 1 FROM public.community_wins WHERE member_name = 'Callum' AND achievement = 'landed an IT Audit role'
);

-- NEW RECENT WINS POPUP, SEEN ONCE PER MEMBER (2026-11-06) - the member
-- Dashboard pops up wins posted since the member last saw the popup
-- (NewWinsModal.jsx). The highest win id each member has been shown is kept
-- here rather than in the browser, so a win shows once per member, not once
-- per device. Members never touch the table directly: the two RPCs below
-- read and raise only the caller's own row (by their signed-in email), and
-- the mark only ever moves forward (GREATEST), so a stale tab can't make
-- old wins reappear.
CREATE TABLE IF NOT EXISTS public.community_win_views (
  email TEXT PRIMARY KEY,
  seen_upto BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);
ALTER TABLE public.community_win_views ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_my_wins_seen_upto()
RETURNS BIGINT
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT COALESCE((SELECT seen_upto FROM public.community_win_views WHERE email = lower(auth.jwt() ->> 'email')), 0);
$$;

CREATE OR REPLACE FUNCTION public.mark_my_wins_seen(p_upto BIGINT)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_upto BIGINT;
BEGIN
  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'Not signed in.';
  END IF;
  -- Never past the newest real win, so a client can't skip future ones.
  p_upto := LEAST(COALESCE(p_upto, 0), COALESCE((SELECT max(id) FROM public.community_wins), 0));
  INSERT INTO public.community_win_views (email, seen_upto) VALUES (v_email, p_upto)
  ON CONFLICT (email) DO UPDATE
    SET seen_upto = GREATEST(community_win_views.seen_upto, EXCLUDED.seen_upto), updated_at = now()
  RETURNING seen_upto INTO v_upto;
  RETURN v_upto;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_my_wins_seen_upto() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_my_wins_seen(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_wins_seen_upto() TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_my_wins_seen(BIGINT) TO authenticated;

-- COMMENTS ON RECENT WINS (2026-11-06) - members can congratulate a win
-- from the New Recent Wins popup or the Dashboard card. Like
-- community_win_views, nobody touches the table directly (RLS on, no
-- policies): three RPCs read, add and delete, all gated on the caller being
-- an allowed member or staff. The author is always the signed-in person
-- (email from the JWT, display name looked up from their profile), never
-- what the browser sends. Only the author or the admin can delete a
-- comment. Comments on an inactive or deleted win go with it.
CREATE TABLE IF NOT EXISTS public.community_win_comments (
  id BIGSERIAL PRIMARY KEY,
  win_id BIGINT NOT NULL REFERENCES public.community_wins(id) ON DELETE CASCADE,
  author_email TEXT NOT NULL,
  author_name TEXT NOT NULL,
  body TEXT NOT NULL CHECK (char_length(btrim(body)) BETWEEN 1 AND 500),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);
CREATE INDEX IF NOT EXISTS community_win_comments_win_idx ON public.community_win_comments (win_id, created_at);
ALTER TABLE public.community_win_comments ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public._can_use_win_comments()
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT public.is_member_allowed(auth.jwt() ->> 'email')
    OR COALESCE(public.get_my_role() IN ('admin', 'community_manager', 'mentor'), false);
$$;
REVOKE EXECUTE ON FUNCTION public._can_use_win_comments() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._can_use_win_comments() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_win_comments(p_win_ids BIGINT[])
RETURNS TABLE (id BIGINT, win_id BIGINT, author_email TEXT, author_name TEXT, body TEXT, created_at TIMESTAMPTZ, is_mine BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE
AS $$
BEGIN
  IF NOT public._can_use_win_comments() THEN
    RAISE EXCEPTION 'Not allowed.';
  END IF;
  RETURN QUERY
    SELECT c.id, c.win_id, c.author_email, c.author_name, c.body, c.created_at,
           c.author_email = lower(auth.jwt() ->> 'email')
    FROM public.community_win_comments c
    JOIN public.community_wins w ON w.id = c.win_id AND w.active
    WHERE c.win_id = ANY (p_win_ids)
    ORDER BY c.created_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_win_comment(p_win_id BIGINT, p_body TEXT)
RETURNS TABLE (id BIGINT, win_id BIGINT, author_email TEXT, author_name TEXT, body TEXT, created_at TIMESTAMPTZ, is_mine BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_name TEXT;
  v_body TEXT := btrim(COALESCE(p_body, ''));
BEGIN
  IF NOT public._can_use_win_comments() THEN
    RAISE EXCEPTION 'Not allowed.';
  END IF;
  IF char_length(v_body) = 0 THEN
    RAISE EXCEPTION 'Write a comment first.';
  END IF;
  IF char_length(v_body) > 500 THEN
    RAISE EXCEPTION 'Comments can be up to 500 characters.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.community_wins w WHERE w.id = p_win_id AND w.active) THEN
    RAISE EXCEPTION 'That win is no longer up.';
  END IF;
  SELECT NULLIF(btrim(mp.full_name), '') INTO v_name FROM public.member_profiles mp WHERE mp.email = v_email;
  v_name := COALESCE(v_name, split_part(v_email, '@', 1));
  RETURN QUERY
    INSERT INTO public.community_win_comments AS c (win_id, author_email, author_name, body)
    VALUES (p_win_id, v_email, v_name, v_body)
    RETURNING c.id, c.win_id, c.author_email, c.author_name, c.body, c.created_at, true;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_win_comment(p_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM public.community_win_comments c
  WHERE c.id = p_id
    AND (c.author_email = lower(auth.jwt() ->> 'email') OR public.is_admin(auth.uid()));
  IF NOT FOUND THEN
    RAISE EXCEPTION 'You can only delete your own comments.';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_win_comments(BIGINT[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.add_win_comment(BIGINT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.delete_win_comment(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_win_comments(BIGINT[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_win_comment(BIGINT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_win_comment(BIGINT) TO authenticated;

-- "HOW THE COMMUNITY CELEBRATED YOUR WIN" EMAIL (2026-11-06) - once a day
-- the win-comments-email function emails the founder one email per win that
-- has new comments since its last email, listing every comment so far and
-- written to the member, so the founder can forward it. Never sent to the
-- member directly. comments_emailed_upto is the highest comment id already
-- included for that win; it is raised only after the email has gone out.
-- Both functions are for the service role only.
ALTER TABLE public.community_wins ADD COLUMN IF NOT EXISTS comments_emailed_upto BIGINT NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.win_comments_email_due()
RETURNS JSONB
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'win_id', w.id,
    'member_name', w.member_name,
    'member_email', w.member_email,
    'achievement', w.achievement,
    'achieved_date', w.achieved_date,
    'emailed_upto', w.comments_emailed_upto,
    'comments', (
      SELECT jsonb_agg(jsonb_build_object('id', c.id, 'author_name', c.author_name, 'body', c.body, 'created_at', c.created_at) ORDER BY c.created_at)
      FROM public.community_win_comments c WHERE c.win_id = w.id
    )
  ) ORDER BY w.id), '[]'::jsonb)
  FROM public.community_wins w
  WHERE w.active
    AND EXISTS (SELECT 1 FROM public.community_win_comments c WHERE c.win_id = w.id AND c.id > w.comments_emailed_upto);
$$;

CREATE OR REPLACE FUNCTION public.mark_win_comments_emailed(p_win_id BIGINT, p_upto BIGINT)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.community_wins
  SET comments_emailed_upto = GREATEST(comments_emailed_upto, p_upto)
  WHERE id = p_win_id;
$$;

REVOKE EXECUTE ON FUNCTION public.win_comments_email_due() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_win_comments_emailed(BIGINT, BIGINT) FROM PUBLIC, anon, authenticated;

-- Every day at 16:00 UTC = 18:00 SAST. Same template trick as
-- 111_inactive_member_removal.sql: built from the already-scheduled
-- overdue-1on1-digest-daily job with only the function name swapped, so the
-- cron secret is reused and never pasted here. Run only after
-- win-comments-email has been deployed.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
DECLARE
  v_template TEXT;
BEGIN
  SELECT command INTO v_template FROM cron.job WHERE jobname = 'overdue-1on1-digest-daily';
  IF v_template IS NULL OR position('/functions/v1/overdue-1on1-digest' in v_template) = 0 THEN
    RAISE EXCEPTION 'overdue-1on1-digest-daily cron job not found (or its URL changed) - schedule 072 first, or write this job by hand.';
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'win-comments-email-daily') THEN
    PERFORM cron.unschedule('win-comments-email-daily');
  END IF;

  PERFORM cron.schedule(
    'win-comments-email-daily',
    '0 16 * * *', -- 16:00 UTC every day = 18:00 SAST
    replace(v_template, '/functions/v1/overdue-1on1-digest', '/functions/v1/win-comments-email')
  );
END $$;
