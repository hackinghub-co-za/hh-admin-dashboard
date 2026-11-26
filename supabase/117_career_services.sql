-- Hacking Hub Admin Dashboard - Career Services requests
-- Run after 002-116. Safe to re-run: every statement is idempotent.
--
-- The public site's free review pages post here through their intake Edge
-- Functions: linkedin-review-intake (hackinghub.co.za/linkedin-review.html,
-- new) and cv-review-intake (cv-review.html). Each request becomes one row,
-- shown on the admin portal's Career Services tab, and also a Sales Pipeline
-- lead as before.
--
-- LinkedIn reviews collect full name, email, phone and the LinkedIn profile
-- URL, and the visitor must agree that their review may be used for Hacking
-- Hub content (content_consent). CV reviews collect name and email; the CV
-- itself is still only emailed to the founder, never stored.
--
-- ip_hash (SHA-256 of IP + salt, never the raw IP) lets linkedin-review-intake
-- refuse more than 3 requests a day from one network. Both intakes clear it
-- on rows older than 90 days, as the site's privacy policy says. Admin only; the intake
-- functions use the service role.

CREATE TABLE IF NOT EXISTS public.career_service_requests (
  id BIGSERIAL PRIMARY KEY,
  service TEXT NOT NULL CHECK (service IN ('LinkedIn review', 'CV review')),
  full_name TEXT NOT NULL CHECK (char_length(btrim(full_name)) BETWEEN 1 AND 100),
  email TEXT NOT NULL,
  phone TEXT,
  linkedin_url TEXT,
  target_role TEXT,
  situation TEXT,
  content_consent BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'Call booked', 'Reviewed', 'Used for content', 'Closed')),
  notes TEXT CHECK (notes IS NULL OR char_length(notes) <= 2000),
  ip_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS career_service_requests_email_idx ON public.career_service_requests (email, created_at DESC);
CREATE INDEX IF NOT EXISTS career_service_requests_ip_idx ON public.career_service_requests (ip_hash, created_at DESC);

ALTER TABLE public.career_service_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admins manage career service requests" ON public.career_service_requests;
CREATE POLICY "admins manage career service requests"
  ON public.career_service_requests FOR ALL
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- The CV reviews that came in before this table existed, from their
-- Sales Pipeline cards (cv-review-intake already wrote target role and
-- situation into the card notes).
INSERT INTO public.career_service_requests (service, full_name, email, phone, target_role, situation, status, created_at)
SELECT 'CV review', p.full_name, lower(p.email), p.phone,
  substring(p.notes from 'Target role: ([^\n]+)'),
  substring(p.notes from 'Situation: ([^\n]+)'),
  'New',
  p.created_at
FROM public.pipeline_prospects p
WHERE p.source = 'Free CV review' AND p.email IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.career_service_requests r WHERE r.service = 'CV review' AND r.email = lower(p.email));
