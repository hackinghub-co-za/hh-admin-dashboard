-- Hacking Hub Admin Dashboard - Mentor Mentees
-- Run this in the Supabase SQL Editor after 002-079 have already been
-- applied. Safe to re-run: every statement is idempotent.
--
-- The 'mentor' role has existed since 067_permission_scopes.sql, but was
-- never actually scoped - a mentor could see and manage EVERY member's
-- roadmap and cert calendar entry, the same unrestricted access as an
-- admin. Nobody has ever actually held the mentor role in production
-- (confirmed via `SELECT * FROM profiles WHERE role = 'mentor'` returning
-- zero rows before this shipped), so redefining it here to be properly
-- scoped - a mentor can only see/manage their OWN assigned mentees' roadmap
-- and cert calendar entries, not the whole roster - changes nothing for
-- any real, currently-active account.
--
-- Events are deliberately NOT scoped the same way: community_events isn't
-- owned by one member the way a roadmap or cert booking is, so a mentor
-- just gets the same "members read community events" visibility every
-- member already has (019_events.sql) - this migration only adds their
-- sidebar access to that view, no new RLS needed there.
--
-- CV reviews, interview prep, and interview logs are left as the mentor's
-- original unrestricted grant (067_permission_scopes.sql PART 3) - only
-- roadmap and cert calendar were asked to be scoped to mentees.

CREATE TABLE IF NOT EXISTS public.mentor_mentees (
  id BIGSERIAL PRIMARY KEY,
  mentor_email TEXT NOT NULL,
  mentee_email TEXT NOT NULL,
  added_by TEXT,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (mentor_email, mentee_email)
);

CREATE INDEX IF NOT EXISTS idx_mentor_mentees_mentor ON public.mentor_mentees(mentor_email);

ALTER TABLE public.mentor_mentees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins manage mentor mentees" ON public.mentor_mentees;
CREATE POLICY "admins manage mentor mentees"
  ON public.mentor_mentees FOR ALL
  USING (public.is_admin(auth.uid()));

-- A mentor only ever needs to read their OWN assignments (to build "my
-- mentees" lists client-side) - never anyone else's mentor's roster.
DROP POLICY IF EXISTS "mentors read own mentee list" ON public.mentor_mentees;
CREATE POLICY "mentors read own mentee list"
  ON public.mentor_mentees FOR SELECT
  USING (mentor_email = lower(auth.jwt() ->> 'email'));

-- The real scoping check: true for an admin (unrestricted, as always), or
-- for a mentor specifically assigned to this member. Used in place of the
-- old blanket is_mentor(auth.uid()) wherever mentor access needs to be
-- per-member rather than roster-wide.
CREATE OR REPLACE FUNCTION public.is_mentor_of(p_member_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE
AS $$
  SELECT public.is_admin(auth.uid()) OR (
    public.is_mentor(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.mentor_mentees mm
      WHERE mm.mentor_email = lower(auth.jwt() ->> 'email')
        AND mm.mentee_email = lower(p_member_email)
    )
  );
$$;

-- Re-scopes roadmap_items (028_roadmap.sql) from "any mentor, any member"
-- down to "only this mentor's own assigned mentees" - RLS then transparently
-- filters every existing query in AdminDashboard.jsx's Roadmaps tab down to
-- just the mentee rows, with no client-side changes needed.
DROP POLICY IF EXISTS "admins manage roadmap" ON public.roadmap_items;
CREATE POLICY "admins manage roadmap"
  ON public.roadmap_items FOR ALL
  USING (public.is_admin(auth.uid()) OR public.is_mentor_of(member_email));

-- Same re-scoping for cert_calendar (024_cert_calendar.sql) - a mentor now
-- only sees/manages their own mentees' booked exams, not the whole
-- community calendar. Still open to community_manager unrestricted, per
-- the founder's existing PART 3 decision.
DROP POLICY IF EXISTS "admins manage cert calendar" ON public.cert_calendar;
CREATE POLICY "admins manage cert calendar"
  ON public.cert_calendar FOR ALL
  USING (
    public.is_admin(auth.uid())
    OR public.is_mentor_of(member_email)
    OR public.is_community_manager(auth.uid())
  );

-- review_project_submission() (067_permission_scopes.sql PART 3) let any
-- mentor approve/reject ANY member's Projects submission - re-checked here
-- against the specific item's own member_email instead of a blanket role
-- check, once that's been looked up.
CREATE OR REPLACE FUNCTION public.review_project_submission(p_item_id BIGINT, p_approved BOOLEAN, p_note TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_member_email TEXT;
  v_phase TEXT;
BEGIN
  SELECT member_email, phase INTO v_member_email, v_phase
  FROM public.roadmap_items WHERE id = p_item_id;

  IF v_member_email IS NULL THEN
    RAISE EXCEPTION 'Item not found.';
  END IF;

  IF NOT public.is_mentor_of(v_member_email) THEN
    RAISE EXCEPTION 'Only an admin or this member''s assigned mentor can review Project submissions.';
  END IF;

  IF v_phase != 'Projects' THEN
    RAISE EXCEPTION 'This item is not a Projects submission.';
  END IF;

  UPDATE public.roadmap_items
  SET review_status = CASE WHEN p_approved THEN 'Approved' ELSE 'Rejected' END,
      completed = p_approved,
      review_note = p_note,
      reviewed_at = timezone('utc'::text, now()),
      updated_at = timezone('utc'::text, now())
  WHERE id = p_item_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.review_project_submission(BIGINT, BOOLEAN, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.review_project_submission(BIGINT, BOOLEAN, TEXT) FROM PUBLIC, anon;
