-- Hacking Hub Admin Dashboard - Suggested Content
-- Run this in the Supabase SQL Editor after 002-044 have already been
-- applied. Safe to re-run: every statement is idempotent.
--
-- Replaces the Dashboard's "Billing Info" card, which was a blurred,
-- never-implemented "Under Construction" placeholder that showed nothing
-- real. In its place: a real, admin-curated feed of recommended content
-- (YouTube videos, articles, TikToks, memes, screenshots) - link-only, no
-- file storage, same admin-authored/member-read-only shape as
-- community_broadcasts/community_wins (044_community_content.sql).
--
-- Not seeded - unlike Community Broadcast/Recent Wins, there's no existing
-- hardcoded content to carry over here. Starts empty; admins add real items
-- through the Community Content tab.

CREATE TABLE IF NOT EXISTS public.suggested_content (
  id BIGSERIAL PRIMARY KEY,
  content_type TEXT NOT NULL CHECK (content_type IN ('Video', 'Article', 'TikTok', 'Meme', 'Screenshot', 'Other')),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.suggested_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read active suggested content" ON public.suggested_content;
CREATE POLICY "members read active suggested content"
  ON public.suggested_content FOR SELECT
  TO authenticated
  USING (active = true AND public.is_member_allowed(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "admins manage suggested content" ON public.suggested_content;
CREATE POLICY "admins manage suggested content"
  ON public.suggested_content FOR ALL
  USING (public.is_admin(auth.uid()));
