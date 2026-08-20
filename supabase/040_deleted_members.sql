-- Hacking Hub Admin Dashboard - Permanently Delete a Member
-- Run this in the Supabase SQL Editor after 002-004 have already been applied.
-- Safe to re-run: every statement is idempotent.
--
-- Admins can now permanently delete a member's profile once they're marked
-- 'Left' (a new "Delete Permanently" button, deliberately separate from and
-- after the existing 'Left' status - not automatic on status change, so the
-- normal grace-period/farewell-screen flow is untouched). Deletion is
-- scoped to just their member_profiles row - their PayFast payment history,
-- reviews, cert calendar entries, room logs, roadmap, and referrals are left
-- alone, still real records for accounting/history, just no longer linked
-- to a live profile. This was a deliberate, explicitly confirmed scope, not
-- an oversight.
--
-- The Members list itself is built from PayFast payment history, not from
-- member_profiles, so deleting the profile row alone wouldn't actually
-- remove someone with real payments from the list - they'd just revert to
-- showing as "Active"/"Lapsed" again. This table is what makes deletion
-- actually stick: every email in here is filtered out of the roster
-- everywhere it's built (Members, Roadmaps, Matchmaker, Room Logs,
-- Referrals), regardless of what payment history exists for them.

CREATE TABLE IF NOT EXISTS public.deleted_members (
  email TEXT PRIMARY KEY,
  deleted_by TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.deleted_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins manage deleted members" ON public.deleted_members;
CREATE POLICY "admins manage deleted members"
  ON public.deleted_members FOR ALL
  USING (public.is_admin(auth.uid()));
