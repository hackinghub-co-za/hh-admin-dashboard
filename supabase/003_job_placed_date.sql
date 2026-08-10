-- Adds a placement date so "job placements this year" is a real, computable
-- number rather than a guess. Without a date, all we'd know is who is currently
-- marked "Job Placed" - not when, so a year-based count wouldn't be honest.
-- Run this in the Supabase SQL Editor after 002_member_persistence.sql.

ALTER TABLE public.member_profiles
  ADD COLUMN IF NOT EXISTS job_placed_date DATE;
