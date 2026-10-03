-- Hacking Hub Admin Dashboard - Org Chart
-- Run this in the Supabase SQL Editor after 002-097 have already been
-- applied. Safe to re-run: every statement is idempotent.
--
-- Brand new concept: real staff structure (job title, department, who
-- reports to whom, employment type, monthly compensation) - nothing like
-- this exists anywhere else in this app. Deliberately NOT tied to
-- profiles.role (067_permission_scopes.sql) - role is only a portal
-- permission level ('admin'|'community_manager'|'mentor'|'member'), a
-- completely separate concept from a person's real job title or whether
-- they're staff at all. A staff member here might never sign into the
-- portal (a contractor, a part-time ops person), so there is deliberately
-- no FK to profiles or auth.users - email is optional free text.
--
-- Compensation is as sensitive as it gets, so this follows the exact
-- precedent already set by member_profiles (money_owed/monthly_remuneration,
-- 002_member_persistence.sql): one single admin-only RLS policy, whole
-- table, FOR ALL, no column-level masking, no audit trail, no extra
-- confirmation step. That's the one privacy pattern this app already
-- uses for money - this doesn't invent a new one. Deliberately NOT
-- is_community_manager(uid) (067_permission_scopes.sql), which returns
-- TRUE for role IN ('admin','community_manager') and would incidentally
-- let a community manager read/write compensation data.
--
-- Soft-archive, not hard-delete, for a departed staff member - matches
-- this app's general "don't erase people" philosophy (deleted_members,
-- member_profiles.status = 'Left'). status defaults to 'Active'; set it to
-- 'Inactive' instead of deleting the row.
--
-- reports_to_id is a nullable self-FK (NULL = top of the chart, i.e. the
-- founder). ON DELETE SET NULL means archiving/removing a manager never
-- orphans their reports into a dangling reference - their reports_to_id
-- just becomes NULL (falls to the top level) instead of failing or
-- cascading. Postgres does not prevent a reporting cycle via this FK on
-- its own; cycle prevention (best-effort) happens client-side in
-- src/lib/orgChartData.js / the Add/Edit modal, not here.

CREATE TABLE IF NOT EXISTS public.org_chart_members (
    id BIGSERIAL PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT,
    job_title TEXT NOT NULL,
    department TEXT,
    reports_to_id BIGINT REFERENCES public.org_chart_members(id) ON DELETE SET NULL,
    employment_type TEXT CHECK (employment_type IN ('Full-Time', 'Part-Time', 'Contractor', 'Volunteer')),
    monthly_compensation NUMERIC,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
    added_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- A person can't (sensibly) report to themselves at the DB level - cheap
-- to enforce here even though full multi-level cycle prevention has to
-- live client-side.
ALTER TABLE public.org_chart_members DROP CONSTRAINT IF EXISTS org_chart_members_not_self_reporting;
ALTER TABLE public.org_chart_members ADD CONSTRAINT org_chart_members_not_self_reporting
    CHECK (reports_to_id IS DISTINCT FROM id);

CREATE INDEX IF NOT EXISTS idx_org_chart_members_reports_to_id ON public.org_chart_members(reports_to_id);
CREATE INDEX IF NOT EXISTS idx_org_chart_members_status ON public.org_chart_members(status);

ALTER TABLE public.org_chart_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage org_chart_members" ON public.org_chart_members;
CREATE POLICY "Admins manage org_chart_members" ON public.org_chart_members
    FOR ALL USING (public.is_admin(auth.uid()));
