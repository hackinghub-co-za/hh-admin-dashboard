-- Hacking Hub Admin Dashboard - Focus 5
-- Run this in the Supabase SQL Editor after 002-033 have already been applied.
-- Safe to re-run: every statement is idempotent.
--
-- The 5 members getting the most attention this month, editable from the
-- admin Dashboard tab instead of a hardcoded list in the source. Admin-only,
-- same "no member-facing view" reasoning as expenses/037_expenses.sql -
-- this is purely an internal coaching-priority list, not member-submitted
-- content, so there's no member policy at all.

CREATE TABLE IF NOT EXISTS public.focus_five (
  id BIGSERIAL PRIMARY KEY,
  member_email TEXT NOT NULL UNIQUE,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.focus_five ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins manage focus five" ON public.focus_five;
CREATE POLICY "admins manage focus five"
  ON public.focus_five FOR ALL
  USING (public.is_admin(auth.uid()));
