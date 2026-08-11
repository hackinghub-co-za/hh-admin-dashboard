-- Hacking Hub Admin Dashboard - Security Fixes (Vuln 1 from full-repo review)
-- Run this in the Supabase SQL Editor after 002-010 have already been applied.
--
-- Originally also carried the Vuln 2 and Vuln 3 fixes (update_my_directory_profile
-- UPDATE-only, get_member_directory membership check) - those have since been
-- folded directly into 010_member_directory.sql, which is now the consolidated,
-- current source of truth for both functions, so they aren't duplicated here.

-- =========================================================================
-- VULN 1: Self-service role escalation via missing WITH CHECK on
-- "Allow users to update their own profiles" (schema.sql:82-83).
--
-- That policy only had `USING (auth.uid() = id)`, and Postgres reuses USING as
-- the check when WITH CHECK is omitted - so nothing stopped a member from
-- PATCHing their own `role` column straight to 'admin', which every admin-gated
-- table in this schema trusts via is_admin(auth.uid()). Fix: pin `role` so a
-- non-admin can only ever write role='member' for themselves. Reuses the
-- existing is_admin() SECURITY DEFINER function (from 002_member_persistence.sql)
-- rather than a fresh subquery against profiles, to avoid reintroducing the
-- exact RLS infinite-recursion bug 002 already fixed on the neighboring policy.
-- =========================================================================

DROP POLICY IF EXISTS "Allow users to update their own profiles" ON public.profiles;
CREATE POLICY "Allow users to update their own profiles" ON public.profiles
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id AND (role = 'member' OR public.is_admin(auth.uid())));
