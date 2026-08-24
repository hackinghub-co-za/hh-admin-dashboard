-- Hacking Hub Admin Dashboard - Role-Specific Roadmap Checklists
-- Run this in the Supabase SQL Editor after 002-027 have already been applied.
-- Safe to re-run: every statement is idempotent.
--
-- Replaces the hardcoded, blurred "My Roadmap" dashboard tile with a real,
-- coach-curated checklist per member. Each member is assigned a track
-- (roadmap_track on member_profiles - SOC, Offensive Security, Cloud
-- Security, DevSecOps) and a set of roadmap_items, grouped into a "Core
-- Foundations" phase and a "Specialization" phase, further grouped by a
-- free-text category (e.g. "Certifications", "Networking", "Red Teaming").
--
-- Admins fully author the checklist (title, phase, category, ordering) - a
-- member can mark their own items done/not done and self-report progress
-- (detail) and a due_date on them, but never touch the plan itself (title,
-- phase, category, or anyone else's row). A member's row-level UPDATE policy
-- can't express "these columns only" - authenticated already has full table
-- privileges by Supabase's own default, same as every other table in this
-- project, so a plain RLS UPDATE policy here would let a member rewrite
-- their own title/phase/category too, not just completed/detail/due_date.
-- Instead both writes go through SECURITY DEFINER functions below
-- (toggle_my_roadmap_item, update_my_roadmap_item_progress), the same
-- explicit-ownership-check pattern already used for rsvp_for_event() and
-- submit_exit_feedback() - each only ever touches its own specific columns,
-- no matter what a client sends.
--
-- member_profiles.specialty (a member's self-described "about me" badge,
-- SPECIALTIES in src/lib/memberOptions.js) is kept in the same vocabulary as
-- roadmap_track below, so assigning one always matches the other - it used
-- to diverge (Red Team/Blue Team there vs Offensive Security/SOC here). Any
-- already-stored 'Red Team'/'Blue Team' rows are renamed below so no
-- existing member's profile silently shows a value that's no longer a valid
-- dropdown option.

ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS roadmap_track TEXT;

UPDATE public.member_profiles SET specialty = 'Offensive Security' WHERE specialty = 'Red Team';
UPDATE public.member_profiles SET specialty = 'SOC' WHERE specialty = 'Blue Team';

CREATE TABLE IF NOT EXISTS public.roadmap_items (
  id BIGSERIAL PRIMARY KEY,
  member_email TEXT NOT NULL,
  phase TEXT NOT NULL CHECK (phase IN ('Core Foundations', 'Specialization')),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT,
  due_date DATE,
  completed BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Adds due_date to a database where this table already existed - the inline
-- column above only takes effect on a fresh CREATE TABLE.
ALTER TABLE public.roadmap_items ADD COLUMN IF NOT EXISTS due_date DATE;

ALTER TABLE public.roadmap_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read own roadmap" ON public.roadmap_items;
CREATE POLICY "members read own roadmap"
  ON public.roadmap_items FOR SELECT
  TO authenticated
  USING (
    member_email = lower(auth.jwt() ->> 'email')
    AND public.is_member_allowed(auth.jwt() ->> 'email')
  );

-- No member INSERT/UPDATE/DELETE policy - the plan is admin-authored only.
-- Members mark items done via toggle_my_roadmap_item() below, not a direct
-- table write.
DROP POLICY IF EXISTS "admins manage roadmap" ON public.roadmap_items;
CREATE POLICY "admins manage roadmap"
  ON public.roadmap_items FOR ALL
  USING (public.is_admin(auth.uid()));

-- Lets a member flip completion on exactly one of their own items - never
-- the title, detail, phase, or anyone else's row, regardless of what a
-- crafted request tries to pass.
CREATE OR REPLACE FUNCTION public.toggle_my_roadmap_item(p_item_id BIGINT, p_completed BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.roadmap_items
  SET completed = p_completed, updated_at = timezone('utc'::text, now())
  WHERE id = p_item_id AND member_email = lower(auth.jwt() ->> 'email');
END;
$$;
GRANT EXECUTE ON FUNCTION public.toggle_my_roadmap_item(BIGINT, BOOLEAN) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.toggle_my_roadmap_item(BIGINT, BOOLEAN) FROM PUBLIC, anon;

-- Same pattern as toggle_my_roadmap_item() above, widened to also let a
-- member self-report how far along one of their own items is (a number or
-- percentage, e.g. "3/6" or "45%" - reuses the existing `detail` column
-- rather than adding a second free-text field for the same idea) and set its
-- due date. Still never touches title/phase/category/completed, and still
-- only ever the caller's own row.
CREATE OR REPLACE FUNCTION public.update_my_roadmap_item_progress(p_item_id BIGINT, p_detail TEXT, p_due_date DATE)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.roadmap_items
  SET detail = p_detail, due_date = p_due_date, updated_at = timezone('utc'::text, now())
  WHERE id = p_item_id AND member_email = lower(auth.jwt() ->> 'email');
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_my_roadmap_item_progress(BIGINT, TEXT, DATE) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.update_my_roadmap_item_progress(BIGINT, TEXT, DATE) FROM PUBLIC, anon;

-- member_profiles has no member-facing SELECT policy at all (see
-- 010_member_directory.sql's get_member_directory() for why - the table
-- holds money_owed, phone, offboarding notes, etc. that a member should
-- never read even about themselves via a broad policy). This is the same
-- narrow-exposure pattern as has_completed_onboarding(): one column, one
-- row, the caller's own.
CREATE OR REPLACE FUNCTION public.get_my_roadmap_track()
RETURNS TEXT
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT roadmap_track FROM public.member_profiles WHERE email = lower(auth.jwt() ->> 'email');
$$;
GRANT EXECUTE ON FUNCTION public.get_my_roadmap_track() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_roadmap_track() FROM PUBLIC, anon;
