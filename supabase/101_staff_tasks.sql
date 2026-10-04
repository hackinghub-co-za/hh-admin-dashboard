-- Hacking Hub Admin Dashboard - Staff task tracker (kanban)
-- Run this in the Supabase SQL Editor after 002-100 have already been
-- applied. Safe to re-run: every statement is idempotent.
--
-- A shared kanban board for the team on the admin side: admins and
-- community managers. Mentors have no access. A task can be marked
-- admin_only, in which case community managers can neither see nor touch
-- it (same reasoning as org_chart_members - some things on a founder's
-- list shouldn't be visible to the rest of the team).
--
-- RLS note: is_community_manager() is INCLUSIVE (true for admins too, see
-- 067_permission_scopes.sql), so the community-manager policy below is
-- written as "can manage tasks that are not admin_only" and ORs with the
-- admin policy - it never grants anything admin_only to a non-admin.

CREATE TABLE IF NOT EXISTS public.staff_tasks (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  description TEXT CHECK (description IS NULL OR length(description) <= 4000),
  status TEXT NOT NULL DEFAULT 'To Do' CHECK (status IN ('Backlog', 'To Do', 'In Progress', 'In Review', 'Done')),
  priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
  assignee_email TEXT,
  due_date DATE,
  labels TEXT[] NOT NULL DEFAULT '{}' CHECK (cardinality(labels) <= 6),
  checklist JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(checklist) = 'array' AND jsonb_array_length(checklist) <= 30),
  admin_only BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_staff_tasks_status_sort ON public.staff_tasks(status, sort_order);
CREATE INDEX IF NOT EXISTS idx_staff_tasks_assignee ON public.staff_tasks(lower(assignee_email));
CREATE INDEX IF NOT EXISTS idx_staff_tasks_open_due ON public.staff_tasks(due_date) WHERE status <> 'Done';

ALTER TABLE public.staff_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins manage staff tasks" ON public.staff_tasks;
CREATE POLICY "admins manage staff tasks" ON public.staff_tasks
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS "community managers manage shared staff tasks" ON public.staff_tasks;
CREATE POLICY "community managers manage shared staff tasks" ON public.staff_tasks
  FOR ALL TO authenticated
  USING (public.is_community_manager(auth.uid()) AND NOT admin_only)
  WITH CHECK (public.is_community_manager(auth.uid()) AND NOT admin_only);

-- Keeps completed_at / updated_at honest no matter which client path
-- changed the row, and refuses assignments that can't work: the assignee
-- must be an admin or community manager, and an admin_only task can only
-- go to an admin (a community manager assigned one would never see it).
-- Only re-checked when the assignee or privacy actually changes, so a
-- later role change never blocks editing an old task.
CREATE OR REPLACE FUNCTION public.staff_tasks_before_write()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_role TEXT;
BEGIN
  NEW.assignee_email := NULLIF(lower(trim(COALESCE(NEW.assignee_email, ''))), '');

  IF NEW.assignee_email IS NOT NULL AND (
       TG_OP = 'INSERT'
       OR NEW.assignee_email IS DISTINCT FROM lower(COALESCE(OLD.assignee_email, ''))
       OR NEW.admin_only IS DISTINCT FROM OLD.admin_only
     ) THEN
    SELECT p.role INTO v_role FROM public.profiles p WHERE lower(p.email) = NEW.assignee_email;
    IF v_role IS NULL OR v_role NOT IN ('admin', 'community_manager') THEN
      RAISE EXCEPTION 'Tasks can only be assigned to admins and community managers.';
    END IF;
    IF NEW.admin_only AND v_role <> 'admin' THEN
      RAISE EXCEPTION 'An admins-only task can only be assigned to an admin.';
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.completed_at := CASE WHEN NEW.status = 'Done' THEN now() ELSE NULL END;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.completed_at := CASE WHEN NEW.status = 'Done' THEN now() ELSE NULL END;
    NEW.updated_at := now();
  ELSIF NEW.title IS DISTINCT FROM OLD.title
     OR NEW.description IS DISTINCT FROM OLD.description
     OR NEW.priority IS DISTINCT FROM OLD.priority
     OR NEW.assignee_email IS DISTINCT FROM OLD.assignee_email
     OR NEW.due_date IS DISTINCT FROM OLD.due_date
     OR NEW.labels IS DISTINCT FROM OLD.labels
     OR NEW.checklist IS DISTINCT FROM OLD.checklist
     OR NEW.admin_only IS DISTINCT FROM OLD.admin_only THEN
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS staff_tasks_before_write ON public.staff_tasks;
CREATE TRIGGER staff_tasks_before_write
  BEFORE INSERT OR UPDATE ON public.staff_tasks
  FOR EACH ROW EXECUTE FUNCTION public.staff_tasks_before_write();

-- One round trip for a drag: p_moves = [{"id":1,"status":"Done","sort_order":0}, ...].
-- SECURITY INVOKER on purpose: RLS still decides which rows the caller may
-- touch, so a community manager can never move an admin_only task.
CREATE OR REPLACE FUNCTION public.move_staff_tasks(p_moves JSONB)
RETURNS VOID
LANGUAGE sql SECURITY INVOKER SET search_path = public
AS $$
  UPDATE public.staff_tasks t
  SET status = m.status, sort_order = m.sort_order
  FROM jsonb_to_recordset(p_moves) AS m(id BIGINT, status TEXT, sort_order INTEGER)
  WHERE t.id = m.id
    AND jsonb_typeof(p_moves) = 'array'
    AND jsonb_array_length(p_moves) <= 200;
$$;
GRANT EXECUTE ON FUNCTION public.move_staff_tasks(JSONB) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.move_staff_tasks(JSONB) FROM PUBLIC, anon;

-- Who a task can be assigned to. Community managers can't read profiles
-- directly, so this is the only way their board can list the team.
CREATE OR REPLACE FUNCTION public.get_task_assignees()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE
AS $$
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_community_manager(auth.uid())) THEN
    RAISE EXCEPTION 'Only admins and community managers can view this.';
  END IF;
  RETURN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('email', lower(p.email), 'full_name', p.full_name, 'role', p.role)
      ORDER BY CASE p.role WHEN 'admin' THEN 0 ELSE 1 END, lower(COALESCE(p.full_name, p.email))), '[]'::jsonb)
    FROM public.profiles p
    WHERE p.role IN ('admin', 'community_manager')
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_task_assignees() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_task_assignees() FROM PUBLIC, anon;
