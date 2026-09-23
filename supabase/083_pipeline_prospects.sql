-- Sales pipeline tracker (admin-only) - people who are interested in or
-- about to join Hacking Hub, tracked from first contact through to
-- actually joining (or not). Deliberately NOT tied to member_profiles,
-- which only ever has rows for people who've actually joined - this is
-- the pre-join funnel. No overlap with manual_members (bookkeeping for
-- members who already joined outside the normal PayFast flow) or
-- referrals (a narrow, referral-reward-specific flow with its own
-- outcome-only status enum) - checked both before adding this table.

CREATE TABLE IF NOT EXISTS public.pipeline_prospects (
  id BIGSERIAL PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  -- 'Joined'/'Not Interested' are terminal columns, kept visible rather
  -- than deleted - the same "Won/Lost" idea a real sales board uses, so
  -- there's a visual record of how people actually moved through instead
  -- of just vanishing from the board.
  phase TEXT NOT NULL DEFAULT 'Lead' CHECK (phase IN ('Lead', 'Contacted', 'Interested', 'Ready to Join', 'Joined', 'Not Interested')),
  -- How they heard about HH - free text (referral, social media, event,
  -- etc.), same free-text convention cert_calendar.cert_name already uses
  -- rather than a CHECK enum that would need updating every time a new
  -- channel shows up.
  source TEXT,
  notes TEXT,
  -- Card position within its phase column - same sort_order pattern
  -- suggested_content (044_community_content.sql) already uses.
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.pipeline_prospects ENABLE ROW LEVEL SECURITY;

-- Admin-only, full stop - no member-facing read/write at all. Matches
-- manual_members/Focus 5's own admin-exclusive RLS shape. Direct
-- .from().insert()/.update()/.delete() from the client is safe here (no
-- RPC needed) since this FOR ALL policy already gates every operation.
DROP POLICY IF EXISTS "admins manage pipeline prospects" ON public.pipeline_prospects;
CREATE POLICY "admins manage pipeline prospects"
  ON public.pipeline_prospects FOR ALL
  USING (public.is_admin(auth.uid()));
