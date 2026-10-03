-- Hacking Hub Admin Dashboard - Labs
-- Run this in the Supabase SQL Editor after 002-098 have already been
-- applied. Safe to re-run: every statement is idempotent.
--
-- Two kinds of lab under one member tab:
--   'curated' - an external lab (another platform) picked by staff. The
--               member submits a proof link; staff approve it, same trust
--               model as daily_room_logs (031) and roadmap proof (028).
--   'hub'     - Hacking Hub's own scenario labs that run inside the portal.
--               Brief/evidence/task prompts ship in the React bundle
--               (src/data/labs/*.js); correct answers, model answers and
--               rubrics live ONLY in lab_answer_keys below, which members
--               can never read directly - anything in the bundle is
--               readable in dev tools. Objective tasks are graded here,
--               server-side, on submit; written tasks get a staff rubric
--               review.
--
-- Deliberately NOT connected to Hub Score (founder decision, 2026-10-03).
-- Reviewers: admins and community managers, same reach as Room Logs.

-- =========================================================================
-- TABLES
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.labs (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('curated', 'hub')),
  title TEXT NOT NULL,
  summary TEXT,
  track TEXT NOT NULL,
  difficulty TEXT NOT NULL DEFAULT 'Beginner' CHECK (difficulty IN ('Beginner', 'Intermediate', 'Advanced')),
  est_minutes INTEGER CHECK (est_minutes IS NULL OR est_minutes BETWEEN 5 AND 600),
  provider TEXT,
  external_url TEXT,
  roadmap_item_title TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- A curated lab is nothing but a link, so it must have a safe one.
  CONSTRAINT labs_curated_needs_url CHECK (kind <> 'curated' OR external_url ~* '^https://')
);

CREATE TABLE IF NOT EXISTS public.lab_attempts (
  id BIGSERIAL PRIMARY KEY,
  lab_id BIGINT NOT NULL REFERENCES public.labs(id) ON DELETE CASCADE,
  member_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'In Progress' CHECK (status IN ('In Progress', 'Submitted', 'Approved', 'Needs Changes')),
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  proof_url TEXT,
  auto_score INTEGER,
  auto_max INTEGER,
  task_results JSONB,
  reviewer_score INTEGER,
  rubric_scores JSONB,
  feedback TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  submitted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lab_id, member_email)
);

-- grading: 'single' (answer = "option_id"), 'multi' (answer = ["id", ...],
-- partial credit, wrong picks cancel right ones), 'match' (answer =
-- {"item_id": "choice_id", ...}, partial credit per item), 'risk_score'
-- (answer = {"min": n, "max": n} on likelihood x impact), 'rubric'
-- (written, staff-scored - never auto-graded, 0 auto points).
CREATE TABLE IF NOT EXISTS public.lab_answer_keys (
  lab_id BIGINT NOT NULL REFERENCES public.labs(id) ON DELETE CASCADE,
  task_key TEXT NOT NULL,
  grading TEXT NOT NULL CHECK (grading IN ('single', 'multi', 'match', 'risk_score', 'rubric')),
  answer JSONB,
  points INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
  model_answer TEXT,
  rubric JSONB,
  PRIMARY KEY (lab_id, task_key)
);

CREATE INDEX IF NOT EXISTS idx_lab_attempts_member_email ON public.lab_attempts(member_email);
CREATE INDEX IF NOT EXISTS idx_lab_attempts_status ON public.lab_attempts(status);
CREATE INDEX IF NOT EXISTS idx_labs_published_track ON public.labs(is_published, track);

-- =========================================================================
-- RLS
-- =========================================================================

ALTER TABLE public.labs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_answer_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read published labs" ON public.labs;
CREATE POLICY "members read published labs" ON public.labs
  FOR SELECT TO authenticated
  USING (is_published = true);

DROP POLICY IF EXISTS "staff manage labs" ON public.labs;
CREATE POLICY "staff manage labs" ON public.labs
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_community_manager(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) OR public.is_community_manager(auth.uid()));

-- Members only ever READ their own attempts directly. Every member write
-- goes through the SECURITY DEFINER functions below, so there is no path
-- for a member to set their own status, score or feedback.
DROP POLICY IF EXISTS "members read own lab attempts" ON public.lab_attempts;
CREATE POLICY "members read own lab attempts" ON public.lab_attempts
  FOR SELECT TO authenticated
  USING (member_email = lower(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "staff read lab attempts" ON public.lab_attempts;
CREATE POLICY "staff read lab attempts" ON public.lab_attempts
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_community_manager(auth.uid()));

-- No member policy at all on answer keys. Staff can read them for the
-- review screen; writes happen only through migrations.
DROP POLICY IF EXISTS "staff read lab answer keys" ON public.lab_answer_keys;
CREATE POLICY "staff read lab answer keys" ON public.lab_answer_keys
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) OR public.is_community_manager(auth.uid()));

-- =========================================================================
-- MEMBER FUNCTIONS
-- =========================================================================

-- Autosave for a Hub Lab in progress. Allowed while In Progress or Needs
-- Changes; a Submitted or Approved attempt is locked.
CREATE OR REPLACE FUNCTION public.save_lab_progress(p_lab_id BIGINT, p_answers JSONB)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_status TEXT;
BEGIN
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Sign in to save lab progress.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.labs l WHERE l.id = p_lab_id AND l.kind = 'hub' AND l.is_published) THEN
    RAISE EXCEPTION 'That lab is not available.';
  END IF;
  IF p_answers IS NULL OR jsonb_typeof(p_answers) <> 'object' OR pg_column_size(p_answers) > 100000 THEN
    RAISE EXCEPTION 'Those answers could not be saved.';
  END IF;

  SELECT la.status INTO v_status FROM public.lab_attempts la
  WHERE la.lab_id = p_lab_id AND la.member_email = v_email;

  IF v_status IN ('Submitted', 'Approved') THEN
    RAISE EXCEPTION 'This lab has already been submitted.';
  END IF;

  INSERT INTO public.lab_attempts (lab_id, member_email, status, answers)
  VALUES (p_lab_id, v_email, 'In Progress', p_answers)
  ON CONFLICT (lab_id, member_email) DO UPDATE SET
    answers = EXCLUDED.answers,
    updated_at = now();
END;
$$;
GRANT EXECUTE ON FUNCTION public.save_lab_progress(BIGINT, JSONB) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.save_lab_progress(BIGINT, JSONB) FROM PUBLIC, anon;

-- Submit a Hub Lab: grade every objective task against lab_answer_keys and
-- lock the attempt for review. On a resubmission after Needs Changes, the
-- objective answers and their grades from the FIRST submission are kept -
-- model answers were visible in between, so only written (rubric) answers
-- may change.
CREATE OR REPLACE FUNCTION public.submit_lab_attempt(p_lab_id BIGINT, p_answers JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_attempt public.lab_attempts%ROWTYPE;
  v_answers JSONB := COALESCE(p_answers, '{}'::jsonb);
  v_key RECORD;
  v_given JSONB;
  v_results JSONB := '{}'::jsonb;
  v_score INTEGER := 0;
  v_max INTEGER := 0;
  v_earned INTEGER;
  v_total INTEGER;
  v_hits INTEGER;
  v_wrong INTEGER;
  v_product NUMERIC;
BEGIN
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Sign in to submit a lab.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.labs l WHERE l.id = p_lab_id AND l.kind = 'hub' AND l.is_published) THEN
    RAISE EXCEPTION 'That lab is not available.';
  END IF;
  IF jsonb_typeof(v_answers) <> 'object' OR pg_column_size(v_answers) > 100000 THEN
    RAISE EXCEPTION 'Those answers could not be submitted.';
  END IF;

  SELECT * INTO v_attempt FROM public.lab_attempts la
  WHERE la.lab_id = p_lab_id AND la.member_email = v_email;

  IF v_attempt.status IN ('Submitted', 'Approved') THEN
    RAISE EXCEPTION 'This lab has already been submitted.';
  END IF;

  -- Resubmission: keep the first submission's objective answers + grades.
  IF v_attempt.status = 'Needs Changes' AND v_attempt.task_results IS NOT NULL THEN
    FOR v_key IN
      SELECT k.task_key FROM public.lab_answer_keys k
      WHERE k.lab_id = p_lab_id AND k.grading <> 'rubric'
    LOOP
      IF v_attempt.answers ? v_key.task_key THEN
        v_answers := jsonb_set(v_answers, ARRAY[v_key.task_key], v_attempt.answers -> v_key.task_key);
      ELSE
        v_answers := v_answers - v_key.task_key;
      END IF;
    END LOOP;

    UPDATE public.lab_attempts la SET
      answers = v_answers,
      status = 'Submitted',
      submitted_at = now(),
      updated_at = now()
    WHERE la.id = v_attempt.id;

    RETURN jsonb_build_object('auto_score', v_attempt.auto_score, 'auto_max', v_attempt.auto_max, 'task_results', v_attempt.task_results);
  END IF;

  FOR v_key IN
    SELECT k.task_key, k.grading, k.answer, k.points FROM public.lab_answer_keys k
    WHERE k.lab_id = p_lab_id AND k.grading <> 'rubric'
  LOOP
    v_given := v_answers -> v_key.task_key;
    v_earned := 0;

    IF v_key.grading = 'single' THEN
      IF v_given IS NOT NULL AND v_given = v_key.answer THEN
        v_earned := v_key.points;
      END IF;

    ELSIF v_key.grading = 'multi' THEN
      v_total := jsonb_array_length(v_key.answer);
      IF v_given IS NOT NULL AND jsonb_typeof(v_given) = 'array' AND v_total > 0 THEN
        SELECT
          count(*) FILTER (WHERE v_key.answer @> jsonb_build_array(g.val)),
          count(*) FILTER (WHERE NOT v_key.answer @> jsonb_build_array(g.val))
        INTO v_hits, v_wrong
        FROM (SELECT DISTINCT e AS val FROM jsonb_array_elements(v_given) e) g;
        v_earned := floor(v_key.points * GREATEST(0, v_hits - v_wrong)::numeric / v_total);
      END IF;

    ELSIF v_key.grading = 'match' THEN
      SELECT count(*) INTO v_total FROM jsonb_object_keys(v_key.answer);
      IF v_given IS NOT NULL AND jsonb_typeof(v_given) = 'object' AND v_total > 0 THEN
        SELECT count(*) INTO v_hits
        FROM jsonb_each(v_key.answer) a
        WHERE v_given -> a.key = a.value;
        v_earned := floor(v_key.points * v_hits::numeric / v_total);
      END IF;

    ELSIF v_key.grading = 'risk_score' THEN
      IF v_given IS NOT NULL AND jsonb_typeof(v_given) = 'object'
         AND jsonb_typeof(v_given -> 'likelihood') = 'number'
         AND jsonb_typeof(v_given -> 'impact') = 'number' THEN
        v_product := (v_given ->> 'likelihood')::numeric * (v_given ->> 'impact')::numeric;
        IF (v_given ->> 'likelihood')::numeric BETWEEN 1 AND 5
           AND (v_given ->> 'impact')::numeric BETWEEN 1 AND 5
           AND v_product BETWEEN (v_key.answer ->> 'min')::numeric AND (v_key.answer ->> 'max')::numeric THEN
          v_earned := v_key.points;
        END IF;
      END IF;
    END IF;

    v_score := v_score + v_earned;
    v_max := v_max + v_key.points;
    v_results := v_results || jsonb_build_object(v_key.task_key, jsonb_build_object('earned', v_earned, 'max', v_key.points));
  END LOOP;

  INSERT INTO public.lab_attempts (lab_id, member_email, status, answers, auto_score, auto_max, task_results, submitted_at)
  VALUES (p_lab_id, v_email, 'Submitted', v_answers, v_score, v_max, v_results, now())
  ON CONFLICT (lab_id, member_email) DO UPDATE SET
    answers = EXCLUDED.answers,
    status = 'Submitted',
    auto_score = EXCLUDED.auto_score,
    auto_max = EXCLUDED.auto_max,
    task_results = EXCLUDED.task_results,
    submitted_at = now(),
    updated_at = now();

  RETURN jsonb_build_object('auto_score', v_score, 'auto_max', v_max, 'task_results', v_results);
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_lab_attempt(BIGINT, JSONB) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.submit_lab_attempt(BIGINT, JSONB) FROM PUBLIC, anon;

-- Curated lab: submit (or fix and resubmit) a proof link.
CREATE OR REPLACE FUNCTION public.submit_curated_lab_proof(p_lab_id BIGINT, p_proof_url TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_status TEXT;
BEGIN
  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Sign in to submit proof.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.labs l WHERE l.id = p_lab_id AND l.kind = 'curated' AND l.is_published) THEN
    RAISE EXCEPTION 'That lab is not available.';
  END IF;
  IF p_proof_url IS NULL OR p_proof_url !~* '^https://' OR length(p_proof_url) > 2000 THEN
    RAISE EXCEPTION 'Proof must be a link starting with https://';
  END IF;

  SELECT la.status INTO v_status FROM public.lab_attempts la
  WHERE la.lab_id = p_lab_id AND la.member_email = v_email;
  IF v_status = 'Approved' THEN
    RAISE EXCEPTION 'This lab has already been approved.';
  END IF;

  INSERT INTO public.lab_attempts (lab_id, member_email, status, proof_url, submitted_at)
  VALUES (p_lab_id, v_email, 'Submitted', trim(p_proof_url), now())
  ON CONFLICT (lab_id, member_email) DO UPDATE SET
    proof_url = EXCLUDED.proof_url,
    status = 'Submitted',
    submitted_at = now(),
    updated_at = now();
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_curated_lab_proof(BIGINT, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.submit_curated_lab_proof(BIGINT, TEXT) FROM PUBLIC, anon;

-- Model answers + per-task results, only once the caller's own attempt
-- has been submitted at least once. Rubrics are included so a member can
-- see what the reviewer is looking for.
CREATE OR REPLACE FUNCTION public.get_lab_debrief(p_lab_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_task_results JSONB;
  v_status TEXT;
BEGIN
  SELECT la.status, la.task_results INTO v_status, v_task_results
  FROM public.lab_attempts la
  WHERE la.lab_id = p_lab_id AND la.member_email = v_email;

  IF v_status IS NULL OR v_status = 'In Progress' OR v_task_results IS NULL THEN
    RAISE EXCEPTION 'Submit the lab to unlock the debrief.';
  END IF;

  RETURN (
    SELECT COALESCE(jsonb_object_agg(k.task_key, jsonb_build_object(
      'grading', k.grading,
      'answer', k.answer,
      'points', k.points,
      'model_answer', k.model_answer,
      'rubric', k.rubric,
      'result', v_task_results -> k.task_key
    )), '{}'::jsonb)
    FROM public.lab_answer_keys k
    WHERE k.lab_id = p_lab_id
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_lab_debrief(BIGINT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_lab_debrief(BIGINT) FROM PUBLIC, anon;

-- =========================================================================
-- STAFF FUNCTIONS (admins + community managers)
-- =========================================================================

-- Every attempt that has been submitted at least once, with the member's
-- name - community managers can't read member_profiles directly.
CREATE OR REPLACE FUNCTION public.get_lab_attempts_for_review()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE
AS $$
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_community_manager(auth.uid())) THEN
    RAISE EXCEPTION 'Only admins and community managers can review labs.';
  END IF;
  RETURN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', la.id,
      'lab_id', la.lab_id,
      'lab_slug', l.slug,
      'lab_title', l.title,
      'lab_kind', l.kind,
      'member_email', la.member_email,
      'member_name', mp.full_name,
      'status', la.status,
      'answers', la.answers,
      'proof_url', la.proof_url,
      'auto_score', la.auto_score,
      'auto_max', la.auto_max,
      'task_results', la.task_results,
      'reviewer_score', la.reviewer_score,
      'rubric_scores', la.rubric_scores,
      'feedback', la.feedback,
      'reviewed_by', la.reviewed_by,
      'reviewed_at', la.reviewed_at,
      'submitted_at', la.submitted_at
    ) ORDER BY la.submitted_at DESC), '[]'::jsonb)
    FROM public.lab_attempts la
    JOIN public.labs l ON l.id = la.lab_id
    LEFT JOIN public.member_profiles mp ON mp.email = la.member_email
    WHERE la.submitted_at IS NOT NULL
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_lab_attempts_for_review() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_lab_attempts_for_review() FROM PUBLIC, anon;

-- Approve or send back. Only a Submitted attempt can be reviewed.
CREATE OR REPLACE FUNCTION public.review_lab_attempt(
  p_attempt_id BIGINT,
  p_approved BOOLEAN,
  p_feedback TEXT DEFAULT NULL,
  p_rubric_scores JSONB DEFAULT NULL,
  p_reviewer_score INTEGER DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_community_manager(auth.uid())) THEN
    RAISE EXCEPTION 'Only admins and community managers can review labs.';
  END IF;
  IF NOT p_approved AND (p_feedback IS NULL OR trim(p_feedback) = '') THEN
    RAISE EXCEPTION 'Add feedback so the member knows what to change.';
  END IF;

  UPDATE public.lab_attempts la SET
    status = CASE WHEN p_approved THEN 'Approved' ELSE 'Needs Changes' END,
    feedback = NULLIF(trim(COALESCE(p_feedback, '')), ''),
    rubric_scores = p_rubric_scores,
    reviewer_score = p_reviewer_score,
    reviewed_by = lower(auth.jwt() ->> 'email'),
    reviewed_at = now(),
    updated_at = now()
  WHERE la.id = p_attempt_id AND la.status = 'Submitted';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'That submission has already been reviewed.';
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.review_lab_attempt(BIGINT, BOOLEAN, TEXT, JSONB, INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.review_lab_attempt(BIGINT, BOOLEAN, TEXT, JSONB, INTEGER) FROM PUBLIC, anon;

-- =========================================================================
-- SEED: first three GRC Hub Labs
-- =========================================================================
-- Prompts/options live in src/data/labs/*.js (matched by slug); ids in the
-- answers below must match the ids there. Re-running updates in place.

INSERT INTO public.labs (slug, kind, title, summary, track, difficulty, est_minutes, roadmap_item_title, is_published, sort_order, created_by)
VALUES
  ('grc-risk-register-kasi-kredit', 'hub', 'Build a Risk Register: Kasi Kredit',
   'A micro-lender needs its first information security risk register before funder due diligence. Separate real risks from noise, score them, choose treatments and controls, and write up the top risk.',
   'GRC', 'Beginner', 60, 'Mock Risk Assessment', true, 10, 'migration'),
  ('grc-breach-or-not-mzansi-learn', 'hub', 'Breach or Not? Mzansi Learn',
   'Four incidents at an online tutoring company. Decide which must be notified under POPIA section 22, who gets told, and draft the notice to parents.',
   'GRC', 'Beginner', 45, 'POPIA/GDPR Practitioner', true, 20, 'migration'),
  ('grc-popia-gap-analysis-ikhaya-health', 'hub', 'POPIA Gap Analysis: Ikhaya Health Clinics',
   'Assess a group of private clinics against the eight POPIA conditions using interviews, forms and an incident log, then write a remediation memo the owner can act on.',
   'GRC', 'Intermediate', 90, 'Compliance Gap Analysis', true, 30, 'migration')
ON CONFLICT (slug) DO UPDATE SET
  kind = EXCLUDED.kind,
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  track = EXCLUDED.track,
  difficulty = EXCLUDED.difficulty,
  est_minutes = EXCLUDED.est_minutes,
  roadmap_item_title = EXCLUDED.roadmap_item_title,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.lab_answer_keys (lab_id, task_key, grading, answer, points, model_answer, rubric)
SELECT l.id, v.task_key, v.grading, v.answer, v.points, v.model_answer, v.rubric
FROM public.labs l
JOIN (VALUES
  -- ---------------- Build a Risk Register: Kasi Kredit ----------------
  ('grc-risk-register-kasi-kredit', 't1', 'multi',
   $j$["server-loss", "shared-logins", "bec", "id-folder", "laptop-theft", "whatsapp"]$j$::jsonb, 20,
   $m$Six are real. Card data is out: card repayments go through a third-party provider and Kasi Kredit never stores card numbers. ATM skimming is out: Kasi Kredit has no ATMs. A register full of risks the evidence doesn't support wastes the funder's time and undermines the ones that matter.$m$,
   NULL::jsonb),
  ('grc-risk-register-kasi-kredit', 't2', 'risk_score',
   $j${"min": 10, "max": 25}$j$::jsonb, 10,
   $m$Strong answers land at High or Critical. Impact is 5 (Severe): the MD says a week without LoanDesk means they stop trading, and the backup is a week old and never tested, so it may not work at all. Likelihood is 3 or 4: hardware failure, theft from a storeroom, and ransomware (they've already had one phished mailbox) together make a loss about yearly or more. 3×5 = 15 (High), 4×5 = 20 (Critical). Anything from 10 up was accepted.$m$,
   NULL::jsonb),
  ('grc-risk-register-kasi-kredit', 't3', 'risk_score',
   $j${"min": 8, "max": 20}$j$::jsonb, 10,
   $m$Reasonable answers sit between Medium and Critical. Likelihood around 3 or 4: the password is on a sticky note and anyone at the branch can use it. Impact around 3 or 4: fraudulent loans or deleted repayments cost money, and with no named accounts you can't prove who did it or discipline anyone. 3×3 = 9 up to 4×4 = 16. Scores from 8 to 20 were accepted.$m$,
   NULL::jsonb),
  ('grc-risk-register-kasi-kredit', 't4', 'match',
   $j${"no-mfa": "mitigate", "breach-costs": "transfer", "whatsapp": "avoid", "printer": "accept"}$j$::jsonb, 20,
   $m$Mitigate the missing MFA: switching it on is cheap and directly stops a repeat of last month. Transfer breach costs: that's exactly what cyber insurance is for, and the MD already wants it. Avoid the WhatsApp payslips: stop collecting them on personal phones and use a secure upload or the branch instead. Accept the printer: it's isolated, low impact and being replaced next quarter; record the acceptance and who signed it off.$m$,
   NULL::jsonb),
  ('grc-risk-register-kasi-kredit', 't5', 'match',
   $j${"server-loss": "backups", "shared-logins": "named-accounts", "stolen-password": "mfa", "id-folder": "least-privilege", "laptop-theft": "disk-encryption", "fake-login": "awareness"}$j$::jsonb, 30,
   $m$Each risk has one control that hits it most directly. A backup only counts once you've restored from it, hence the restore test. Antivirus on an isolated printer is the distractor: it doesn't address any risk on this list.$m$,
   NULL::jsonb),
  ('grc-risk-register-kasi-kredit', 't6', 'rubric', NULL::jsonb, 0,
   $m$Risk statement: Because LoanDesk runs on a single on-premises server and the only backup is a weekly, untested USB copy kept off-site at an employee's home, a hardware failure, theft or ransomware attack could destroy the loan book, leaving Kasi Kredit unable to collect repayments or trade for days or weeks.
Owner: Managing Director (risk owner); IT Administrator (control owner).
Inherent score: likelihood 4 (Likely) given an active phishing problem and a storeroom server; impact 5 (Severe), since the MD confirms they would stop trading. 4×5 = 20, Critical.
Treatment: Mitigate.
Controls: (1) Automated, encrypted daily backups to a cloud or second-site location, with a restore test every quarter and the result recorded. (2) Move LoanDesk to a hosted or virtualised server with UPS power and restricted storeroom access. (3) MFA and phishing training to cut the ransomware entry route.
Residual: likelihood 3, impact 3 (a restore takes a day, not weeks) = 9, Medium, reviewed quarterly.$m$,
   $j$[
     {"criterion": "Risk statement", "levels": ["A vague label such as 'IT risk'", "Names the event but not the cause or the consequence", "Clear cause, event and consequence"]},
     {"criterion": "Owner", "levels": ["None, or just 'IT'", "A person, but not the one accountable for the business outcome", "A role that owns the business outcome, with IT as control owner"]},
     {"criterion": "Scoring", "levels": ["No reasoning", "Scores given, reasoning thin", "Scores tied to the scoring guide and the evidence"]},
     {"criterion": "Controls and residual", "levels": ["Generic, such as 'improve security'", "Specific controls, but residual missing or unrealistic", "Specific controls and a plausible, lower residual rating"]}
   ]$j$::jsonb),

  -- ---------------- Breach or Not? Mzansi Learn ----------------
  ('grc-breach-or-not-mzansi-learn', 't1', 'match',
   $j${"incident-1": "record", "incident-2": "notify", "incident-3": "notify", "incident-4": "notify"}$j$::jsonb, 40,
   $m$Incident 1: record it. With enforced full-disk encryption, the device fully shut down and the password not compromised, there are no reasonable grounds to believe the information was accessed. Record the evidence for that decision; if any of it turns out to be wrong (say the laptop was only asleep and unlocked), it becomes notifiable.
Incident 2: notify. 312 learners' details were acquired by someone with no right to them. The parent's reply doesn't undo that.
Incident 3: notify, urgently. Logs show data leaving the network, and the ransom note confirms the attackers hold it.
Incident 4: notify. It was one learner and ten minutes, but section 22 has no size threshold and no harm exemption: one learner's information was accessed by someone unauthorised. The notice can be short and reassuring.$m$,
   NULL::jsonb),
  ('grc-breach-or-not-mzansi-learn', 't2', 'single',
   $j$"still-notify"$j$::jsonb, 10,
   $m$The trigger is that the information was acquired by an unauthorised person, and that already happened. The deletion is good news worth including in the notice, but it doesn't remove the duty to notify the Regulator and the affected parents.$m$,
   NULL::jsonb),
  ('grc-breach-or-not-mzansi-learn', 't3', 'multi',
   $j$["regulator", "parents"]$j$::jsonb, 15,
   $m$Section 22 names two audiences: the Information Regulator and the affected data subjects. For learners under 18 that means their parents or guardians, who are also data subjects in their own right for their bank details. Telling unaffected users isn't required (it may still be wise as a public statement), and nothing in section 22 involves the attackers or the auditor.$m$,
   NULL::jsonb),
  ('grc-breach-or-not-mzansi-learn', 't4', 'multi',
   $j$["consequences", "measures-taken", "recommendations", "identity"]$j$::jsonb, 20,
   $m$Section 22 requires enough information for the data subject to protect themselves: possible consequences, what the responsible party has done or will do, what the data subject can do, and the identity of the unauthorised person if known. A forensic report, a liability position or staff names don't help a parent protect themselves, and some could harm the investigation or the staff involved.$m$,
   NULL::jsonb),
  ('grc-breach-or-not-mzansi-learn', 't5', 'single',
   $j$"asap"$j$::jsonb, 15,
   $m$POPIA sets no fixed number of hours: it requires notice as soon as reasonably possible, allowing for law enforcement's legitimate needs and the time needed to establish the scope and restore the system. The 72-hour rule is the GDPR's. Whether or not the ransom is paid has no bearing on the duty to notify.$m$,
   NULL::jsonb),
  ('grc-breach-or-not-mzansi-learn', 't6', 'rubric', NULL::jsonb, 0,
   $m$Subject: Important: a security incident affecting your information

Dear parent or guardian,

On Wednesday morning, criminals attacked one of our file servers with ransomware. Before the attack, they copied files that included your child's enrolment details (name, grade and school) and, for paying families, the bank name, account number and account holder name used for your debit order. They have threatened to publish this information.

What this could mean for you: someone could try to use your bank details for fraudulent debit orders, or contact you pretending to be Mzansi Learn or your bank.

What we have done: we isolated the affected server, brought in an independent forensic team, reported the incident to the South African Police Service, and notified the Information Regulator. Our learning platform was not affected and lessons continue as normal.

What you can do:
- Check your bank statements and tell your bank about any debit order you don't recognise. You can ask your bank to block unauthorised debit orders.
- Be wary of calls, SMSes or emails asking for passwords, OTPs or payment. Mzansi Learn will never ask for these.
- If you change bank accounts, update your debit order through your parent dashboard only.

We are sorry this happened. If you have questions, contact our Information Officer at privacy@mzansilearn.example or 010 000 0000 (weekdays, 08:00 to 17:00). We will update you when the investigation finds more.

Mzansi Learn$m$,
   $j$[
     {"criterion": "Required content", "levels": ["Misses most of what section 22 requires", "Covers some of it", "Covers consequences, actions taken, what parents can do, and the attacker's identity if known"]},
     {"criterion": "Practical advice", "levels": ["None", "Generic, such as 'be vigilant'", "Specific: check statements, talk to the bank about debit orders, watch for follow-up phishing"]},
     {"criterion": "Tone and clarity", "levels": ["Jargon-heavy or defensive", "Mostly clear", "Plain, calm and accountable, with no speculation"]},
     {"criterion": "Contact point", "levels": ["None", "A generic inbox", "A named contact route and what happens next"]}
   ]$j$::jsonb),

  -- ---------------- POPIA Gap Analysis: Ikhaya Health Clinics ----------------
  ('grc-popia-gap-analysis-ikhaya-health', 't1', 'match',
   $j${"f1": "openness", "f2": "processing-limitation", "f3": "security", "f4": "security", "f5": "purpose-specification", "f6": "further-processing", "f7": "information-quality", "f8": "participation", "f9": "accountability"}$j$::jsonb, 45,
   $m$F1 Openness: people must be told what is collected, why, and what their rights are. F2 Processing limitation: religion, employer and salary aren't needed to treat a patient, so collecting them isn't minimal (and religion is itself special personal information). F3 and F4 Security safeguards: an ID number isn't proof of identity over the phone, and open boxes of forms are unprotected records. F5 Purpose specification: section 14 says records may not be kept longer than the purpose needs, so Ikhaya needs a retention schedule. F6 Further processing limitation: phone numbers collected for care were used for an unrelated business's marketing (and section 69 on direct marketing is breached too). F7 Information quality: known-wrong details are left uncorrected in the file. F8 Data subject participation: patients have a right to access their records. F9 Accountability: someone must own compliance, and the Information Officer must be registered.$m$,
   NULL::jsonb),
  ('grc-popia-gap-analysis-ikhaya-health', 't2', 'single',
   $j$"not-a-gap"$j$::jsonb, 10,
   $m$Section 72 allows transfers abroad where the recipient is bound by law, binding corporate rules or a contract giving adequate protection. A GDPR-governed provider with a data processing agreement is a strong basis. The gap analysis should record it as compliant subject to checking the agreement, not as a finding. Prior authorisation from the Regulator is only needed in specific cases, such as sending special personal information to a country without adequate protection.$m$,
   NULL::jsonb),
  ('grc-popia-gap-analysis-ikhaya-health', 't3', 'multi',
   $j$["religion", "employer-salary", "marketing-preticked"]$j$::jsonb, 15,
   $m$Remove religion (special personal information with no stated purpose) and employer and salary (not needed for care; medical aid details cover billing). Replace the pre-ticked marketing box with an unticked, separate opt-in, and drop "and its partners". Emergency contacts, allergies and medical aid details all serve a clear clinical or billing purpose.$m$,
   NULL::jsonb),
  ('grc-popia-gap-analysis-ikhaya-health', 't4', 'risk_score',
   $j${"min": 10, "max": 25}$j$::jsonb, 10,
   $m$It has already happened at least once and nothing technical stops it, so likelihood is 3 or 4. The data is special personal information about identifiable people, sometimes public figures, so impact is 4 or 5: a regulator complaint, reputational damage and HPCSA consequences. 3×4 = 12 up to 4×5 = 20. Anything from 10 up was accepted. Controls: role-based access, access logging with monthly review, and a written disciplinary consequence.$m$,
   NULL::jsonb),
  ('grc-popia-gap-analysis-ikhaya-health', 't5', 'rubric', NULL::jsonb, 0,
   $m$To: Dr Nomvula Dube
Re: POPIA remediation priorities

You hold health information on 18,000 people, which POPIA treats as special personal information. These five actions close the biggest gaps first.

1. Stop unverified disclosures (this week). Owner: practice manager. Results are no longer read out over the phone on an ID number alone. Use a call-back to the number on file plus a second check (date of birth and last visit), or send results through a secure patient message. Brief all reception staff in person.

2. Lock down patient records (within 30 days). Owner: practice manager, with the system vendor. Give staff access only to the patients they treat, switch on access logging, and review the log monthly. Put the September incident and the consequences of browsing in writing. Shred the boxed intake forms now and use a locked shredding bin from today.

3. Register the Information Officer and name a deputy (within 30 days). Owner: Dr Dube. Register yourself (or a delegated deputy) with the Information Regulator, and give one person the day-to-day job of POPIA compliance.

4. Fix the intake form and stop the marketing (within 60 days). Owner: practice manager. Remove religion, employer and salary. Replace the pre-ticked box with an unticked opt-in that covers Ikhaya only. No more SMSes for other businesses.

5. Rewrite the privacy notice and set a retention schedule (within 90 days). Owner: Information Officer. Say what you collect, why, who it goes to (including the Irish cloud provider), how to access or correct records, and how to complain to the Regulator. Agree how long files are kept, in line with HPCSA record-keeping guidance, and how they're destroyed. Add a simple process for patients to request their file.$m$,
   $j$[
     {"criterion": "Prioritisation", "levels": ["Gaps listed in no particular order", "Some ordering, reasoning unclear", "Ordered by risk, with the special-information and disclosure gaps first"]},
     {"criterion": "Specificity", "levels": ["'Improve security'", "Named actions, but no owner or timeline", "Named actions, each with an owner and a realistic timeline"]},
     {"criterion": "Audience", "levels": ["Written for an auditor", "Mixed", "A clinic owner could act on it tomorrow"]},
     {"criterion": "Accuracy", "levels": ["Misstates POPIA", "Minor slips", "Correct references to conditions and sections"]}
   ]$j$::jsonb)
) AS v(slug, task_key, grading, answer, points, model_answer, rubric) ON v.slug = l.slug
ON CONFLICT (lab_id, task_key) DO UPDATE SET
  grading = EXCLUDED.grading,
  answer = EXCLUDED.answer,
  points = EXCLUDED.points,
  model_answer = EXCLUDED.model_answer,
  rubric = EXCLUDED.rubric;
