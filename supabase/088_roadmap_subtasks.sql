-- Hacking Hub Admin Dashboard - per-member subtask ticks for Core
-- Foundations roadmap items. Run in the Supabase SQL Editor after 028
-- (roadmap) has been applied. Safe to re-run.
--
-- The subtask *catalog* (which subtasks each item has, their labels and
-- stable keys) lives in code (CORE_FOUNDATION_SUBTASKS in memberOptions.js)
-- - a cert's exam domains or a pathway's courses are fixed reference
-- content, not member data. This table only records which of those a given
-- member has ticked off. Keyed by (member_email, item_title, subtask_key)
-- rather than a roadmap_items.id, so a member's progress survives their
-- Core Foundations row being re-created (assign_my_core_foundations can
-- re-seed items) and maps by the same title the catalog is keyed on.
--
-- Auto-complete of the parent item at 100% is driven client-side by the
-- existing toggle_my_roadmap_item() RPC (the frontend knows the catalog's
-- total subtask count; the DB does not), so this file adds no completion
-- logic of its own - just the read policy and the write RPC.

CREATE TABLE IF NOT EXISTS public.roadmap_item_subtasks (
  member_email TEXT NOT NULL,
  item_title TEXT NOT NULL,
  subtask_key TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (member_email, item_title, subtask_key)
);

ALTER TABLE public.roadmap_item_subtasks ENABLE ROW LEVEL SECURITY;

-- A member reads their own subtask ticks; admins read all (for the admin
-- Roadmaps view / support). Writes go through toggle_my_roadmap_subtask()
-- below, same "self-service via SECURITY DEFINER RPC, not raw table
-- access" pattern as toggle_my_roadmap_item().
DROP POLICY IF EXISTS "members read own roadmap subtasks" ON public.roadmap_item_subtasks;
CREATE POLICY "members read own roadmap subtasks"
  ON public.roadmap_item_subtasks FOR SELECT
  TO authenticated
  USING (member_email = lower(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "admins manage roadmap subtasks" ON public.roadmap_item_subtasks;
CREATE POLICY "admins manage roadmap subtasks"
  ON public.roadmap_item_subtasks FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_roadmap_item_subtasks_member ON public.roadmap_item_subtasks (member_email);

-- Ticks or un-ticks one subtask for the calling member. Upsert on tick,
-- delete on un-tick (keeps the table to only the subtasks actually done,
-- so a simple row-per-done-subtask read is the member's progress).
CREATE OR REPLACE FUNCTION public.toggle_my_roadmap_subtask(p_item_title TEXT, p_subtask_key TEXT, p_completed BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
BEGIN
  IF NOT public.is_member_allowed(v_email) THEN
    RAISE EXCEPTION 'Not an approved member.';
  END IF;

  IF p_completed THEN
    INSERT INTO public.roadmap_item_subtasks (member_email, item_title, subtask_key, completed, updated_at)
    VALUES (v_email, p_item_title, p_subtask_key, true, timezone('utc'::text, now()))
    ON CONFLICT (member_email, item_title, subtask_key)
    DO UPDATE SET completed = true, updated_at = timezone('utc'::text, now());
  ELSE
    DELETE FROM public.roadmap_item_subtasks
    WHERE member_email = v_email AND item_title = p_item_title AND subtask_key = p_subtask_key;
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.toggle_my_roadmap_subtask(TEXT, TEXT, BOOLEAN) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.toggle_my_roadmap_subtask(TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;
