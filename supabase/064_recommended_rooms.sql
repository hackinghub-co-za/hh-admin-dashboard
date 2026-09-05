-- Hacking Hub Admin Dashboard - Daily TryHackMe Room recommendation
-- Run in the Supabase SQL Editor after 063_room_races.sql.
-- Safe to re-run.
--
-- Extends the existing Suggested Content feed (045_suggested_content.sql)
-- with a deterministic day-of-year rotation through an admin-curated
-- pool - the same "no daily admin upkeep" philosophy already used for the
-- LinkedIn 12-week plan's week rotation
-- (src/lib/linkedInPlaybookData.js's getCurrentWeekIndex), just applied to
-- days instead of ISO weeks.

CREATE TABLE IF NOT EXISTS public.recommended_rooms (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  difficulty TEXT CHECK (difficulty IN ('Easy', 'Medium', 'Hard')),
  added_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.recommended_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read recommended rooms" ON public.recommended_rooms;
CREATE POLICY "members read recommended rooms"
  ON public.recommended_rooms FOR SELECT
  TO authenticated
  USING (public.is_member_allowed(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "admins manage recommended rooms" ON public.recommended_rooms;
CREATE POLICY "admins manage recommended rooms"
  ON public.recommended_rooms FOR ALL
  USING (public.is_admin(auth.uid()));

-- Seed with well-known, genuinely beginner-through-intermediate friendly
-- TryHackMe rooms (real room names, not fabricated) so the feature has
-- content on day one - an admin can add/remove from this pool at any time.
INSERT INTO public.recommended_rooms (name, url, difficulty)
SELECT * FROM (VALUES
  ('Pre Security', 'https://tryhackme.com/module/pre-security', 'Easy'),
  ('Linux Fundamentals', 'https://tryhackme.com/module/linux-fundamentals', 'Easy'),
  ('Nmap', 'https://tryhackme.com/room/furthernmap', 'Easy'),
  ('Wireshark: The Basics', 'https://tryhackme.com/room/wiresharkthebasics', 'Easy'),
  ('OWASP Top 10', 'https://tryhackme.com/room/owasptop10', 'Medium'),
  ('Burp Suite: The Basics', 'https://tryhackme.com/room/burpsuitebasics', 'Medium'),
  ('Active Directory Basics', 'https://tryhackme.com/room/winadbasics', 'Medium'),
  ('Intro to Offensive Security', 'https://tryhackme.com/module/introduction-to-cyber-security', 'Easy'),
  ('Intro to SIEM', 'https://tryhackme.com/room/introtosiem', 'Medium'),
  ('Cyber Kill Chain', 'https://tryhackme.com/room/cyberkillchainm', 'Easy')
) AS v(name, url, difficulty)
WHERE NOT EXISTS (
  SELECT 1 FROM public.recommended_rooms rr WHERE rr.name = v.name
);

-- STABLE, not VOLATILE: same day always yields the same room for every
-- caller, and Postgres is free to cache the result within one statement.
CREATE OR REPLACE FUNCTION public.get_todays_recommended_room()
RETURNS TABLE (id BIGINT, name TEXT, url TEXT, difficulty TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.recommended_rooms;
  IF v_count = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT rr.id, rr.name, rr.url, rr.difficulty
  FROM public.recommended_rooms rr
  ORDER BY rr.id
  OFFSET (EXTRACT(doy FROM CURRENT_DATE)::INTEGER % v_count)
  LIMIT 1;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_todays_recommended_room() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_todays_recommended_room() FROM PUBLIC, anon;
