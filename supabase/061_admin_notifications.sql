-- Hacking Hub Admin Dashboard - Admin Notification Bell
-- Run in the Supabase SQL Editor after 002-060 have already been applied.
-- Safe to re-run: every statement is idempotent.
--
-- A real in-app notification feed for admins, starting with one event: a
-- member marking a roadmap item complete. Deliberately NOT an email per
-- toggle - a member can check off several items in one sitting, and an
-- inbox flooded with one email per checkbox would get ignored fast. This
-- is a bell icon (Sidebar.jsx) instead, checked whenever an admin wants to.
--
-- (The other half of the original ask - being told when a disengagement
-- email goes out - already exists: roadmap-reminder-email/index.ts emails
-- ADMIN_ALERT_EMAIL once, at the real 21-day disengagement threshold. That
-- needed no changes here.)
--
-- No member-facing INSERT policy at all - the only way a row is ever
-- created is via toggle_my_roadmap_item() below (a SECURITY DEFINER
-- function, bypasses RLS entirely), redefined here rather than in
-- 028_roadmap.sql because this table doesn't exist yet when that file
-- runs on a fresh install.

CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id BIGSERIAL PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'roadmap_completed',
  member_email TEXT NOT NULL,
  member_name TEXT,
  message TEXT NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

-- Admins read, mark read, and (in principle) manage every row - there is
-- no member-facing policy of any kind, so this FOR ALL is the only way in
-- besides the SECURITY DEFINER function below.
DROP POLICY IF EXISTS "admins manage admin notifications" ON public.admin_notifications;
CREATE POLICY "admins manage admin notifications"
  ON public.admin_notifications FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_admin_notifications_created ON public.admin_notifications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_notifications_unread ON public.admin_notifications (read_at) WHERE read_at IS NULL;

-- Redefines toggle_my_roadmap_item() (028_roadmap.sql) - same signature, so
-- a plain CREATE OR REPLACE is enough (no argument list change, unlike the
-- log_my_interview() precedent in 058_member_interviews.sql). Ownership
-- check and the actual UPDATE are byte-for-byte the same as before; the
-- only addition is the notification insert, and only on a genuine
-- false-to-true transition - re-toggling an already-complete item, or
-- unchecking one, never notifies. member_profiles.full_name (not the
-- verified auth email) is used for the message when set, since that's what
-- an admin actually recognizes a member by everywhere else in this app.
CREATE OR REPLACE FUNCTION public.toggle_my_roadmap_item(p_item_id BIGINT, p_completed BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_title TEXT;
  v_was_completed BOOLEAN;
  v_name TEXT;
BEGIN
  SELECT completed INTO v_was_completed
  FROM public.roadmap_items
  WHERE id = p_item_id AND member_email = v_email;

  UPDATE public.roadmap_items
  SET completed = p_completed, updated_at = timezone('utc'::text, now())
  WHERE id = p_item_id AND member_email = v_email
  RETURNING title INTO v_title;

  IF p_completed AND v_title IS NOT NULL AND (v_was_completed IS DISTINCT FROM true) THEN
    SELECT full_name INTO v_name FROM public.member_profiles WHERE email = v_email;
    INSERT INTO public.admin_notifications (type, member_email, member_name, message)
    VALUES (
      'roadmap_completed',
      v_email,
      v_name,
      COALESCE(v_name, v_email) || ' completed "' || v_title || '"'
    );
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.toggle_my_roadmap_item(BIGINT, BOOLEAN) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.toggle_my_roadmap_item(BIGINT, BOOLEAN) FROM PUBLIC, anon;
