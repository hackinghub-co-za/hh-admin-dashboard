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

SELECT setval(pg_get_serial_sequence('public.community_broadcasts', 'id'), 2, true);

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

ALTER TABLE public.community_wins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read active wins" ON public.community_wins;
CREATE POLICY "members read active wins"
  ON public.community_wins FOR SELECT
  TO authenticated
  USING (active = true AND public.is_member_allowed(auth.jwt() ->> 'email'));

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

SELECT setval(pg_get_serial_sequence('public.community_wins', 'id'), 2, true);

-- Added after the fact, same guarded-by-content pattern as
-- 026_resources.sql's post-seed additions (no explicit id, since a real
-- admin may have already added their own win at id 3+ through the live
-- Community Content tab by the time this runs).
INSERT INTO public.community_wins (member_name, achievement, achieved_date, linkedin_url)
SELECT 'Callum', 'landed an IT Audit role', '2026-08-22', 'https://www.linkedin.com/in/callum-molver-02c/'
WHERE NOT EXISTS (
  SELECT 1 FROM public.community_wins WHERE member_name = 'Callum' AND achievement = 'landed an IT Audit role'
);
