-- Hacking Hub Admin Dashboard - Talent Pool (phase 0: members)
-- Run this in the Supabase SQL Editor after 002-106 have already been
-- applied. Safe to re-run: every statement is idempotent.
--
-- A searchable list of members who have opted in to being put in front of
-- recruiters. The admin searches by keyword, skill and experience, ticks a
-- shortlist and hands over an anonymous recruiter pack (display ID, skills,
-- years, city, availability). Names and contact details are released one
-- person at a time, after the person says yes to that introduction, and every
-- reveal is logged (talent_contact_views).
--
-- Kept apart from member_profiles on purpose: that table holds pay, money
-- owed, age, gender and phone, and none of it may ever reach a recruiter. The
-- talent profile holds only what may be shared, and only for people who ticked
-- the consent box. Nothing here is readable directly: every table has RLS on
-- and no policy, so access is only through the functions below.
--
-- Skills come from two places and are kept apart so a recruiter can tell them
-- apart:
--   verified_skills  rebuilt every night from what the portal recorded: passed
--                    Cert Calendar exams, roadmap items finished (certs,
--                    Specialization, Advanced, approved Projects) and approved
--                    labs (labs.skills).
--   self_skills      typed by the member.
-- A profile hides itself 12 months after the member last confirmed it, and is
-- deleted when the member leaves. The public website sign-up (source =
-- 'public') is phase 1 and is not built here; the columns are ready for it.

-- =========================================================================
-- LAB SKILLS (what an approved lab proves)
-- =========================================================================
ALTER TABLE public.labs ADD COLUMN IF NOT EXISTS skills TEXT[] NOT NULL DEFAULT '{}';

UPDATE public.labs l SET skills = v.skills
FROM (VALUES
  ('grc-risk-register-kasi-kredit', ARRAY['Risk assessment', 'Risk registers']),
  ('grc-breach-or-not-mzansi-learn', ARRAY['POPIA', 'Breach notification', 'Incident response']),
  ('grc-popia-gap-analysis-ikhaya-health', ARRAY['POPIA', 'Gap analysis', 'Compliance']),
  ('devsecops-pipeline-sizwe-couriers', ARRAY['CI/CD security', 'DevSecOps', 'GitHub Actions']),
  ('devsecops-iac-thuthuka-pay', ARRAY['Terraform', 'Infrastructure as code', 'Checkov']),
  ('devsecops-container-lekker-eats', ARRAY['Docker', 'Container security']),
  ('netsec-firewall-umdoni-logistics', ARRAY['Firewalls', 'Network security']),
  ('netsec-packet-analysis-karoo-clinics', ARRAY['Wireshark', 'Packet analysis']),
  ('netsec-segmentation-masakhane-print-pack', ARRAY['Network segmentation', 'Network security']),
  ('aisec-prompt-injection-pharmaquik', ARRAY['Prompt injection', 'AI security']),
  ('aisec-rag-leakage-imbizo-hr', ARRAY['RAG security', 'AI security', 'Data leakage']),
  ('aisec-model-risk-mthunzi-claims', ARRAY['AI risk', 'Model risk']),
  ('azure-access-review-cape-vineyards', ARRAY['Azure', 'Access reviews', 'Entra ID']),
  ('azure-storage-hardening-jozi-print', ARRAY['Azure', 'Storage security']),
  ('azure-activity-hunt-drakensberg-telecom', ARRAY['Azure', 'KQL', 'Threat hunting', 'Microsoft Sentinel']),
  ('eng-storage-aws-amanzi-statements', ARRAY['AWS', 'S3 security', 'Terraform', 'Infrastructure as code']),
  ('eng-storage-azure-karoostream', ARRAY['Azure', 'Storage security', 'Terraform', 'Infrastructure as code']),
  ('eng-container-karoo-parcels', ARRAY['Docker', 'Docker Compose', 'Container security']),
  ('eng-kubernetes-masakhane-api', ARRAY['Kubernetes', 'Pod security']),
  ('eng-iam-aws-sibusiso-reports', ARRAY['AWS', 'IAM', 'Least privilege']),
  ('eng-iam-azure-ndlovu-insights', ARRAY['Azure', 'RBAC', 'Least privilege', 'Terraform']),
  ('eng-detection-spray-kaapstad-credit', ARRAY['Detection engineering', 'Password spraying', 'SIEM']),
  ('eng-audit-aws-own-account', ARRAY['AWS', 'Cloud auditing', 'S3 security']),
  ('eng-audit-azure-own-account', ARRAY['Azure', 'Cloud auditing', 'Storage security'])
) AS v(slug, skills)
WHERE l.slug = v.slug;

-- =========================================================================
-- TABLES
-- =========================================================================
CREATE SEQUENCE IF NOT EXISTS public.talent_display_seq START 101;

CREATE TABLE IF NOT EXISTS public.talent_profiles (
  id BIGSERIAL PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'member' CHECK (source IN ('member', 'public')),
  member_email TEXT UNIQUE,
  contact_email TEXT,
  -- The anonymous label a recruiter sees, for example T-0142.
  display_id TEXT NOT NULL UNIQUE DEFAULT ('T-' || lpad(nextval('public.talent_display_seq')::text, 4, '0')),
  status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('pending', 'visible', 'hidden')),
  admin_hidden BOOLEAN NOT NULL DEFAULT false,
  admin_notes TEXT,
  consent_at TIMESTAMPTZ,
  consent_version TEXT,
  last_confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Typed by the member.
  headline TEXT,
  summary TEXT,
  city TEXT,
  work_mode TEXT CHECK (work_mode IS NULL OR work_mode IN ('Office', 'Hybrid', 'Remote', 'Any')),
  available_from DATE,
  open_to_contract BOOLEAN NOT NULL DEFAULT false,
  self_skills TEXT[] NOT NULL DEFAULT '{}',
  -- Rebuilt every night from member_profiles and what the portal recorded.
  verified_skills JSONB NOT NULL DEFAULT '[]'::jsonb,
  job_title TEXT,
  years INTEGER,
  track TEXT,
  links JSONB NOT NULL DEFAULT '{}'::jsonb,
  verified_text TEXT NOT NULL DEFAULT '',
  self_text TEXT NOT NULL DEFAULT '',
  search_text TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT talent_member_needs_email CHECK (source <> 'member' OR member_email IS NOT NULL)
);
ALTER TABLE public.talent_profiles ENABLE ROW LEVEL SECURITY;
-- No policies: reached only through the functions below.

CREATE TABLE IF NOT EXISTS public.talent_contact_views (
  id BIGSERIAL PRIMARY KEY,
  profile_id BIGINT NOT NULL REFERENCES public.talent_profiles(id) ON DELETE CASCADE,
  viewed_by TEXT NOT NULL,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.talent_contact_views ENABLE ROW LEVEL SECURITY;

-- Words that mean the same thing, so one search finds all of them. A search
-- term is matched together with every other term in any group it appears in.
CREATE TABLE IF NOT EXISTS public.talent_synonyms (
  id SERIAL PRIMARY KEY,
  terms TEXT[] NOT NULL CHECK (cardinality(terms) >= 2)
);
ALTER TABLE public.talent_synonyms ENABLE ROW LEVEL SECURITY;

INSERT INTO public.talent_synonyms (terms)
SELECT v.terms FROM (VALUES
  (ARRAY['sc-200', 'sentinel', 'microsoft sentinel', 'kql', 'microsoft security operations']),
  (ARRAY['az-900', 'azure fundamentals']),
  (ARRAY['sc-900', 'security compliance identity']),
  (ARRAY['popia', 'data protection', 'privacy']),
  (ARRAY['soc', 'security operations', 'blue team']),
  (ARRAY['terraform', 'iac', 'infrastructure as code']),
  (ARRAY['kubernetes', 'k8s', 'kcsa']),
  (ARRAY['siem', 'splunk', 'sentinel']),
  (ARRAY['pentest', 'penetration testing', 'offensive', 'ejpt']),
  (ARRAY['iso 27001', 'iso27001', 'isms']),
  (ARRAY['aws', 'amazon web services']),
  (ARRAY['iam', 'identity and access', 'entra']),
  (ARRAY['docker', 'container', 'containers']),
  (ARRAY['security+', 'security plus', 'sy0-701']),
  (ARRAY['grc', 'governance risk compliance', 'compliance'])
) AS v(terms)
WHERE NOT EXISTS (SELECT 1 FROM public.talent_synonyms s WHERE s.terms = v.terms);

-- =========================================================================
-- DERIVED SKILLS
-- =========================================================================
-- Skills the portal itself recorded for one member, as
-- [{"tag": "...", "source": "cert" | "roadmap" | "project" | "lab"}], one per
-- tag (a passed exam outranks a ticked roadmap item).
CREATE OR REPLACE FUNCTION public._derive_verified_skills(p_email TEXT)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH aws AS (
    SELECT * FROM jsonb_each_text('{
      "AZ-900": "AWS Certified Cloud Practitioner", "AI-901": "AWS Certified AI Practitioner",
      "SC-900": "AWS Security Fundamentals", "AZ-104": "AWS Certified Solutions Architect – Associate",
      "SC-200": "AWS Certified Security – Specialty", "SC-500": "AWS Certified Security – Specialty",
      "SC-100": "AWS Certified Security – Specialty", "SC-300": "AWS Certified Security – Specialty",
      "AZ-305": "AWS Certified Solutions Architect – Professional", "AZ-400": "AWS Certified DevOps Engineer – Professional",
      "AI-103": "AWS Certified Machine Learning Engineer – Associate", "AZ-700": "AWS Certified Advanced Networking – Specialty"
    }'::jsonb)
  ),
  found AS (
    SELECT btrim(c.cert_name) AS tag, 'cert' AS source, 1 AS rank
    FROM public.cert_calendar c
    WHERE c.member_email = lower(p_email) AND c.result = 'Passed' AND btrim(c.cert_name) <> ''
    UNION ALL
    SELECT CASE WHEN ri.platform = 'AWS' THEN COALESCE(a.value, ri.title) ELSE ri.title END,
           CASE WHEN ri.phase = 'Projects' THEN 'project' ELSE 'roadmap' END,
           CASE WHEN ri.phase = 'Projects' THEN 3 ELSE 2 END
    FROM public.roadmap_items ri
    LEFT JOIN aws a ON a.key = ri.title
    WHERE ri.member_email = lower(p_email) AND ri.completed
      AND (
        (ri.phase = 'Core Foundations' AND ri.category = 'Certifications')
        OR (ri.phase IN ('Specialization', 'Advanced', 'Projects') AND ri.category <> 'Networking')
      )
    UNION ALL
    SELECT s, 'lab', 4
    FROM public.lab_attempts la
    JOIN public.labs l ON l.id = la.lab_id
    CROSS JOIN LATERAL unnest(l.skills) AS s
    WHERE la.member_email = lower(p_email) AND la.status = 'Approved'
  ),
  best AS (
    SELECT DISTINCT ON (lower(tag)) tag, source
    FROM found
    ORDER BY lower(tag), rank
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object('tag', tag, 'source', source) ORDER BY lower(tag)), '[]'::jsonb) FROM best;
$$;
REVOKE EXECUTE ON FUNCTION public._derive_verified_skills(TEXT) FROM PUBLIC, anon, authenticated;

-- Refreshes the derived half of one member's talent profile.
CREATE OR REPLACE FUNCTION public._rebuild_talent_profile(p_email TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_skills JSONB := public._derive_verified_skills(p_email);
  v_verified TEXT;
BEGIN
  SELECT lower(COALESCE(string_agg(e ->> 'tag', ' | '), '')) INTO v_verified FROM jsonb_array_elements(v_skills) e;

  UPDATE public.talent_profiles tp SET
    verified_skills = v_skills,
    job_title = NULLIF(btrim(COALESCE(mp.job_title, '')), ''),
    years = CASE WHEN mp.years_experience IS NULL THEN NULL ELSE floor(mp.years_experience)::integer END,
    track = NULLIF(NULLIF(mp.roadmap_track, ''), 'Not Assigned'),
    links = jsonb_strip_nulls(jsonb_build_object(
      'linkedin', NULLIF(mp.linkedin, ''), 'github', NULLIF(mp.github_url, ''), 'website', NULLIF(mp.website_url, ''))),
    verified_text = v_verified,
    self_text = lower(array_to_string(tp.self_skills, ' | ')),
    search_text = lower(concat_ws(' | ', tp.headline, mp.job_title, NULLIF(mp.roadmap_track, 'Not Assigned'), tp.summary, tp.city,
                                  v_verified, array_to_string(tp.self_skills, ' | '))),
    updated_at = now()
  FROM public.member_profiles mp
  WHERE tp.member_email = lower(p_email) AND mp.email = tp.member_email;
END;
$$;
REVOKE EXECUTE ON FUNCTION public._rebuild_talent_profile(TEXT) FROM PUBLIC, anon, authenticated;

-- Nightly: refresh every member profile, and delete the profile of anyone who
-- has left (their consent does not outlive their membership).
CREATE OR REPLACE FUNCTION public.rebuild_all_talent_profiles()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email TEXT;
  v_count INTEGER := 0;
BEGIN
  DELETE FROM public.talent_profiles tp
  WHERE tp.source = 'member'
    AND NOT EXISTS (SELECT 1 FROM public.member_profiles mp
                    WHERE mp.email = tp.member_email AND mp.status IN ('Active', 'Active (Permanent)'));
  FOR v_email IN SELECT member_email FROM public.talent_profiles WHERE source = 'member' LOOP
    PERFORM public._rebuild_talent_profile(v_email);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rebuild_all_talent_profiles() FROM PUBLIC, anon, authenticated;

-- =========================================================================
-- MEMBER FUNCTIONS
-- =========================================================================
-- The caller's own talent profile (null if they have not opted in), plus the
-- details already on their member profile so the form can offer them as a
-- starting point.
CREATE OR REPLACE FUNCTION public.get_my_talent_profile()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_row public.talent_profiles%ROWTYPE;
  v_mp public.member_profiles%ROWTYPE;
BEGIN
  IF v_email IS NULL OR NOT public.is_member_allowed(v_email) THEN
    RAISE EXCEPTION 'Not an approved member.';
  END IF;
  SELECT * INTO v_mp FROM public.member_profiles WHERE email = v_email;
  SELECT * INTO v_row FROM public.talent_profiles WHERE member_email = v_email;
  RETURN jsonb_build_object(
    'profile', CASE WHEN v_row.id IS NULL THEN NULL ELSE jsonb_build_object(
      'display_id', v_row.display_id, 'headline', v_row.headline, 'summary', v_row.summary, 'city', v_row.city,
      'work_mode', v_row.work_mode, 'available_from', v_row.available_from, 'open_to_contract', v_row.open_to_contract,
      'self_skills', to_jsonb(v_row.self_skills), 'verified_skills', v_row.verified_skills,
      'consent_at', v_row.consent_at, 'last_confirmed_at', v_row.last_confirmed_at,
      'visible', (NOT v_row.admin_hidden AND v_row.status = 'visible' AND v_row.last_confirmed_at > now() - interval '12 months')
    ) END,
    'defaults', jsonb_build_object(
      'summary', v_mp.about, 'city', v_mp.location, 'years', v_mp.years_experience, 'job_title', v_mp.job_title,
      'verified_skills', public._derive_verified_skills(v_email)
    )
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_talent_profile() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_talent_profile() FROM PUBLIC, anon;

-- Opt in, or update and re-confirm. Consent must be ticked; its date is kept
-- from the first time and its wording version from the latest save.
CREATE OR REPLACE FUNCTION public.save_my_talent_profile(
  p_headline TEXT, p_summary TEXT, p_city TEXT, p_work_mode TEXT, p_available_from DATE,
  p_open_to_contract BOOLEAN, p_self_skills TEXT[], p_consent BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_skills TEXT[];
BEGIN
  IF v_email IS NULL OR NOT public.is_member_allowed(v_email) THEN
    RAISE EXCEPTION 'Not an approved member.';
  END IF;
  IF p_consent IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Tick the box to agree before you join the talent pool.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.member_profiles WHERE email = v_email AND status IN ('Active', 'Active (Permanent)')) THEN
    RAISE EXCEPTION 'Only active members can join the talent pool.';
  END IF;
  IF p_headline IS NULL OR length(btrim(p_headline)) < 3 OR length(p_headline) > 120 THEN
    RAISE EXCEPTION 'Add a short headline, up to 120 characters.';
  END IF;
  IF p_summary IS NOT NULL AND length(p_summary) > 800 THEN
    RAISE EXCEPTION 'Keep the summary to 800 characters.';
  END IF;
  IF p_city IS NOT NULL AND length(p_city) > 60 THEN
    RAISE EXCEPTION 'Keep the city to 60 characters.';
  END IF;
  IF p_work_mode IS NOT NULL AND p_work_mode NOT IN ('Office', 'Hybrid', 'Remote', 'Any') THEN
    RAISE EXCEPTION 'Pick office, hybrid, remote or any.';
  END IF;

  -- Skills: trimmed, de-duplicated, at most 25, each up to 40 characters.
  SELECT COALESCE(array_agg(s ORDER BY first_pos), '{}') INTO v_skills FROM (
    SELECT (array_agg(btrim(x) ORDER BY ord))[1] AS s, min(ord) AS first_pos
    FROM unnest(COALESCE(p_self_skills, '{}')) WITH ORDINALITY AS t(x, ord)
    WHERE btrim(x) <> '' AND length(btrim(x)) <= 40
    GROUP BY lower(btrim(x))
    ORDER BY min(ord)
    LIMIT 25
  ) q;

  INSERT INTO public.talent_profiles (source, member_email, contact_email, headline, summary, city, work_mode, available_from,
                                      open_to_contract, self_skills, consent_at, consent_version, last_confirmed_at)
  VALUES ('member', v_email, v_email, btrim(p_headline), NULLIF(btrim(COALESCE(p_summary, '')), ''), NULLIF(btrim(COALESCE(p_city, '')), ''),
          p_work_mode, p_available_from, COALESCE(p_open_to_contract, false), v_skills, now(), 'v1', now())
  ON CONFLICT (member_email) DO UPDATE SET
    headline = EXCLUDED.headline,
    summary = EXCLUDED.summary,
    city = EXCLUDED.city,
    work_mode = EXCLUDED.work_mode,
    available_from = EXCLUDED.available_from,
    open_to_contract = EXCLUDED.open_to_contract,
    self_skills = EXCLUDED.self_skills,
    consent_at = COALESCE(public.talent_profiles.consent_at, now()),
    consent_version = 'v1',
    last_confirmed_at = now(),
    updated_at = now();

  PERFORM public._rebuild_talent_profile(v_email);
END;
$$;
GRANT EXECUTE ON FUNCTION public.save_my_talent_profile(TEXT, TEXT, TEXT, TEXT, DATE, BOOLEAN, TEXT[], BOOLEAN) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.save_my_talent_profile(TEXT, TEXT, TEXT, TEXT, DATE, BOOLEAN, TEXT[], BOOLEAN) FROM PUBLIC, anon;

-- Leave the pool: deletes the profile outright.
CREATE OR REPLACE FUNCTION public.delete_my_talent_profile()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
BEGIN
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Sign in first.';
  END IF;
  DELETE FROM public.talent_profiles WHERE member_email = v_email;
END;
$$;
GRANT EXECUTE ON FUNCTION public.delete_my_talent_profile() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_my_talent_profile() FROM PUBLIC, anon;

-- =========================================================================
-- ADMIN FUNCTIONS (admins only: this is personal information)
-- =========================================================================
-- Keyword search across visible profiles. Every typed word must be found
-- (with its synonyms) somewhere on the profile. Returns anonymous cards,
-- best match first: a hit in a verified skill counts 3, in a self-reported
-- skill 2, anywhere else 1.
CREATE OR REPLACE FUNCTION public.search_talent_pool(
  p_query TEXT DEFAULT NULL, p_track TEXT DEFAULT NULL, p_city TEXT DEFAULT NULL,
  p_min_years INTEGER DEFAULT NULL, p_verified_only BOOLEAN DEFAULT false, p_available_now BOOLEAN DEFAULT false,
  p_include_hidden BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE
AS $$
DECLARE
  v_query TEXT := lower(btrim(COALESCE(p_query, '')));
  v_words TEXT[];
  v_groups JSONB := '[]'::jsonb;
  v_w TEXT;
  v_terms TEXT[];
  v_items JSONB;
  v_total INTEGER;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can search the talent pool.';
  END IF;
  IF length(v_query) > 200 THEN
    RAISE EXCEPTION 'That search is too long.';
  END IF;

  IF v_query <> '' THEN
    -- A phrase that is itself a synonym ("iso 27001") stays one term.
    IF EXISTS (SELECT 1 FROM public.talent_synonyms s WHERE v_query = ANY (s.terms)) THEN
      v_words := ARRAY[v_query];
    ELSE
      v_words := regexp_split_to_array(v_query, '\s+');
    END IF;
    FOREACH v_w IN ARRAY v_words LOOP
      SELECT ARRAY(SELECT DISTINCT t FROM public.talent_synonyms s, unnest(s.terms) t WHERE v_w = ANY (s.terms)) INTO v_terms;
      v_terms := array_append(COALESCE(v_terms, '{}'), v_w);
      v_groups := v_groups || jsonb_build_array(to_jsonb(ARRAY(SELECT DISTINCT unnest(v_terms))));
    END LOOP;
  END IF;

  WITH hits AS (
    SELECT tp.id,
      COALESCE((
        SELECT sum(CASE
          WHEN EXISTS (SELECT 1 FROM jsonb_array_elements_text(g) t WHERE tp.verified_text LIKE '%' || replace(replace(replace(t, '\', '\\'), '%', '\%'), '_', '\_') || '%') THEN 3
          WHEN EXISTS (SELECT 1 FROM jsonb_array_elements_text(g) t WHERE tp.self_text LIKE '%' || replace(replace(replace(t, '\', '\\'), '%', '\%'), '_', '\_') || '%') THEN 2
          ELSE 1 END)
        FROM jsonb_array_elements(v_groups) g), 0)::integer AS score
    FROM public.talent_profiles tp
    JOIN public.member_profiles mp ON mp.email = tp.member_email AND mp.status IN ('Active', 'Active (Permanent)')
    WHERE (p_include_hidden OR (NOT tp.admin_hidden AND tp.status = 'visible' AND tp.last_confirmed_at > now() - interval '12 months'))
      AND tp.consent_at IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_groups) g
        WHERE NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements_text(g) t
          WHERE tp.search_text LIKE '%' || replace(replace(replace(t, '\', '\\'), '%', '\%'), '_', '\_') || '%'))
      AND (p_track IS NULL OR p_track = '' OR tp.track = p_track)
      AND (p_city IS NULL OR p_city = '' OR lower(tp.city) = lower(p_city))
      AND (p_min_years IS NULL OR COALESCE(tp.years, 0) >= p_min_years)
      AND (NOT COALESCE(p_verified_only, false) OR jsonb_array_length(tp.verified_skills) > 0)
      AND (NOT COALESCE(p_available_now, false) OR (tp.available_from IS NOT NULL AND tp.available_from <= current_date))
  ),
  top AS (
    SELECT tp.*, h.score FROM hits h JOIN public.talent_profiles tp ON tp.id = h.id
    ORDER BY h.score DESC, tp.years DESC NULLS LAST, tp.id
    LIMIT 200
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', t.id, 'display_id', t.display_id, 'source', t.source, 'score', t.score,
      'headline', t.headline, 'role', t.job_title, 'years', t.years, 'city', t.city, 'track', t.track,
      'work_mode', t.work_mode, 'open_to_contract', t.open_to_contract, 'available_from', t.available_from,
      'verified', COALESCE(jsonb_path_query_array(t.verified_skills, '$[*].tag'), '[]'::jsonb),
      'self', to_jsonb(t.self_skills), 'summary', t.summary,
      'hidden', (t.admin_hidden OR t.status <> 'visible' OR t.last_confirmed_at <= now() - interval '12 months'),
      'notes', t.admin_notes
    ) ORDER BY t.score DESC, t.years DESC NULLS LAST, t.id), '[]'::jsonb)
  INTO v_items FROM top t;

  SELECT count(*) INTO v_total FROM public.talent_profiles tp
  JOIN public.member_profiles mp ON mp.email = tp.member_email AND mp.status IN ('Active', 'Active (Permanent)')
  WHERE tp.consent_at IS NOT NULL AND NOT tp.admin_hidden AND tp.status = 'visible' AND tp.last_confirmed_at > now() - interval '12 months';

  RETURN jsonb_build_object('items', v_items, 'total_visible', v_total);
END;
$$;
GRANT EXECUTE ON FUNCTION public.search_talent_pool(TEXT, TEXT, TEXT, INTEGER, BOOLEAN, BOOLEAN, BOOLEAN) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.search_talent_pool(TEXT, TEXT, TEXT, INTEGER, BOOLEAN, BOOLEAN, BOOLEAN) FROM PUBLIC, anon;

-- Name and contact details for one profile, released after the person has
-- agreed to an introduction. Every call is logged.
CREATE OR REPLACE FUNCTION public.get_talent_contact(p_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tp public.talent_profiles%ROWTYPE;
  v_mp public.member_profiles%ROWTYPE;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can view contact details.';
  END IF;
  SELECT * INTO v_tp FROM public.talent_profiles WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That profile no longer exists.';
  END IF;
  SELECT * INTO v_mp FROM public.member_profiles WHERE email = v_tp.member_email;
  INSERT INTO public.talent_contact_views (profile_id, viewed_by) VALUES (p_id, lower(auth.jwt() ->> 'email'));
  RETURN jsonb_build_object(
    'display_id', v_tp.display_id, 'name', v_mp.full_name, 'email', COALESCE(v_tp.contact_email, v_tp.member_email),
    'phone', v_mp.phone, 'links', v_tp.links
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_talent_contact(BIGINT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_talent_contact(BIGINT) FROM PUBLIC, anon;

-- Hide or restore a profile, with a private note.
CREATE OR REPLACE FUNCTION public.set_talent_profile_hidden(p_id BIGINT, p_hidden BOOLEAN, p_notes TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can change the talent pool.';
  END IF;
  UPDATE public.talent_profiles SET admin_hidden = COALESCE(p_hidden, false), admin_notes = NULLIF(btrim(COALESCE(p_notes, '')), ''), updated_at = now()
  WHERE id = p_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_talent_profile_hidden(BIGINT, BOOLEAN, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.set_talent_profile_hidden(BIGINT, BOOLEAN, TEXT) FROM PUBLIC, anon;

-- The distinct tracks and cities in the pool, for the filter chips.
CREATE OR REPLACE FUNCTION public.get_talent_filters()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can search the talent pool.';
  END IF;
  RETURN jsonb_build_object(
    'tracks', COALESCE((SELECT jsonb_agg(DISTINCT track ORDER BY track) FROM public.talent_profiles WHERE track IS NOT NULL), '[]'::jsonb),
    'cities', COALESCE((SELECT jsonb_agg(DISTINCT city ORDER BY city) FROM public.talent_profiles WHERE city IS NOT NULL), '[]'::jsonb)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_talent_filters() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_talent_filters() FROM PUBLIC, anon;

-- Nightly rebuild, 01:30 SAST (23:30 UTC).
SELECT cron.unschedule('rebuild-talent-profiles-nightly')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'rebuild-talent-profiles-nightly');
SELECT cron.schedule(
  'rebuild-talent-profiles-nightly',
  '30 23 * * *',
  $$ SELECT public.rebuild_all_talent_profiles(); $$
);
