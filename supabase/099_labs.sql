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
  grading TEXT NOT NULL CHECK (grading IN ('single', 'multi', 'match', 'risk_score', 'rubric', 'rules')),
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
  v_graded JSONB;
  v_has_rules BOOLEAN;
  v_auto BOOLEAN;
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

    ELSIF v_key.grading = 'rules' THEN
      -- Engineering labs (2026-10-16): the submitted text must satisfy every
      -- rule. Members check as often as they like before this (see
      -- check_lab_task), so a submission with a failing check is refused.
      v_graded := public._grade_rules(
        CASE WHEN v_given IS NOT NULL AND jsonb_typeof(v_given) = 'string' THEN v_given #>> '{}' ELSE '' END,
        v_key.answer
      );
      v_earned := LEAST((v_graded ->> 'earned')::integer, v_key.points);
      IF v_earned < v_key.points THEN
        RAISE EXCEPTION 'A check still fails in this lab. Use Check on each task to see which one, then submit.';
      END IF;
    END IF;

    v_score := v_score + v_earned;
    v_max := v_max + v_key.points;
    v_results := v_results || jsonb_build_object(v_key.task_key,
      jsonb_build_object('earned', v_earned, 'max', v_key.points)
      || CASE WHEN v_key.grading = 'rules' THEN jsonb_build_object('checks', v_graded -> 'checks') ELSE '{}'::jsonb END);
  END LOOP;

  -- An engineering lab is checked by its rules, so most passes are approved
  -- on the spot; one in five stays Submitted for a staff spot check of the
  -- written explanation. Every other lab waits for a reviewer, as before.
  SELECT EXISTS (SELECT 1 FROM public.lab_answer_keys k WHERE k.lab_id = p_lab_id AND k.grading = 'rules') INTO v_has_rules;
  v_auto := v_has_rules AND random() >= 0.2;

  INSERT INTO public.lab_attempts (lab_id, member_email, status, answers, auto_score, auto_max, task_results, submitted_at, reviewed_by, reviewed_at)
  VALUES (p_lab_id, v_email, CASE WHEN v_auto THEN 'Approved' ELSE 'Submitted' END, v_answers, v_score, v_max, v_results, now(),
          CASE WHEN v_auto THEN 'auto' END, CASE WHEN v_auto THEN now() END)
  ON CONFLICT (lab_id, member_email) DO UPDATE SET
    answers = EXCLUDED.answers,
    status = EXCLUDED.status,
    auto_score = EXCLUDED.auto_score,
    auto_max = EXCLUDED.auto_max,
    task_results = EXCLUDED.task_results,
    submitted_at = now(),
    reviewed_by = EXCLUDED.reviewed_by,
    reviewed_at = EXCLUDED.reviewed_at,
    updated_at = now();

  RETURN jsonb_build_object('auto_score', v_score, 'auto_max', v_max, 'task_results', v_results,
                            'status', CASE WHEN v_auto THEN 'Approved' ELSE 'Submitted' END);
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
      'answer', CASE WHEN k.grading = 'rules' THEN NULL ELSE k.answer END,
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

-- =========================================================================
-- SEED: technical Hub Labs (DevSecOps, Network Security, AI Security, Azure
-- Cloud Security) - three per track
-- =========================================================================
-- Same model as the GRC labs above: an evidence pack the member analyses in
-- the portal (auto-graded here), plus a final practical task they do on their
-- OWN machine or free tier and submit as written proof for a staff rubric
-- review. No lab infrastructure is hosted by Hacking Hub. Prompts live in
-- src/data/labs/*.js (matched by slug); ids below must match the ids there
-- (src/data/labs/labContent.test.js checks this).

INSERT INTO public.labs (slug, kind, title, summary, track, difficulty, est_minutes, roadmap_item_title, is_published, sort_order, created_by)
VALUES
  ('devsecops-pipeline-sizwe-couriers', 'hub', 'Secure the Pipeline: Sizwe Couriers',
   'A start-up''s GitHub Actions workflow leaked a production key. Find the six real problems, match each fix, then scan a throwaway repo and rewrite the workflow on your own machine.',
   'DevSecOps', 'Intermediate', 75, 'Secure CI/CD Pipeline', true, 110, 'migration'),
  ('devsecops-iac-thuthuka-pay', 'hub', 'IaC Security Review: Thuthuka Pay',
   'Review a payments start-up''s Terraform before it merges: a public bucket, open SSH, an exposed database and secrets in code. Then scan it with Checkov or tfsec, fix it, and prove the failures drop.',
   'DevSecOps', 'Intermediate', 75, 'IaC Security Review', true, 120, 'migration'),
  ('devsecops-container-lekker-eats', 'hub', 'Container and Supply Chain: Lekker Eats',
   'Review a Dockerfile and an image scan, decide what to fix first when severity and real-world risk disagree, then build, harden and rescan an image yourself.',
   'DevSecOps', 'Intermediate', 75, 'KCSA', true, 130, 'migration'),
  ('netsec-firewall-umdoni-logistics', 'hub', 'Firewall Rule Review: Umdoni Logistics',
   'A depot''s firewall has an Any/Any rule at the top and Remote Desktop open to the internet. Decide what happens to each rule, then build and test a small firewall of your own.',
   'Network Security', 'Intermediate', 75, 'Fortinet NSE 4', true, 210, 'migration'),
  ('netsec-packet-analysis-karoo-clinics', 'hub', 'Read the Wire: Karoo Clinics',
   'Read a packet capture and spot clear-text credentials, a beacon, DNS tunnelling and ARP spoofing. Then capture and decode your own traffic with Wireshark.',
   'Network Security', 'Intermediate', 75, 'Packet Capture Analysis Write-Up', true, 220, 'migration'),
  ('netsec-segmentation-masakhane-print-pack', 'hub', 'Segment the Office: Masakhane Print & Pack',
   'A flat network puts the finance team, the production line, cameras and visitors together. Choose the zones and the allowed flows, then draw the redesigned network and its rule matrix.',
   'Network Security', 'Beginner', 60, 'Segment a Home/Lab Network', true, 230, 'migration'),
  ('aisec-prompt-injection-pharmaquik', 'hub', 'Prompt Injection Triage: PharmaQuik',
   'Seven odd conversations from a pharmacy chatbot. Classify each against the OWASP LLM categories, choose controls that work outside the prompt, then red-team a model you run yourself.',
   'AI Security', 'Intermediate', 75, 'Red Team an LLM App', true, 310, 'migration'),
  ('aisec-rag-leakage-imbizo-hr', 'hub', 'RAG Data Leakage: Imbizo HR Copilot',
   'An HR assistant told a junior employee the CEO''s bonus. Find the root cause, choose controls that enforce permissions at retrieval, then write a threat model and a working access filter.',
   'AI Security', 'Intermediate', 75, 'OWASP Top 10 for LLM Applications', true, 320, 'migration'),
  ('aisec-model-risk-mthunzi-claims', 'hub', 'Model Risk: Mthunzi Insurance Claims',
   'An unverified pickle model from a new account, and a fraud score that flags rural claims nearly three times as often. Assess both, map the gaps to the NIST AI RMF, and demonstrate the pickle danger safely.',
   'AI Security', 'Intermediate', 90, 'AI Risk Assessment Write-Up', true, 330, 'migration'),
  ('azure-access-review-cape-vineyards', 'hub', 'Azure Access Review: Cape Vineyards',
   'Permanent Owners, a contractor with Contributor and no MFA anywhere. Find the risky access, match the least-privilege fixes, then grant a narrow role in your own tenant and prove it.',
   'Cloud Security', 'Intermediate', 75, 'Secure a Cloud Environment', true, 410, 'migration'),
  ('azure-storage-hardening-jozi-print', 'hub', 'Storage and Network Hardening: Jozi Print Works',
   'A storage account with public blobs and TLS 1.0, and a VM with RDP and SQL open to the internet. Review the settings, then harden a storage account in your own subscription and show before and after.',
   'Cloud Security', 'Intermediate', 75, 'Cloud Security Posture Audit', true, 420, 'migration'),
  ('azure-activity-hunt-drakensberg-telecom', 'hub', 'Hunt in the Activity Log: Drakensberg Telecom',
   'Reconstruct an intruder''s steps from the Azure activity log, pick the right KQL, contain it, then run real queries in the free Log Analytics demo workspace.',
   'Cloud Security', 'Intermediate', 75, 'SC-200', true, 430, 'migration')
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
  -- ---------------- DevSecOps: Secure the Pipeline - Sizwe Couriers ----------------
  ('devsecops-pipeline-sizwe-couriers', 't1', 'multi',
   $j$["pr-target-checkout", "write-all", "unpinned-action", "echo-secret", "inject-head-ref", "deploy-every-push"]$j$::jsonb, 25,
   $m$Six are real. pull_request_target runs with the repository's secrets and a write-capable token, so checking out the pull request's own code runs a stranger's code with those powers. write-all gives the token far more than a build needs. @main is a mutable ref, so the action's owner (or anyone who takes over their account) can change what runs in your pipeline. Echoing the key prints it into a log, and masking only hides the exact string, not an encoded or split version. Pasting github.head_ref into a shell line lets a branch name carry commands. And with no approval or branch limit, any push can reach production. runs-on, actions/checkout@v4 and npm test are all ordinary.$m$,
   NULL::jsonb),
  ('devsecops-pipeline-sizwe-couriers', 't2', 'match',
   $j${"pr-target-checkout": "trigger-pr", "write-all": "least-priv", "unpinned-action": "pin-sha", "echo-secret": "no-print", "inject-head-ref": "env-var"}$j$::jsonb, 25,
   $m$Use the pull_request trigger for code from outside, and keep secrets out of those runs. Default the token to contents: read and add permissions per job. Pin third-party actions to a full commit SHA. Never print a secret; log masking is not a control. Pass untrusted values such as a branch name through an environment variable and quote it in the script, so the shell treats it as data. A bigger runner fixes none of these.$m$,
   NULL::jsonb),
  ('devsecops-pipeline-sizwe-couriers', 't3', 'single',
   $j$"rotate"$j$::jsonb, 15,
   $m$Assume the key is already copied. Revoke it and issue a new one first, then check the provider's logs for use of the old one. Deleting the log or rewriting history does not un-leak a key that has been public for a week, and it is not a reason to wait.$m$,
   NULL::jsonb),
  ('devsecops-pipeline-sizwe-couriers', 't4', 'single',
   $j$"untrusted-with-secrets"$j$::jsonb, 15,
   $m$pull_request_target was designed for safe jobs such as labelling pull requests, and it runs in the context of the base repository, with its secrets and a write token. Checking out and running the pull request's head code there hands that power to whoever opened the pull request, including a contractor or a stranger on a fork.$m$,
   NULL::jsonb),
  ('devsecops-pipeline-sizwe-couriers', 't5', 'match',
   $j${"secrets": "committed-password", "sca": "old-library", "sast": "string-sql", "container": "os-package", "dast": "missing-authz"}$j$::jsonb, 20,
   $m$Each scan has its own blind spots. Secret scanning finds credentials in files and history. SCA matches your dependencies to known vulnerabilities. SAST reads your own code for patterns such as SQL built from strings. Image scanning looks inside the built image, including operating-system packages. DAST probes the running app, which is how a missing authorisation check shows up. A phishing email is none of these; it is a people problem.$m$,
   NULL::jsonb),
  ('devsecops-pipeline-sizwe-couriers', 't6', 'rubric', NULL::jsonb, 0,
   $m$A strong submission shows a real scanner run (for example gitleaks detect, with the finding for the fake key, and npm audit or osv-scanner listing the old library) and a corrected workflow along these lines:

name: build-and-deploy
on:
  pull_request:
  push:
    branches: [main]
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm test
      - run: npx --yes osv-scanner --lockfile=package-lock.json
  deploy:
    if: github.ref == 'refs/heads/main'
    needs: test
    runs-on: ubuntu-latest
    environment: production   # protected, with required reviewers
    steps:
      - uses: actions/checkout@v4
      - uses: some-vendor/cache-action@<full-commit-sha>
      - run: ./deploy.sh
        env:
          DEPLOY_API_KEY: ${{ secrets.DEPLOY_API_KEY }}

It uses pull_request (no secrets for outside code), read-only permissions, a pinned action, no echo of the key, no branch name in the shell, and a protected production environment. The candidate should also add secret and dependency scanning as pipeline steps and explain why each fix lowers risk.$m$,
   $j$[
     {"criterion": "Evidence of running scanners", "levels": ["No commands or output", "Commands shown but output missing or too trimmed to check", "Real commands with the scanner's actual output showing the findings"]},
     {"criterion": "Corrected workflow", "levels": ["Original problems remain", "Fixes some of the six problems", "Fixes all six, with a safe trigger, least-privilege permissions and a protected deploy"]},
     {"criterion": "Understanding", "levels": ["No explanation", "Lists fixes without reasons", "Explains why each fix lowers the risk"]},
     {"criterion": "Safe handling of secrets", "levels": ["A real or likely-real secret is pasted", "Secret looks fake but is not clearly marked", "Clearly fake secrets only, and no real credentials anywhere"]}
   ]$j$::jsonb),

  -- ---------------- DevSecOps: IaC Security Review - Thuthuka Pay ----------------
  ('devsecops-iac-thuthuka-pay', 't1', 'multi',
   $j$["provider-keys", "public-bucket", "ssh-open", "db-password", "db-unencrypted", "db-public"]$j$::jsonb, 24,
   $m$Six problems. Keys in the provider block and a password typed into the file both put secrets into version control. The bucket is public-read and holds customer statements. SSH is open to the whole internet. The database is unencrypted and reachable from the internet. Port 443 is how customers reach the API, so it is intended, and the region is simply a choice. The scanner caught five; it missed the plain-text password, which is why a scanner is a floor and not a review.$m$,
   NULL::jsonb),
  ('devsecops-iac-thuthuka-pay', 't2', 'match',
   $j${"provider-keys": "role-creds", "public-bucket": "block-public", "ssh-open": "restrict-ssh", "db-password": "secrets-manager", "db-unencrypted": "encrypt-storage", "db-public": "private-subnet"}$j$::jsonb, 30,
   $m$Credentials should come from the environment or a role (OIDC from the pipeline is the usual route), never the file. Remove the public ACL and enable Block Public Access on the bucket. Limit SSH to a VPN or bastion address, or use Session Manager and close the port. Keep the database password in a secrets manager and reference it. Turn on storage encryption (an existing unencrypted database has to be recreated from an encrypted snapshot copy). Make the database private and put it in private subnets. Renaming resources hides nothing.$m$,
   NULL::jsonb),
  ('devsecops-iac-thuthuka-pay', 't3', 'single',
   $j$"revoke-first"$j$::jsonb, 14,
   $m$Anything that has been committed is compromised, whether or not it looks fake. Revoke it and issue new ones first. Removing it from the code, and from history, matters afterwards, but only after the credential no longer works.$m$,
   NULL::jsonb),
  ('devsecops-iac-thuthuka-pay', 't4', 'single',
   $j$"remote-backend"$j$::jsonb, 14,
   $m$State records everything Terraform manages and can include secrets in plain text, such as database passwords. Keep it in an encrypted remote backend with access control and locking, and out of git. A laptop copy or an emailed file is worse.$m$,
   NULL::jsonb),
  ('devsecops-iac-thuthuka-pay', 't5', 'single',
   $j$"in-pr"$j$::jsonb, 18,
   $m$Run it on every pull request as a required check, so a risky change is blocked before it merges. Running it once before an audit, or after deployment, finds problems when they are already live. Reviewers miss things in a diff; a scanner does not get tired.$m$,
   NULL::jsonb),
  ('devsecops-iac-thuthuka-pay', 't6', 'rubric', NULL::jsonb, 0,
   $m$A strong submission scans the original (about five failed checks) and the fixed version (zero or close to zero), with real output for both. The fixed file should remove the provider keys, remove the public ACL (and add a public access block), restrict SSH to a named range or remove it, encrypt the database, make it non-public, and replace the typed password with a variable that has no default and is marked sensitive (or a secrets-manager reference). Credit a candidate who also adds bucket versioning and access logging, or who notes that the scanner missed the plain-text password and a human review caught it. A good answer to "which first" names the credentials in the file, because they must be revoked before anything else.$m$,
   $j$[
     {"criterion": "Before and after evidence", "levels": ["No scanner output", "Output for only one run, or not clearly from the file", "Real before and after output showing the failed checks drop"]},
     {"criterion": "Quality of the fixes", "levels": ["Few or wrong fixes", "Fixes the scanner's findings only", "Fixes the scanner's findings and the plain-text password, with variables rather than typed secrets"]},
     {"criterion": "Secrets handling", "levels": ["Real-looking secret left in the submission", "Secret removed but not replaced sensibly", "Secrets removed, replaced with variables or references, and the revoke-first point understood"]},
     {"criterion": "Prioritisation", "levels": ["No answer to which first", "A choice with no reason", "A reasoned choice that puts credential exposure first"]}
   ]$j$::jsonb),

  -- ---------------- DevSecOps: Container and Supply Chain - Lekker Eats ----------------
  ('devsecops-container-lekker-eats', 't1', 'multi',
   $j$["latest-tag", "env-secret", "curl-bash", "root-user", "copy-all", "expose-22"]$j$::jsonb, 24,
   $m$Six real problems. An unpinned latest tag makes builds unrepeatable and changes under you. A secret set with ENV is baked into the image layers and shows in docker history and inspect. Piping a remote script to bash runs whatever that server serves today. With no USER the app runs as root. COPY . . without a .dockerignore ships .git, the .env file and tests. Port 22 means someone expects to SSH into the container, which is an anti-pattern. WORKDIR and the app port 3000 are normal.$m$,
   NULL::jsonb),
  ('devsecops-container-lekker-eats', 't2', 'match',
   $j${"latest-tag": "pin-slim", "env-secret": "runtime-secret", "curl-bash": "verify-download", "root-user": "add-user", "copy-all": "dockerignore", "expose-22": "remove-port"}$j$::jsonb, 30,
   $m$Pin a specific version or digest of a slim base image. Supply secrets at runtime from a secrets manager or the orchestrator, never in the image. Download a pinned release and verify its checksum or signature. Create and switch to a non-root user. Add a .dockerignore and copy only what the build needs. Remove port 22 and use docker exec or kubectl exec for a shell. A larger base image adds attack surface.$m$,
   NULL::jsonb),
  ('devsecops-container-lekker-eats', 't3', 'single',
   $j$"r-lodash"$j$::jsonb, 16,
   $m$Severity labels are only the start. lodash is exploited in the wild and is used on every request, so it is both likely to be attacked and reachable. The OpenSSL finding is rated CRITICAL, but the app never calls it and nobody is exploiting it, so it can follow soon. The test runner is not used at runtime, and the other two are low risk. Prioritise by exploitation, reachability and impact, not the label alone.$m$,
   NULL::jsonb),
  ('devsecops-container-lekker-eats', 't4', 'single',
   $j$"inventory"$j$::jsonb, 14,
   $m$A software bill of materials is the inventory of what is in an image. When a new vulnerability is announced, you query your SBOMs to find every image that contains the affected component, instead of searching chat for who last touched it.$m$,
   NULL::jsonb),
  ('devsecops-container-lekker-eats', 't5', 'single',
   $j$"sign-verify"$j$::jsonb, 16,
   $m$Sign images in the pipeline that built them, and make the cluster or deploy step refuse any image without a valid signature. Scanning after deployment does not stop a tampered image running, and secret tag names or trust are not controls.$m$,
   NULL::jsonb),
  ('devsecops-container-lekker-eats', 't6', 'rubric', NULL::jsonb, 0,
   $m$A strong submission shows a real build and scan of the original image (several HIGH or CRITICAL findings are typical for node:latest) and of the hardened one, with the counts falling. The hardened Dockerfile pins a slim base (for example node:20-slim or an alpine variant, ideally by digest), copies package files first and runs npm ci --omit=dev, copies only what is needed, has no ENV secret, switches to a non-root user (the node user already exists in official Node images), and has no EXPOSE 22. A .dockerignore excludes .git, .env, node_modules and tests. The docker run --rm image id output shows a non-zero uid. A good answer to "which first" follows the reasoning from the lab: exploited and reachable first, not just the highest label.$m$,
   $j$[
     {"criterion": "Before and after evidence", "levels": ["No scan output", "Only one scan, or counts without output", "Real scan output for the original and hardened images with counts falling"]},
     {"criterion": "Hardened Dockerfile", "levels": ["Original problems remain", "Fixes several problems", "Pinned slim base, no baked secret, non-root user, minimal copy and no port 22"]},
     {"criterion": ".dockerignore and non-root proof", "levels": ["Neither shown", "One of the two", "Both: a sensible .dockerignore and output proving a non-root user"]},
     {"criterion": "Prioritisation", "levels": ["No answer", "Picks the highest severity label", "Picks by exploitation and reachability and explains why"]}
   ]$j$::jsonb),

  -- ---------------- Network Security: Firewall Rule Review - Umdoni Logistics ----------------
  ('netsec-firewall-umdoni-logistics', 't1', 'single',
   $j$"rule-1"$j$::jsonb, 12,
   $m$The firewall applies the first matching rule. Rule 1 matches every packet, so rules 2 to 8 never decide anything: the Telnet deny and the default deny are dead. A "temporary" go-live rule left behind by a vendor is one of the most common rulebase failures.$m$,
   NULL::jsonb),
  ('netsec-firewall-umdoni-logistics', 't2', 'match',
   $j${"r1": "remove", "r2": "keep", "r3": "vpn", "r4": "keep", "r5": "restrict", "r6": "remove"}$j$::jsonb, 30,
   $m$Remove rule 1, which cancels everything beneath it. Keep rule 2: the public site needs it, and it is logged. Replace rule 3 with remote access through a VPN with multi-factor authentication, so Remote Desktop is only reachable from inside. Keep rule 4, ideally with web filtering. Restrict rule 5 to the staff LAN and the print services only, rather than any source and any service. Remove rule 6: guests must not reach the staff network, and printing for visitors can be handled another way.$m$,
   NULL::jsonb),
  ('netsec-firewall-umdoni-logistics', 't3', 'risk_score',
   $j${"min": 16, "max": 25}$j$::jsonb, 12,
   $m$Likelihood is 5 (Almost certain): the logs already show thousands of attempts every night, and exposed RDP is scanned constantly. Impact is 4 or 5: the PC holds payroll and the bank profile, and exposed RDP is a leading way ransomware gets in. 4 x 4 = 16 to 5 x 5 = 25, so High to Critical, and the fix is cheap.$m$,
   NULL::jsonb),
  ('netsec-firewall-umdoni-logistics', 't4', 'multi',
   $j$["deny-last-logged", "owner-expiry", "log-exposed", "named-objects"]$j$::jsonb, 22,
   $m$An explicit, logged deny-all at the bottom, an owner, reason and review date on every rule (and an expiry on temporary ones), logging on any rule that exposes an internal server, and named objects instead of raw addresses are all standard practice. A temporary Any/Any rule at the top is how this firewall got here, and switching logging off removes the evidence you need after an incident.$m$,
   NULL::jsonb),
  ('netsec-firewall-umdoni-logistics', 't5', 'single',
   $j$"vpn-mfa"$j$::jsonb, 24,
   $m$Put access behind a VPN or zero-trust gateway with multi-factor authentication, then reach the PC across the internal network. Changing the port only hides it from lazy scanners, time limits still leave it open every evening, and disabling the PC's own firewall makes things worse.$m$,
   NULL::jsonb),
  ('netsec-firewall-umdoni-logistics', 't6', 'rubric', NULL::jsonb, 0,
   $m$A strong submission describes a real, working setup, for example two Docker containers on a user-defined network, one with nftables rules and three listeners (22, 443, 3389) and one running nmap. The before scan shows all three ports open; the after scan shows only 443 open and the others filtered. The ruleset has a default drop policy on the input chain, allows established and related traffic (and loopback if testing locally), accepts tcp dport 443, and logs drops, for example:

table inet filter {
  chain input {
    type filter hook input priority 0; policy drop;
    ct state established,related accept
    iif lo accept
    tcp dport 443 accept
    log prefix "fw-drop: " counter drop
  }
}

A good explanation says why each rule exists, and describes allowing a VPN address safely: a single source rule for the VPN's fixed address or range, to the one port needed, placed above the drop, with a comment, an owner and a review date.$m$,
   $j$[
     {"criterion": "A real, working test", "levels": ["No setup described", "A ruleset with no evidence it was tested", "A described setup with real before and after scan output"]},
     {"criterion": "Ruleset quality", "levels": ["Allow-all or incomplete", "Blocks the services but is missing default drop or established-connection handling", "Default drop, established/related allowed, only 443 open, drops logged"]},
     {"criterion": "Explanation", "levels": ["None", "Restates the rules", "Explains why each rule exists"]},
     {"criterion": "Safe exception", "levels": ["Opens a wide range", "Allows the VPN but without limits", "A single source and port, ordered correctly, with an owner and review date"]}
   ]$j$::jsonb),

  -- ---------------- Network Security: Read the Wire - Karoo Clinics ----------------
  ('netsec-packet-analysis-karoo-clinics', 't1', 'match',
   $j${"obs-ftp": "cleartext", "obs-beacon": "beaconing", "obs-dns": "dns-tunnel", "obs-arp": "arp-spoof", "obs-ntp": "normal"}$j$::jsonb, 30,
   $m$FTP sends the username and password as plain text, so anyone on the path can read PASS Karoo2024!. The TLS connections to one outside address at a steady rhythm, from a PC nobody uses overnight, look like beaconing. Long random labels in TXT queries to one domain are how data is smuggled out through DNS. Two MAC addresses claiming the gateway's IP, with Wireshark flagging the duplicate, is ARP spoofing. NTP to a time server is normal.$m$,
   NULL::jsonb),
  ('netsec-packet-analysis-karoo-clinics', 't2', 'single',
   $j$"regular-60"$j$::jsonb, 14,
   $m$The connections are at 2.1, 62.1, 122.2 and 182.1 seconds: about 60 seconds apart. People browse in bursts at irregular times. Software on a timer checks in at a steady interval. Even with encrypted content, the timing, destination and server name are visible, so traffic can still be analysed.$m$,
   NULL::jsonb),
  ('netsec-packet-analysis-karoo-clinics', 't3', 'multi',
   $j$["isolate-keep-on", "block-iocs", "rotate-ftp", "check-arp"]$j$::jsonb, 22,
   $m$Disconnect the workstation but leave it on, so memory and logs are preserved for forensics. Block the outside address and the exfil domain. Change the exposed password. Find the device behind the second MAC and check the switch for ARP protections. Wiping at once destroys evidence, clearing the gateway's logs does the same, and encrypted traffic can absolutely be malicious.$m$,
   NULL::jsonb),
  ('netsec-packet-analysis-karoo-clinics', 't4', 'single',
   $j$"sftp-rotate"$j$::jsonb, 10,
   $m$Replace FTP with SFTP or FTPS so the login and files are encrypted, and change the password that was exposed. A different port, a shorter password or "it is inside the building" do not stop someone on the network reading it.$m$,
   NULL::jsonb),
  ('netsec-packet-analysis-karoo-clinics', 't5', 'match',
   $j${"goal-ftp": "f-ftp", "goal-txt": "f-txt", "goal-arp": "f-arp"}$j$::jsonb, 24,
   $m$ftp.request.command == "PASS" shows FTP password commands. dns.qry.type == 16 shows TXT queries, because TXT is DNS record type 16. arp.opcode == 2 shows ARP replies. tcp.flags.syn == 1 shows new TCP connections and http.request.method == "GET" shows web requests; neither answers these three questions.$m$,
   NULL::jsonb),
  ('netsec-packet-analysis-karoo-clinics', 't6', 'rubric', NULL::jsonb, 0,
   $m$A strong submission shows a capture of a plain-HTTP request with a Basic authentication header, found with a filter such as http.request or http.authorization, and the base64 value decoded (for example echo ZmFrZXVzZXI6ZmFrZXBhc3M= | base64 -d gives fakeuser:fakepass). It also shows the DNS lookup found with a filter such as dns.qry.name contains "example". The write-up should say that on the same Wi-Fi an observer could read the page, the credentials and the DNS names in clear text; that with HTTPS they could not read the content or the credentials but would still see the destination name, timing and volume; and that for Karoo the changes include SFTP, DNS and gateway protections, and encrypted Wi-Fi. Only fake credentials and the candidate's own traffic should appear.$m$,
   $j$[
     {"criterion": "Real capture evidence", "levels": ["No capture shown", "Claims without packet output or screenshot", "Real filters and packet excerpts or screenshot link"]},
     {"criterion": "Decoding", "levels": ["Not shown", "Header found but not decoded", "Base64 value decoded to the fake credentials"]},
     {"criterion": "HTTP versus HTTPS understanding", "levels": ["Missing or wrong", "Says HTTPS is safer without detail", "Explains what stays visible (names, timing, volume) and what does not"]},
     {"criterion": "Ethics and safety", "levels": ["Real credentials or someone else's traffic", "Unclear whose traffic it was", "Fake credentials and own traffic only, stated clearly"]}
   ]$j$::jsonb),

  -- ---------------- Network Security: Segment the Office - Masakhane Print & Pack ----------------
  ('netsec-segmentation-masakhane-print-pack', 't1', 'match',
   $j${"staff": "z-staff", "finance": "z-finance", "production": "z-production", "cctv": "z-iot", "guest": "z-guest", "public": "z-dmz", "fileserver": "z-servers"}$j$::jsonb, 30,
   $m$Group by trust and by the damage a compromise would do. Staff devices share a zone. Finance gets its own restricted zone because of payroll and the bank profile. The production line's old, rarely patched controllers sit apart so a compromise elsewhere cannot reach them. Cameras are IoT and talk to a vendor cloud, so they get their own zone. Guests only get the internet. The internet-facing server goes in a DMZ, so a break-in there does not land on the internal network. The file server belongs in an internal servers zone.$m$,
   NULL::jsonb),
  ('netsec-segmentation-masakhane-print-pack', 't2', 'multi',
   $j$["staff-fileserver", "guest-internet", "finance-bank"]$j$::jsonb, 24,
   $m$Staff to the file server on file-sharing ports, guests to the internet only, and finance to the bank over HTTPS through the proxy are all needed and narrow. Guests reaching staff, cameras talking to any internet address, a DMZ that can reach internal servers on any port, and anything reaching the production zone would each undo the segmentation.$m$,
   NULL::jsonb),
  ('netsec-segmentation-masakhane-print-pack', 't3', 'single',
   $j$"timeboxed-jump"$j$::jsonb, 16,
   $m$Third-party access should be named, time-limited, protected with multi-factor authentication, logged, and land on a controlled jump host that can reach only what the supplier needs. Letting them use a staff laptop, opening a port straight to the controllers, or sharing an admin password all give an outsider uncontrolled reach.$m$,
   NULL::jsonb),
  ('netsec-segmentation-masakhane-print-pack', 't4', 'single',
   $j$"need-rules"$j$::jsonb, 15,
   $m$A VLAN separates a broadcast domain. Traffic between VLANs is routed, and unless a firewall or access list stops it, devices on different VLANs can still talk. Segmentation is the zones plus the rules between them, with default deny.$m$,
   NULL::jsonb),
  ('netsec-segmentation-masakhane-print-pack', 't5', 'single',
   $j$"client-isolation"$j$::jsonb, 15,
   $m$Client or AP isolation stops devices on the same wireless network from talking to each other. Hiding the name, changing it or lowering the power does not stop a determined guest.$m$,
   NULL::jsonb),
  ('netsec-segmentation-masakhane-print-pack', 't6', 'rubric', NULL::jsonb, 0,
   $m$A strong submission shows a diagram with about seven zones (staff, finance, production, cameras/IoT, guest, DMZ, internal servers) plus a management or jump zone for supplier access, each with a VLAN number and subnet (for example 10, 20, 30...). A rule matrix with default deny between every pair, and a small number of explicit allows: staff to file server (SMB), finance to bank over HTTPS via proxy, guest to internet only, cameras to the recorder and only to the vendor's cloud address, the DMZ to nothing internal except specific application flows, the supplier jump host to the controllers. The remote access lands on a jump host, not a user's laptop. A good write-up names real uncertainties, such as how to handle visitors printing, or whether cameras need the vendor cloud at all, and says how they would be tested (for example by trying a blocked connection and reading the firewall log).$m$,
   $j$[
     {"criterion": "Zoning logic", "levels": ["Few zones or mixed trust levels", "Reasonable zones with some mixing", "Zones follow trust and impact, with sensible separation of production, finance, cameras, guests and the DMZ"]},
     {"criterion": "Rule matrix", "levels": ["Missing or allow-all", "Some denies but no default stated", "Default deny with a short list of specific, narrow allows"]},
     {"criterion": "Remote and third-party access", "levels": ["Not addressed", "Addressed but lands on user machines or an open port", "Time-limited, authenticated access landing on a jump host"]},
     {"criterion": "Clarity and testing", "levels": ["Hard to follow, no testing idea", "Clear but no testing idea", "Clear diagram and an idea of how each decision would be tested"]}
   ]$j$::jsonb),

  -- ---------------- AI Security: Prompt Injection Triage - PharmaQuik ----------------
  ('aisec-prompt-injection-pharmaquik', 't1', 'match',
   $j${"tx1": "prompt-leak", "tx2": "indirect", "tx3": "info-disclosure", "tx4": "misinfo", "tx5": "direct", "tx6": "no-issue", "tx7": "output-handling"}$j$::jsonb, 35,
   $m$tx1: the harm shown is the model revealing its hidden instructions: system prompt leakage. tx2: the instructions came from a web page, not the user: indirect prompt injection (and the SMS tool made it dangerous). tx3: another customer's prescription was returned: sensitive information disclosure. tx4: a confident, invented dosage is misinformation. tx5: the user's own role-play tries to override the rules: a direct prompt injection, or jailbreak. tx6: an ordinary question, no issue. tx7: the model's output contains an image that the chat window loads automatically, sending data out: improper output handling.$m$,
   NULL::jsonb),
  ('aisec-prompt-injection-pharmaquik', 't2', 'single',
   $j$"confirm-action"$j$::jsonb, 14,
   $m$Treat what the model reads as untrusted data and put the control on the dangerous action: require the customer to confirm, and check the number and text against policy before anything is sent. Telling the model to ignore web pages is a request that a clever page can talk it out of, a bigger model is no immunity, and the SMS provider is not the problem.$m$,
   NULL::jsonb),
  ('aisec-prompt-injection-pharmaquik', 't3', 'multi',
   $j$["server-owner-check", "identity-outside-model", "log-rate-limit"]$j$::jsonb, 18,
   $m$Authorisation must be enforced by the application, outside the model: check on the server that the signed-in customer owns the prescription, pass their identity to the tool from the application, and log and rate-limit lookups so enumeration shows up. A line in the prompt or asking the model to quiz the customer are both just more text the model can be talked out of.$m$,
   NULL::jsonb),
  ('aisec-prompt-injection-pharmaquik', 't4', 'single',
   $j$"not-a-control"$j$::jsonb, 12,
   $m$A prompt is a request, not an enforcement mechanism. A model can be talked out of it, so anything that must stay secret, or any rule that must hold, has to be enforced somewhere the model cannot override: permissions, confirmations, filters and keeping secrets out of the prompt altogether.$m$,
   NULL::jsonb),
  ('aisec-prompt-injection-pharmaquik', 't5', 'single',
   $j$"restrict-render"$j$::jsonb, 21,
   $m$The leak works because the chat window fetches whatever address the model's output points to. Only load images from an approved list (for example with a content security policy), and strip links and images from model output that should not contain them. Hiding the image, or asking the model not to produce one, does not stop the request being made.$m$,
   NULL::jsonb),
  ('aisec-prompt-injection-pharmaquik', 't6', 'rubric', NULL::jsonb, 0,
   $m$A strong submission names the model and setup, shows the system prompt with a fake secret, and lists at least six attempts with verbatim prompts and replies and an honest result for each (small models often fall to the simplest attacks). The attempts should be varied: override, role-play, prompt extraction, encoding or translation, an indirect injection through a pasted document, and a multi-turn build-up. Mitigations should be layered and mostly outside the prompt: do not put secrets in the prompt, separate trusted and untrusted content, require confirmation for actions, filter or constrain output, enforce authorisation in the application, and monitor. The candidate should say what they could not test, and should have used only their own model and made-up data.$m$,
   $j$[
     {"criterion": "Variety of attacks", "levels": ["One or two similar attempts", "Several attempts, mostly the same kind", "At least six, covering override, role-play, extraction, encoding, indirect and multi-turn"]},
     {"criterion": "Evidence", "levels": ["Summaries only", "Some verbatim prompts and replies", "Verbatim prompts and replies with an honest worked / did not work for each"]},
     {"criterion": "Mitigations", "levels": ["Only wording changes to the prompt", "Some controls outside the prompt", "Layered controls: permissions, confirmation, output handling and monitoring, not prompt wording alone"]},
     {"criterion": "Ethics and honesty", "levels": ["Tested a system they do not control, or real data", "Setup unclear", "Own model, made-up data and limits of the test stated"]}
   ]$j$::jsonb),

  -- ---------------- AI Security: RAG Data Leakage - Imbizo HR Copilot ----------------
  ('aisec-rag-leakage-imbizo-hr', 't1', 'single',
   $j$"service-account-no-filter"$j$::jsonb, 14,
   $m$Retrieval ran as a service account that can read everything and nothing filtered results by who was asking. Hiding a folder in the menu only hides a button; the vector search still returned the chunk. The model did not invent the figure, and no one guessed a password.$m$,
   NULL::jsonb),
  ('aisec-rag-leakage-imbizo-hr', 't2', 'multi',
   $j$["filter-at-retrieval", "on-behalf-of", "separate-indexes", "log-retrieved"]$j$::jsonb, 24,
   $m$Enforce permissions where the data is fetched: filter every retrieval by the signed-in user's access, store the access information with each chunk, call the service on the user's behalf rather than as a super-user, keep the most sensitive material in separate indexes most users cannot query, and log which documents were retrieved so access can be audited. Telling the model to refuse, hiding a folder, or removing citations do not stop the data entering the prompt.$m$,
   NULL::jsonb),
  ('aisec-rag-leakage-imbizo-hr', 't3', 'match',
   $j${"handbook": "a-all", "leave": "a-all", "salary-bands": "a-hr", "disciplinary": "a-case-owner", "exec-comp": "a-board"}$j$::jsonb, 24,
   $m$Match the audience the document was written for: the handbook and leave policy for everyone, salary bands for the HR team, case notes only for the HR owner of that case, and executive pay only for the board remuneration committee. The Copilot should be able to use a document in an answer only when the person asking could open it themselves.$m$,
   NULL::jsonb),
  ('aisec-rag-leakage-imbizo-hr', 't4', 'single',
   $j$"before-prompt"$j$::jsonb, 14,
   $m$Anything placed in the model's prompt can appear in the answer, so the check must happen before retrieved chunks reach the prompt. Asking the model to remove private content afterwards, relying on the chat window, or relying on users' good manners all leave the data exposed.$m$,
   NULL::jsonb),
  ('aisec-rag-leakage-imbizo-hr', 't5', 'risk_score',
   $j${"min": 16, "max": 25}$j$::jsonb, 24,
   $m$Likelihood is 4 or 5: any of 1,800 staff can do it with a plain question, and it has already happened. Impact is 4 or 5: executive pay and disciplinary case notes are highly sensitive, and disclosing case notes is a POPIA matter as well as an employee-relations one. 4 x 4 = 16 up to 5 x 5 = 25, so High to Critical.$m$,
   NULL::jsonb),
  ('aisec-rag-leakage-imbizo-hr', 't6', 'rubric', NULL::jsonb, 0,
   $m$A strong threat model has a clear data-flow diagram (user, assistant, retrieval, vector store, model, logs) and at least six threats with OWASP LLM categories, for example sensitive information disclosure (no per-user filtering), vector and embedding weaknesses (cross-tenant retrieval or poisoned documents), prompt injection (through ingested documents), excessive agency, system prompt leakage, and unbounded consumption. The script should hold about ten chunks with access lists, filter by the user's groups before matching, and print different results for two users asking the same question. The note on limits should mention that the demo does not handle chunk-level permissions that change over time, inferred leakage from summaries, or injection through documents.$m$,
   $j$[
     {"criterion": "Threat coverage", "levels": ["Fewer than four threats or generic ones", "Six threats but categories missing or wrong", "Six or more specific threats with the right OWASP LLM categories, impact and control"]},
     {"criterion": "Working filter", "levels": ["No script", "Script runs but does not filter by user", "Filters by the user's groups before matching, and two users get different results"]},
     {"criterion": "Controls beyond the prompt", "levels": ["Only prompt wording", "Some real controls", "Permissions at retrieval, separate indexes, auditing and monitoring"]},
     {"criterion": "Honest limits", "levels": ["None", "Vague", "Names what the demo does not protect against"]}
   ]$j$::jsonb),

  -- ---------------- AI Security: Model Risk - Mthunzi Insurance Claims ----------------
  ('aisec-model-risk-mthunzi-claims', 't1', 'single',
   $j$"pickle-code-exec"$j$::jsonb, 14,
   $m$Python's pickle format can contain instructions that run code when the file is loaded. Loading an untrusted pickle on a server that can reach the claims database gives the file's author a foothold there. Safer formats (such as safetensors or ONNX) store only data. Loading speed and file size are not the issue.$m$,
   NULL::jsonb),
  ('aisec-model-risk-mthunzi-claims', 't2', 'multi',
   $j$["verify-hash", "sandbox", "safe-format", "scan-model"]$j$::jsonb, 24,
   $m$Use a publisher you can verify and check a pinned hash or signature, test first in a sandbox with no network and no credentials, prefer a format that cannot execute code on load (or retrain in-house), and scan pickles for unsafe operations before opening them. Download counts prove nothing, and renaming the extension changes nothing about what the file does.$m$,
   NULL::jsonb),
  ('aisec-model-risk-mthunzi-claims', 't3', 'match',
   $j${"a-owner": "govern", "a-context": "map", "a-metrics": "measure", "a-response": "manage"}$j$::jsonb, 24,
   $m$Govern is about accountability and approval: a named owner and sign-off before go-live. Map is about understanding the context: intended use, data and who is affected. Measure is about testing and tracking, such as flag rates by group each month. Manage is about acting on the risks: a human-review fallback and a way to switch the model off.$m$,
   NULL::jsonb),
  ('aisec-model-risk-mthunzi-claims', 't4', 'single',
   $j$"investigate-hold"$j$::jsonb, 14,
   $m$A model can be accurate overall and still treat a group unfairly. Look for the cause, including whether province or something correlated with it is acting as a proxy, and do not rely on the model alone for the affected group while you do. Keep a human review path. Shipping because the overall figure is high, excluding a group of customers, or hiding the table are all wrong.$m$,
   NULL::jsonb),
  ('aisec-model-risk-mthunzi-claims', 't5', 'risk_score',
   $j${"min": 12, "max": 25}$j$::jsonb, 24,
   $m$Likelihood is 3 or 4: the file comes from a nine-day-old account with no provenance, and nobody has checked it. Impact is 5: code execution on a server that can reach the claims database. 3 x 5 = 15 up to 5 x 5 = 25, so High to Critical, and the fix is cheap: do not load it until it is verified.$m$,
   NULL::jsonb),
  ('aisec-model-risk-mthunzi-claims', 't6', 'rubric', NULL::jsonb, 0,
   $m$A strong risk register has at least six risks, each with a clear statement (cause, event, consequence), a likelihood and impact score, an owner and controls, and a NIST AI RMF function. Expect: unverified pickle (supply chain), unequal flag rates by region (bias and fairness), stale training data and drift, no accountable owner, no incident or rollback plan, and an investigation backlog of three weeks that turns a false flag into real harm. The demonstration should define a class with __reduce__ returning something like (print, ("this ran while loading",)) or os.system with a harmless echo, pickle it, load it and show the output, then show the same data saved as JSON and loaded with no code running. It must be done in a disposable environment and the candidate should note that they never load a pickle they did not create. The suggested change to Mthunzi's loading code: do not use pickle.load on third-party files; use a data-only format, verify the artefact's hash, and load in a sandbox.$m$,
   $j$[
     {"criterion": "Risk register", "levels": ["Fewer than four risks or vague labels", "Six risks but scoring, owners or controls missing", "Six or more clear risk statements with scores, owners, controls and a framework function"]},
     {"criterion": "Safe demonstration", "levels": ["Not shown", "Shown without the safer comparison", "Pickle load visibly runs a harmless command, and the data-only version does not"]},
     {"criterion": "Fairness and operations", "levels": ["Only technical security risks", "Mentions bias without a response", "Covers bias, drift, ownership and a response plan"]},
     {"criterion": "Safety and judgement", "levels": ["Loaded a pickle they did not create, or no isolation", "Isolation unclear", "Disposable environment, own pickle only, limits stated"]}
   ]$j$::jsonb),

  -- ---------------- Cloud Security: Azure Access Review - Cape Vineyards ----------------
  ('azure-access-review-cape-vineyards', 't1', 'multi',
   $j$["owner-staff", "guest-contrib", "svc-contrib", "helpdesk-uaa"]$j$::jsonb, 24,
   $m$A permanent Owner for a day-to-day user, an outside guest with Contributor across the whole subscription, a service principal that can change everything when it only needs to back things up, and a help desk that can grant any role are all over-privileged. The finance group's Reader on its own resource group and the dev group's Contributor on rg-dev are scoped to the job.$m$,
   NULL::jsonb),
  ('azure-access-review-cape-vineyards', 't2', 'match',
   $j${"owner-staff": "fix-owner", "guest-contrib": "fix-guest", "svc-contrib": "fix-svc", "helpdesk-uaa": "fix-helpdesk"}$j$::jsonb, 24,
   $m$Replace standing high roles with just-enough access at a lower scope, and make anything higher eligible and time-limited. For the guest, use a narrow role on only the resource group they work in, time-boxed, with multi-factor authentication. Give the backup principal a least-privileged built-in role on only the vault or resource group it uses. Take away the help desk's ability to grant roles and use approved group membership instead. Renaming accounts does nothing.$m$,
   NULL::jsonb),
  ('azure-access-review-cape-vineyards', 't3', 'multi',
   $j$["require-mfa", "block-legacy", "break-glass", "restrict-guests"]$j$::jsonb, 22,
   $m$Require multi-factor authentication for everyone, starting with administrators; block legacy authentication, which cannot do it; keep two emergency access accounts excluded from policies, protected with strong credentials and monitored, so a policy mistake cannot lock everyone out; and limit who can invite guests. Turning off administrators' MFA, or letting guests use a password alone, does the opposite of what you want.$m$,
   NULL::jsonb),
  ('azure-access-review-cape-vineyards', 't4', 'single',
   $j$"contain-first"$j$::jsonb, 15,
   $m$Contain first: revoke the account's sessions and reset or block its sign-in, then review what it did with the activity and sign-in logs. Waiting for an email reply, or until the contractor is next in, gives an intruder time, and deleting the subscription destroys evidence and the business.$m$,
   NULL::jsonb),
  ('azure-access-review-cape-vineyards', 't5', 'single',
   $j$"pim"$j$::jsonb, 15,
   $m$Privileged Identity Management provides just-in-time, time-limited, approval-based activation of roles. It requires a Microsoft Entra ID P2 licence, which is why the tenant on the free tier cannot use it today.$m$,
   NULL::jsonb),
  ('azure-access-review-cape-vineyards', 't6', 'rubric', NULL::jsonb, 0,
   $m$A strong submission shows a real role assignment at resource group scope only (for example az role assignment create --assignee user --role Reader --resource-group lab-rg, then az role assignment list --resource-group lab-rg --output table with the scope in the output), evidence that multi-factor authentication or security defaults is enabled in the candidate's own tenant, and evidence of clean-up (the assignment removed, user and resource group deleted). The explanation should say why a narrow role at a small scope is safer than a broad one at the subscription, and mention time limits for anything higher. It must have been done in the candidate's own tenant, not an employer's.$m$,
   $j$[
     {"criterion": "Real assignment", "levels": ["No evidence", "A role shown but scope unclear or too broad", "Narrow role at resource group scope, with the listing or screenshot showing the scope"]},
     {"criterion": "MFA or security defaults", "levels": ["Not shown", "Mentioned without evidence", "Evidence it is on in the candidate's own tenant"]},
     {"criterion": "Clean-up", "levels": ["No clean-up", "Partly cleaned up", "Assignment, user and resource group removed, with evidence"]},
     {"criterion": "Reasoning", "levels": ["No explanation", "Describes what was done", "Explains least privilege, scope and time limits"]}
   ]$j$::jsonb),

  -- ---------------- Cloud Security: Storage and Network Hardening - Jozi Print Works ----------------
  ('azure-storage-hardening-jozi-print', 't1', 'multi',
   $j$["s-public", "s-tls", "s-https", "s-network", "s-sharedkey"]$j$::jsonb, 24,
   $m$Five problems: blobs can be made public, TLS 1.0 is allowed, plain HTTP is allowed, the firewall defaults to allow every network, and shared-key access is on (account keys are all-powerful bearer credentials, so prefer Microsoft Entra authorisation). Encryption being on is good, and the redundancy option is a resilience choice, not a security fault.$m$,
   NULL::jsonb),
  ('azure-storage-hardening-jozi-print', 't2', 'match',
   $j${"allowBlobPublicAccess": "v-false", "minimumTlsVersion": "v-tls12", "enableHttpsTrafficOnly": "v-true", "defaultAction": "v-deny", "allowSharedKeyAccess": "v-false"}$j$::jsonb, 25,
   $m$allowBlobPublicAccess false, minimumTlsVersion TLS1_2, enableHttpsTrafficOnly true, the network default action Deny with only the networks or addresses that need access (or a private endpoint), and allowSharedKeyAccess false once your apps use Entra ID or short-lived SAS tokens. Share customer files with expiring, narrowly scoped SAS links rather than public containers.$m$,
   NULL::jsonb),
  ('azure-storage-hardening-jozi-print', 't3', 'multi',
   $j$["n-rdp", "n-sql"]$j$::jsonb, 18,
   $m$RDP from the internet should not exist, and neither should SQL Server from the internet when only the VM itself uses it. HTTPS on 443 is how customers reach the upload page, and the deny rule at the bottom is the safety net.$m$,
   NULL::jsonb),
  ('azure-storage-hardening-jozi-print', 't4', 'single',
   $j$"bastion-jit"$j$::jsonb, 17,
   $m$Use Azure Bastion, or just-in-time VM access from Defender for Cloud, which opens the port to your address only for a limited time. Then remove the standing open rule. Moving the port, a longer password, or deleting the network security group do not fix it.$m$,
   NULL::jsonb),
  ('azure-storage-hardening-jozi-print', 't5', 'single',
   $j$"defender-cloud"$j$::jsonb, 16,
   $m$Microsoft Defender for Cloud assesses your resources against benchmarks and gives a secure score with recommendations. Cost Management, Service Health and the Pricing Calculator are about money and availability.$m$,
   NULL::jsonb),
  ('azure-storage-hardening-jozi-print', 't6', 'rubric', NULL::jsonb, 0,
   $m$A strong submission shows the account's security settings before and after, from az storage account show or az storage account update output (or the portal), with public blob access off, minimum TLS 1.2, HTTPS only, the network default action Deny with only the candidate's address allowed, shared key access disabled where practical, and blob soft delete on. It shows a budget alert was set first, a Defender for Cloud screenshot link if available, and that the resource group was deleted. The explanation should justify the choice for a printing company, for example public access (customers' artwork must not be public) or shared keys (a leaked key opens everything). Everything must be in the candidate's own subscription.$m$,
   $j$[
     {"criterion": "Before and after", "levels": ["No settings shown", "Only the final settings", "Clear before and after output showing each change"]},
     {"criterion": "Hardening choices", "levels": ["Few settings changed", "Several changed, some missed", "Public access, TLS, HTTPS, network rules and soft delete addressed, with shared key access considered"]},
     {"criterion": "Cost safety and clean-up", "levels": ["No budget alert or clean-up", "One of the two", "Budget alert set first and the resource group deleted, with evidence"]},
     {"criterion": "Reasoning", "levels": ["None", "Generic", "A reasoned choice of the most important setting for this business"]}
   ]$j$::jsonb),

  -- ---------------- Cloud Security: Hunt in the Activity Log - Drakensberg Telecom ----------------
  ('azure-activity-hunt-drakensberg-telecom', 't1', 'match',
   $j${"e3": "grant-access", "e4": "collect-creds", "e5": "hide-tracks", "e6": "abuse-compute", "e7": "open-paths"}$j$::jsonb, 30,
   $m$In order: e3 grants more access (a role assignment); e4 lists the storage account keys, which open the data directly; e5 deletes the diagnostic setting, so logs stop flowing to the workspace; e6 creates vm-miner01, using your compute for their own purposes; e7 opens network paths in with a new security rule. All came from one service account, from an address outside its usual range, at 02:11 to 02:20.$m$,
   NULL::jsonb),
  ('azure-activity-hunt-drakensberg-telecom', 't2', 'single',
   $j$"q-a"$j$::jsonb, 14,
   $m$Query A filters to the last 24 hours with where, counts with summarize count() by Caller, and sorts by the count_ column. Query B is SQL, not KQL. Query C uses filter, which is not a KQL operator, and count has no "by" form. Query D is valid KQL but lists distinct callers without counting anything.$m$,
   NULL::jsonb),
  ('azure-activity-hunt-drakensberg-telecom', 't3', 'multi',
   $j$["revoke-svc", "remove-role", "restore-logging", "rotate-storage-keys"]$j$::jsonb, 24,
   $m$Cut off the identity (rotate or disable credentials and revoke sessions), remove what the attacker added (the role assignment and vm-miner01), restore logging while exporting the evidence you already have, and rotate the storage keys that were listed. Deleting the whole production resource group destroys evidence and the business, and doing nothing because the operations succeeded misreads what Succeeded means: it means the attacker's actions worked.$m$,
   NULL::jsonb),
  ('azure-activity-hunt-drakensberg-telecom', 't4', 'single',
   $j$"blind-spot"$j$::jsonb, 12,
   $m$Deleting the diagnostic setting is a defence-evasion move: the activity log still exists in Azure, but it stops flowing to the workspace where your queries and alerts run, so you lose visibility. The deletion should itself raise an alert.$m$,
   NULL::jsonb),
  ('azure-activity-hunt-drakensberg-telecom', 't5', 'multi',
   $j$["role-new-ip", "diag-delete", "vm-outside-window"]$j$::jsonb, 20,
   $m$Alerts on role assignments from unexpected addresses, any diagnostic setting deletion, and new VMs created outside the change window or by a pipeline identity from an unexpected address would each have fired within minutes. Alerting on every success, or on every weekday sign-in, produces noise that gets ignored.$m$,
   NULL::jsonb),
  ('azure-activity-hunt-drakensberg-telecom', 't6', 'rubric', NULL::jsonb, 0,
   $m$A strong submission names a real table in the demo workspace (such as AzureActivity, SigninLogs or SecurityEvent) and explains the choice, then shows at least three valid KQL queries with their results: a count by a column (summarize count() by Caller), a time filter (where TimeGenerated > ago(24h)) and a trend (summarize count() by bin(TimeGenerated, 1h) | render timechart), with the row counts or top entries or a screenshot link. The detection write-up should say what the rule alerts on (for example a role assignment from an address not seen before, or deletion of a diagnostic setting), the data source, a threshold, and likely false positives (legitimate pipeline runs from new addresses, planned maintenance). If the demo was unavailable, an honest note and well-formed queries against the evidence sample, with the expected results explained, earns credit.$m$,
   $j$[
     {"criterion": "Valid KQL", "levels": ["Queries do not run or are not KQL", "Queries run but are trivial", "Three or more valid queries: a count by a column, a time filter and a trend over time"]},
     {"criterion": "Evidence of results", "levels": ["No results shown", "Described without output", "Row counts, top entries or a screenshot link for each query"]},
     {"criterion": "Choice of data", "levels": ["No explanation", "A table named without reasons", "A table chosen and justified for the question"]},
     {"criterion": "Detection thinking", "levels": ["None", "A generic idea", "A specific rule with threshold and likely false positives"]}
   ]$j$::jsonb)
) AS v(slug, task_key, grading, answer, points, model_answer, rubric) ON v.slug = l.slug
ON CONFLICT (lab_id, task_key) DO UPDATE SET
  grading = EXCLUDED.grading,
  answer = EXCLUDED.answer,
  points = EXCLUDED.points,
  model_answer = EXCLUDED.model_answer,
  rubric = EXCLUDED.rubric;

-- =========================================================================
-- ENGINEERING LABS (2026-10-16)
-- =========================================================================
-- Labs where the member produces something (a fixed config file, a detection
-- rule, a command's output) and the portal checks it against staff-written
-- rules. The rules sit in lab_answer_keys.answer, so members can never read
-- them; they see only a plain hint per failed check. Nothing the member
-- submits is ever executed - it is matched as text, nothing more.
--
--   labs.platform   'Neutral' shows to everyone; 'Azure' / 'AWS' labs show to
--                   members on that cloud (member_profiles.cloud_platform).
--   grading 'rules' answer = {"max_chars": 20000, "rules": [
--                     {"need":   "regex that must match",   "hint": "...", "points": 5},
--                     {"forbid": "regex that must not match", "hint": "...", "points": 10}]}
--                   Full-line comments are ignored before matching. A rule may
--                   carry "flags": "i" for case-insensitive.
--
-- A lab with a 'rules' task approves a full-marks submission on the spot
-- (reviewed_by = 'auto'), except one in five, which stays Submitted for a
-- staff spot check of the written explanation (submit_lab_attempt above).
-- Labs stay outside Hub Score, as decided on 2026-10-03.

ALTER TABLE public.labs ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'Neutral';
ALTER TABLE public.labs DROP CONSTRAINT IF EXISTS labs_platform_check;
ALTER TABLE public.labs ADD CONSTRAINT labs_platform_check CHECK (platform IN ('Neutral', 'Azure', 'AWS'));

ALTER TABLE public.lab_answer_keys DROP CONSTRAINT IF EXISTS lab_answer_keys_grading_check;
ALTER TABLE public.lab_answer_keys ADD CONSTRAINT lab_answer_keys_grading_check
  CHECK (grading IN ('single', 'multi', 'match', 'risk_score', 'rubric', 'rules'));

-- Every pre-submission Check is logged so it can be rate limited: without a
-- limit, repeated checks would let a member work the hints out one by one.
CREATE TABLE IF NOT EXISTS public.lab_task_checks (
  id BIGSERIAL PRIMARY KEY,
  lab_id BIGINT NOT NULL REFERENCES public.labs(id) ON DELETE CASCADE,
  member_email TEXT NOT NULL,
  task_key TEXT NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_lab_task_checks_lookup ON public.lab_task_checks (member_email, lab_id, task_key, checked_at);
ALTER TABLE public.lab_task_checks ENABLE ROW LEVEL SECURITY;
-- No policies: members and staff reach it only through check_lab_task().

-- Grades one text against one rule set. Returns
--   {"earned": n, "max": n, "checks": [{"ok": bool, "hint": "...", "points": n}]}
-- and never the patterns. Used by check_lab_task and submit_lab_attempt.
CREATE OR REPLACE FUNCTION public._grade_rules(p_text TEXT, p_spec JSONB)
RETURNS JSONB
LANGUAGE plpgsql IMMUTABLE SET search_path = public
AS $$
DECLARE
  v_text TEXT;
  v_rule JSONB;
  v_pattern TEXT;
  v_hit BOOLEAN;
  v_ok BOOLEAN;
  v_points INTEGER;
  v_earned INTEGER := 0;
  v_max INTEGER := 0;
  v_checks JSONB := '[]'::jsonb;
  v_limit INTEGER := COALESCE((p_spec ->> 'max_chars')::integer, 20000);
BEGIN
  IF p_spec IS NULL OR jsonb_typeof(p_spec -> 'rules') <> 'array' THEN
    RAISE EXCEPTION 'This task has no rules.';
  END IF;
  IF p_text IS NULL OR length(trim(p_text)) = 0 THEN
    v_text := '';
  ELSIF length(p_text) > v_limit THEN
    RAISE EXCEPTION 'That is longer than the % characters this task allows.', v_limit;
  ELSE
    -- Full-line comments (#, //, --) never count, so a fault cannot be hidden
    -- and a control cannot be faked by commenting it in.
    v_text := regexp_replace(replace(p_text, E'\r', ''), '^[ \t]*(#|//|--).*$', '', 'gn');
  END IF;

  FOR v_rule IN SELECT value FROM jsonb_array_elements(p_spec -> 'rules') LOOP
    v_points := COALESCE((v_rule ->> 'points')::integer, 0);
    v_pattern := COALESCE(v_rule ->> 'need', v_rule ->> 'forbid');
    IF v_pattern IS NULL THEN
      RAISE EXCEPTION 'A rule needs a "need" or "forbid" pattern.';
    END IF;
    IF position('i' IN COALESCE(v_rule ->> 'flags', '')) > 0 THEN
      v_hit := v_text ~* v_pattern;
    ELSE
      v_hit := v_text ~ v_pattern;
    END IF;
    -- An empty submission passes nothing, so a blank box never shows green ticks
    -- for the "must not contain" rules.
    v_ok := CASE WHEN v_text = '' THEN false WHEN v_rule ? 'need' THEN v_hit ELSE NOT v_hit END;
    v_max := v_max + v_points;
    IF v_ok THEN v_earned := v_earned + v_points; END IF;
    v_checks := v_checks || jsonb_build_array(jsonb_build_object('ok', v_ok, 'hint', COALESCE(v_rule ->> 'hint', ''), 'points', v_points));
  END LOOP;

  RETURN jsonb_build_object('earned', v_earned, 'max', v_max, 'checks', v_checks);
END;
$$;
REVOKE EXECUTE ON FUNCTION public._grade_rules(TEXT, JSONB) FROM PUBLIC, anon, authenticated;

-- A member's pre-submission Check on one rules task. Does not lock or save
-- anything; returns the per-check result. At most 30 checks a day for each
-- lab task.
CREATE OR REPLACE FUNCTION public.check_lab_task(p_lab_id BIGINT, p_task_key TEXT, p_text TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_key public.lab_answer_keys%ROWTYPE;
  v_status TEXT;
BEGIN
  IF v_email IS NULL OR NOT public.is_member_allowed(v_email) THEN
    RAISE EXCEPTION 'Sign in to check your work.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.labs l WHERE l.id = p_lab_id AND l.kind = 'hub' AND l.is_published) THEN
    RAISE EXCEPTION 'That lab is not available.';
  END IF;
  SELECT * INTO v_key FROM public.lab_answer_keys k WHERE k.lab_id = p_lab_id AND k.task_key = p_task_key AND k.grading = 'rules';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That task cannot be checked.';
  END IF;
  SELECT la.status INTO v_status FROM public.lab_attempts la WHERE la.lab_id = p_lab_id AND la.member_email = v_email;
  IF v_status IN ('Submitted', 'Approved') THEN
    RAISE EXCEPTION 'This lab has already been submitted.';
  END IF;
  IF (SELECT count(*) FROM public.lab_task_checks c
      WHERE c.member_email = v_email AND c.lab_id = p_lab_id AND c.task_key = p_task_key
        AND c.checked_at > now() - interval '1 day') >= 30 THEN
    RAISE EXCEPTION 'You have used today''s 30 checks for this task. Come back tomorrow.';
  END IF;
  INSERT INTO public.lab_task_checks (lab_id, member_email, task_key) VALUES (p_lab_id, v_email, p_task_key);
  RETURN public._grade_rules(p_text, v_key.answer);
END;
$$;
GRANT EXECUTE ON FUNCTION public.check_lab_task(BIGINT, TEXT, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.check_lab_task(BIGINT, TEXT, TEXT) FROM PUBLIC, anon;

-- =========================================================================
-- SEED: nine engineering labs (2026-10-16)
-- =========================================================================
-- Prompts and starting files live in src/data/labs/eng*.js (matched by slug).
-- Rules, model fixes and rubrics live here, and only here. Patterns use
-- PostgreSQL regular expressions: \y is a word boundary (\b would mean
-- backspace), (?n) makes ^ and $ match at line breaks, and a rule's "flags"
-- of "i" makes it case-insensitive. Re-running updates in place.

INSERT INTO public.labs (slug, kind, title, summary, track, difficulty, est_minutes, platform, roadmap_item_title, is_published, sort_order, created_by)
VALUES
  ('eng-storage-aws-amanzi-statements', 'hub', 'Fix the Storage Exposure: Amanzi Statements (AWS)',
   'A statements bucket is public, unencrypted and sits beside a server with SSH open to the world. Fix the Terraform so it is safe to merge, and explain what you changed.',
   'Cloud Security', 'Beginner', 45, 'AWS', 'AWS Certified SysOps Administrator – Associate', true, 500, 'migration'),
  ('eng-storage-azure-karoostream', 'hub', 'Fix the Storage Exposure: KarooStream (Azure)',
   'A storage account allows public blobs, old TLS and open network access beside a server with SSH open to the world. Fix the Terraform so it is safe to merge, and explain what you changed.',
   'Cloud Security', 'Beginner', 45, 'Azure', 'AZ-104', true, 501, 'migration'),
  ('eng-container-karoo-parcels', 'hub', 'Harden a Container: Karoo Parcels',
   'A tracking API ships with a Dockerfile and a Compose file copied from a tutorial. Pin the image, drop root, remove baked-in secrets, and stop the Compose file handing the host to the container.',
   'DevSecOps', 'Intermediate', 60, 'Neutral', 'KCSA', true, 502, 'migration'),
  ('eng-kubernetes-masakhane-api', 'hub', 'Lock Down a Kubernetes Deployment: Masakhane Pay',
   'A payments API manifest runs privileged on the host network with a password in plain text. Bring it in line with the cluster''s pod security rules.',
   'DevSecOps', 'Intermediate', 50, 'Neutral', 'KCSA', true, 503, 'migration'),
  ('eng-iam-aws-sibusiso-reports', 'hub', 'Least-Privilege Policy: Sibusiso Analytics (AWS)',
   'A nightly job runs on an IAM policy that allows everything on everything. Replace it with one that lets the job list and download from a single bucket and nothing else.',
   'IAM', 'Intermediate', 40, 'AWS', 'AWS Certified Security – Specialty', true, 504, 'migration'),
  ('eng-iam-azure-ndlovu-insights', 'hub', 'Least-Privilege Role: Ndlovu Insights (Azure)',
   'A nightly job''s service principal is Owner of the whole subscription. Replace it with the smallest role, on the smallest scope, that still lets it read reports.',
   'IAM', 'Intermediate', 40, 'Azure', 'SC-300', true, 505, 'migration'),
  ('eng-detection-spray-kaapstad-credit', 'hub', 'Catch a Password-Spraying Attack: Kaapstad Credit Union',
   'One address is trying a few passwords against many staff accounts without locking any of them. Write a detection rule that catches it and leaves the head office gateway alone.',
   'SOC', 'Intermediate', 45, 'Neutral', 'CySA+', true, 506, 'migration'),
  ('eng-audit-aws-own-account', 'hub', 'Audit a Bucket in Your Own AWS Account',
   'Create a throwaway bucket in your free AWS account, check its public access and encryption with read-only commands, fix the gaps and paste the output. No access to your account is ever needed.',
   'Cloud Security', 'Beginner', 45, 'AWS', 'AWS Certified Security – Specialty', true, 507, 'migration'),
  ('eng-audit-azure-own-account', 'hub', 'Audit a Storage Account in Your Own Azure Account',
   'Create a throwaway storage account in your free Azure account, check its settings and firewall with read-only commands, fix the gaps and paste the output. No access to your account is ever needed.',
   'Cloud Security', 'Beginner', 45, 'Azure', 'SC-500', true, 508, 'migration')
ON CONFLICT (slug) DO UPDATE SET
  kind = EXCLUDED.kind,
  title = EXCLUDED.title,
  summary = EXCLUDED.summary,
  track = EXCLUDED.track,
  difficulty = EXCLUDED.difficulty,
  est_minutes = EXCLUDED.est_minutes,
  platform = EXCLUDED.platform,
  roadmap_item_title = EXCLUDED.roadmap_item_title,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();

INSERT INTO public.lab_answer_keys (lab_id, task_key, grading, answer, points, model_answer, rubric)
SELECT l.id, v.task_key, v.grading, v.answer, v.points, v.model_answer, v.rubric
FROM public.labs l
JOIN (VALUES
  -- ---------------- Fix the Storage Exposure: Amanzi Statements (AWS) ----------------
  ('eng-storage-aws-amanzi-statements', 't1', 'single',
   $j$"public-acl"$j$::jsonb, 10,
   $m$The public bucket is the most dangerous fault: with a public-read ACL anyone who guesses or finds the bucket name can download every customer statement, with no account and no logs of who. The missing encryption and the open SSH port matter, but neither exposes customer data on its own the way the public ACL does.$m$,
   NULL::jsonb),
  ('eng-storage-aws-amanzi-statements', 't2', 'rules',
   $j${"max_chars": 20000, "rules": [{"forbid": "acl\\s*=\\s*[\"\\']public-read", "hint": "The bucket is still public. Remove the public-read ACL.", "points": 15}, {"need": "aws_s3_bucket_public_access_block", "hint": "Add a public access block resource for the bucket.", "points": 10}, {"need": "block_public_acls\\s*=\\s*true", "hint": "block_public_acls is not switched on.", "points": 5}, {"need": "block_public_policy\\s*=\\s*true", "hint": "block_public_policy is not switched on.", "points": 5}, {"need": "ignore_public_acls\\s*=\\s*true", "hint": "ignore_public_acls is not switched on.", "points": 5}, {"need": "restrict_public_buckets\\s*=\\s*true", "hint": "restrict_public_buckets is not switched on.", "points": 5}, {"need": "aws_s3_bucket_server_side_encryption_configuration", "hint": "The bucket has no server-side encryption.", "points": 10}, {"forbid": "from_port\\s*=\\s*22\\y[^}]*0\\.0\\.0\\.0/0|0\\.0\\.0\\.0/0[^}]*from_port\\s*=\\s*22\\y", "hint": "SSH is still open to the whole internet. Restrict it or remove it.", "points": 15}, {"forbid": "AKIA[0-9A-Z]{16}|(access_key|secret_key)\\s*=\\s*[\"\\']", "hint": "A key is still written in the file. Use a role or environment instead.", "points": 10}]}$j$::jsonb, 80,
   $m$provider "aws" {
  region = "af-south-1"
}

resource "aws_s3_bucket" "statements" {
  bucket = "amanzi-customer-statements"
}

resource "aws_s3_bucket_public_access_block" "statements" {
  bucket                  = aws_s3_bucket.statements.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "statements" {
  bucket = aws_s3_bucket.statements.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_security_group" "statement_server" {
  name = "statement-server"

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Your resource names will differ. The controls are what matter: no public ACL,
# all four public access block settings, encryption, no world-open SSH, and no
# keys in the file (the provider picks up credentials from a role).$m$,
   NULL::jsonb),
  ('eng-storage-aws-amanzi-statements', 't3', 'rubric',
   NULL::jsonb, 0,
   $m$The public bucket goes first: it is the one fault that exposes customer data today. Then the public access block (so it cannot be made public again by mistake), encryption, SSH, and the keys. A strong answer says why the order matters, not just what changed.$m$,
   $j$[{"criterion": "What changed", "levels": ["Vague or missing", "Names the changes but not where", "Names each change and what it did"]}, {"criterion": "Why it matters", "levels": ["No reason given", "Reasons are generic", "Ties each change to a real risk for this organisation"]}, {"criterion": "Priority", "levels": ["No priority", "A priority with no reason", "One change chosen first, with a clear reason"]}]$j$::jsonb),

  -- ---------------- Fix the Storage Exposure: KarooStream (Azure) ----------------
  ('eng-storage-azure-karoostream', 't1', 'single',
   $j$"nested-public"$j$::jsonb, 10,
   $m$Allowing blobs to be public is what lets a container be set to anonymous read. With that on, an invoice container can be read by anyone who has its address, with no sign-in. Old TLS and open SSH are real findings, but they do not by themselves hand over customer invoices.$m$,
   NULL::jsonb),
  ('eng-storage-azure-karoostream', 't2', 'rules',
   $j${"max_chars": 20000, "rules": [{"need": "allow_nested_items_to_be_public\\s*=\\s*false", "hint": "Blobs can still be made public. Turn that off explicitly.", "points": 15}, {"need": "min_tls_version\\s*=\\s*[\"\\']TLS1_2", "hint": "The minimum TLS version is below 1.2.", "points": 10}, {"need": "(enable_https_traffic_only|https_traffic_only_enabled)\\s*=\\s*true", "hint": "HTTPS-only is not switched on.", "points": 10}, {"need": "default_action\\s*=\\s*[\"\\']Deny", "hint": "The storage firewall still allows traffic by default.", "points": 15}, {"forbid": "destination_port_range\\s*=\\s*[\"\\']22[\"\\'][^}]*source_address_prefix\\s*=\\s*[\"\\'](\\*|0\\.0\\.0\\.0/0|Internet)[\"\\']|source_address_prefix\\s*=\\s*[\"\\'](\\*|0\\.0\\.0\\.0/0|Internet)[\"\\'][^}]*destination_port_range\\s*=\\s*[\"\\']22[\"\\']", "hint": "SSH is still open to the whole internet. Restrict the source or remove the rule.", "points": 15}, {"forbid": "client_secret\\s*=\\s*[\"\\']", "hint": "A client secret is still written in the file.", "points": 10}]}$j$::jsonb, 75,
   $m$provider "azurerm" {
  features {}
}

resource "azurerm_storage_account" "media" {
  name                            = "karoostreammedia"
  resource_group_name             = "rg-karoostream"
  location                        = "southafricanorth"
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  allow_nested_items_to_be_public = false
  min_tls_version                 = "TLS1_2"
  https_traffic_only_enabled      = true

  network_rules {
    default_action = "Deny"
    bypass         = ["AzureServices"]
  }
}

resource "azurerm_network_security_rule" "ssh" {
  name                        = "allow-ssh-from-office"
  priority                    = 100
  direction                   = "Inbound"
  access                      = "Allow"
  protocol                    = "Tcp"
  source_port_range           = "*"
  destination_port_range      = "22"
  source_address_prefix       = "203.0.113.0/24"
  destination_address_prefix  = "*"
  resource_group_name         = "rg-karoostream"
  network_security_group_name = "nsg-encoder"
}

# Your resource names will differ. The controls are what matter: no public blobs,
# TLS 1.2 or newer, HTTPS only, a deny-by-default firewall, SSH from a known
# range only, and no client secret in the file.$m$,
   NULL::jsonb),
  ('eng-storage-azure-karoostream', 't3', 'rubric',
   NULL::jsonb, 0,
   $m$Public blobs first: it is the setting that exposes customer invoices. Then the firewall default, TLS and HTTPS, SSH, and the secret. A strong answer links each change to what it stops.$m$,
   $j$[{"criterion": "What changed", "levels": ["Vague or missing", "Names the changes but not where", "Names each change and what it did"]}, {"criterion": "Why it matters", "levels": ["No reason given", "Reasons are generic", "Ties each change to a real risk for this organisation"]}, {"criterion": "Priority", "levels": ["No priority", "A priority with no reason", "One change chosen first, with a clear reason"]}]$j$::jsonb),

  -- ---------------- Harden a Container: Karoo Parcels ----------------
  ('eng-container-karoo-parcels', 't1', 'multi',
   $j$["privileged", "docker-sock", "host-net"]$j$::jsonb, 10,
   $m$A privileged container, the Docker socket and the host network each give a compromised container a way onto the host: privileged turns off most isolation, the socket lets it start any container (including a privileged one), and the host network puts it on the machine's own network. A health check and a pinned tag are good practice and add no escape route.$m$,
   NULL::jsonb),
  ('eng-container-karoo-parcels', 't2', 'rules',
   $j${"max_chars": 20000, "rules": [{"forbid": "(?n)^\\s*FROM\\s+\\S+:latest\\y", "hint": "The base image is still \"latest\". Pin it to a version.", "points": 10}, {"need": "(?n)^\\s*FROM\\s+\\S+:[0-9]", "hint": "The base image needs a version tag, such as 3.12-slim.", "points": 5}, {"forbid": "(?n)^\\s*(ENV|ARG)\\s+\\w*(secret|password|token|api_?key)\\w*[ =]\\s*\\S+", "hint": "A secret is still baked into the image. Pass it in at run time.", "points": 15, "flags": "i"}, {"need": "(?n)^\\s*USER\\s+(?!root\\y|0\\y)\\S+", "hint": "The container still runs as root. Add a non-root USER.", "points": 15}, {"forbid": "(?n)^\\s*ADD\\s+\\S", "hint": "Use COPY instead of ADD.", "points": 5}, {"need": "(?n)^\\s*HEALTHCHECK\\s", "hint": "Add a HEALTHCHECK.", "points": 5}, {"forbid": "(?n)^\\s*EXPOSE\\s+.*\\y22\\y", "hint": "Port 22 is still exposed. The app only serves its own port.", "points": 5}]}$j$::jsonb, 60,
   $m$FROM python:3.12-slim

RUN useradd --create-home --uid 10001 appuser

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

USER appuser

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=3s CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5000/health')"

CMD ["python", "app.py"]

# The secret key is no longer in the image: the platform passes SECRET_KEY in
# when the container starts.$m$,
   NULL::jsonb),
  ('eng-container-karoo-parcels', 't3', 'rules',
   $j${"max_chars": 20000, "rules": [{"forbid": "privileged:\\s*true", "hint": "The container is still privileged.", "points": 10}, {"forbid": "docker\\.sock", "hint": "The Docker socket is still mounted into the container.", "points": 10}, {"forbid": "network_mode:\\s*[\"\\']?host", "hint": "The container is still on the host network.", "points": 5}, {"forbid": "(?n)^\\s*-\\s*[\"\\']?(0\\.0\\.0\\.0:)?5432:5432", "hint": "The database port is still published to everyone. Remove it or bind it to 127.0.0.1.", "points": 10}, {"need": "read_only:\\s*true", "hint": "Make the API container read-only.", "points": 5}, {"need": "cap_drop:[\\s\\S]{0,30}ALL", "hint": "Drop all Linux capabilities.", "points": 5, "flags": "i"}]}$j$::jsonb, 45,
   $m$services:
  api:
    build: .
    read_only: true
    cap_drop:
      - ALL
    ports:
      - "5000:5000"
  db:
    image: postgres:16
    # No ports published: the API reaches the database over the Compose network.$m$,
   NULL::jsonb),
  ('eng-container-karoo-parcels', 't4', 'rubric',
   NULL::jsonb, 0,
   $m$The Dockerfile: pinned image, no secret, non-root user. The Compose file: no privileged mode, no Docker socket, no published database port. If only one change, removing the Docker socket mount (or privileged mode) reduces the most risk, because it hands the host to anything that breaks into the container.$m$,
   $j$[{"criterion": "What changed", "levels": ["Vague or missing", "Names the changes but not where", "Names each change and what it did"]}, {"criterion": "Why it matters", "levels": ["No reason given", "Reasons are generic", "Ties each change to a real risk for this organisation"]}, {"criterion": "Priority", "levels": ["No priority", "A priority with no reason", "One change chosen first, with a clear reason"]}]$j$::jsonb),

  -- ---------------- Lock Down a Kubernetes Deployment: Masakhane Pay ----------------
  ('eng-kubernetes-masakhane-api', 't1', 'single',
   $j$"privileged"$j$::jsonb, 10,
   $m$privileged: true gives the container nearly every capability of the node and access to its devices. A compromised pod can take over the node and everything scheduled on it. Replica count, ports and labels are not security settings.$m$,
   NULL::jsonb),
  ('eng-kubernetes-masakhane-api', 't2', 'rules',
   $j${"max_chars": 20000, "rules": [{"forbid": "privileged:\\s*true", "hint": "The pod is still privileged.", "points": 10}, {"forbid": "hostNetwork:\\s*true", "hint": "The pod is still on the host network.", "points": 10}, {"forbid": "image:\\s*\\S+:latest", "hint": "The image is still \"latest\". Pin a version.", "points": 10}, {"need": "image:\\s*\\S+:[0-9]", "hint": "The image needs a version tag, such as 1.4.2.", "points": 5}, {"need": "runAsNonRoot:\\s*true", "hint": "Set runAsNonRoot to true.", "points": 10}, {"forbid": "runAsUser:\\s*0\\y", "hint": "The pod is still set to run as user 0 (root).", "points": 5}, {"need": "allowPrivilegeEscalation:\\s*false", "hint": "Set allowPrivilegeEscalation to false.", "points": 10}, {"need": "readOnlyRootFilesystem:\\s*true", "hint": "Make the root filesystem read-only.", "points": 10}, {"need": "drop:[\\s\\S]{0,40}ALL", "hint": "Drop all Linux capabilities.", "points": 10, "flags": "i"}, {"forbid": "(?n)name:\\s*[\"\\']?\\w*(password|secret|token)\\w*[\"\\']?\\s*\\n\\s*value:", "hint": "A password is written into the manifest. Reference the Secret instead.", "points": 10, "flags": "i"}, {"need": "limits:[\\s\\S]*?(cpu[\\s\\S]*?memory|memory[\\s\\S]*?cpu)", "hint": "Set both CPU and memory limits.", "points": 10}]}$j$::jsonb, 100,
   $m$apiVersion: apps/v1
kind: Deployment
metadata:
  name: payments-api
spec:
  replicas: 3
  selector:
    matchLabels:
      app: payments-api
  template:
    metadata:
      labels:
        app: payments-api
    spec:
      containers:
        - name: api
          image: masakhane/payments-api:1.4.2
          ports:
            - containerPort: 8080
          env:
            - name: DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: api-secrets
                  key: db-password
          resources:
            limits:
              cpu: "500m"
              memory: "256Mi"
          securityContext:
            runAsNonRoot: true
            allowPrivilegeEscalation: false
            readOnlyRootFilesystem: true
            capabilities:
              drop: ["ALL"]$m$,
   NULL::jsonb),
  ('eng-kubernetes-masakhane-api', 't3', 'rubric',
   NULL::jsonb, 0,
   $m$Removing privileged mode and the host network comes first: they let a compromised pod take over the node. Then non-root and no privilege escalation, a read-only filesystem and dropped capabilities, then the secret and the limits.$m$,
   $j$[{"criterion": "What changed", "levels": ["Vague or missing", "Names the changes but not where", "Names each change and what it did"]}, {"criterion": "Why it matters", "levels": ["No reason given", "Reasons are generic", "Ties each change to a real risk for this organisation"]}, {"criterion": "Priority", "levels": ["No priority", "A priority with no reason", "One change chosen first, with a clear reason"]}]$j$::jsonb),

  -- ---------------- Least-Privilege Policy: Sibusiso Analytics (AWS) ----------------
  ('eng-iam-aws-sibusiso-reports', 't1', 'single',
   $j$"takeover"$j$::jsonb, 10,
   $m$With s3:* and iam:* on every resource, a leaked credential can read or delete any bucket and create administrator users, which is a full account takeover. The cost or speed of the job is not the issue; the blast radius is.$m$,
   NULL::jsonb),
  ('eng-iam-aws-sibusiso-reports', 't2', 'rules',
   $j${"max_chars": 20000, "rules": [{"forbid": "s3:\\*", "hint": "The policy still allows every S3 action.", "points": 10}, {"forbid": "iam:", "hint": "The job does not need any IAM actions.", "points": 15}, {"forbid": "\"\\*\"", "hint": "A bare * (every action or every resource) is still in the policy.", "points": 15}, {"forbid": "s3:(Put|Delete)", "hint": "The job only reads. Remove the write and delete actions.", "points": 10}, {"need": "s3:GetObject", "hint": "The job cannot download reports yet.", "points": 10}, {"need": "s3:ListBucket", "hint": "The job cannot list the reports yet.", "points": 10}, {"need": "arn:aws:s3:::sibusiso-client-reports[\"\\']", "hint": "Listing needs the bucket address itself.", "points": 5}, {"need": "arn:aws:s3:::sibusiso-client-reports/\\*", "hint": "Downloading needs the address of the objects in the bucket.", "points": 5}]}$j$::jsonb, 80,
   $m${
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ListReports",
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::sibusiso-client-reports"
    },
    {
      "Sid": "DownloadReports",
      "Effect": "Allow",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::sibusiso-client-reports/*"
    }
  ]
}$m$,
   NULL::jsonb),
  ('eng-iam-aws-sibusiso-reports', 't3', 'rubric',
   NULL::jsonb, 0,
   $m$Two statements, because listing applies to the bucket and downloading applies to the objects in it. Only the two read actions, only the one bucket. To check the job still works, run it in a test account or with the policy simulator and read the access log for denied calls.$m$,
   $j$[{"criterion": "What changed", "levels": ["Vague or missing", "Names the changes but not where", "Names each change and what it did"]}, {"criterion": "Why it matters", "levels": ["No reason given", "Reasons are generic", "Ties each change to a real risk for this organisation"]}, {"criterion": "Priority", "levels": ["No priority", "A priority with no reason", "One change chosen first, with a clear reason"]}]$j$::jsonb),

  -- ---------------- Least-Privilege Role: Ndlovu Insights (Azure) ----------------
  ('eng-iam-azure-ndlovu-insights', 't1', 'single',
   $j$"takeover"$j$::jsonb, 10,
   $m$An Owner at the subscription can read, change or delete anything in it and grant others access, so one leaked secret is a full takeover. The job's speed or the bill is not the concern; the blast radius is.$m$,
   NULL::jsonb),
  ('eng-iam-azure-ndlovu-insights', 't2', 'rules',
   $j${"max_chars": 20000, "rules": [{"forbid": "role_definition_name\\s*=\\s*[\"\\'](Owner|Contributor|User Access Administrator)", "hint": "The role is still far too powerful for a job that only reads.", "points": 20}, {"need": "role_definition_name\\s*=\\s*[\"\\']Storage Blob Data Reader", "hint": "Use the Storage Blob Data Reader role.", "points": 20}, {"forbid": "scope\\s*=\\s*data\\.azurerm_subscription", "hint": "The role is still assigned at the whole subscription.", "points": 15}, {"need": "scope\\s*=\\s*azurerm_storage_(account|container)\\.\\w+\\.id", "hint": "Scope the role to the storage account.", "points": 20}]}$j$::jsonb, 75,
   $m$resource "azurerm_role_assignment" "report_job" {
  scope                = azurerm_storage_account.reports.id
  role_definition_name = "Storage Blob Data Reader"
  principal_id         = azuread_service_principal.report_job.object_id
}$m$,
   NULL::jsonb),
  ('eng-iam-azure-ndlovu-insights', 't3', 'rubric',
   NULL::jsonb, 0,
   $m$Storage Blob Data Reader is the built-in role for reading blob data, and the storage account is the smallest scope that covers the reports. To confirm it still works, run the job and check it can read, then confirm it is refused when it tries to write or touch anything else.$m$,
   $j$[{"criterion": "What changed", "levels": ["Vague or missing", "Names the changes but not where", "Names each change and what it did"]}, {"criterion": "Why it matters", "levels": ["No reason given", "Reasons are generic", "Ties each change to a real risk for this organisation"]}, {"criterion": "Priority", "levels": ["No priority", "A priority with no reason", "One change chosen first, with a clear reason"]}]$j$::jsonb),

  -- ---------------- Catch a Password-Spraying Attack: Kaapstad Credit Union ----------------
  ('eng-detection-spray-kaapstad-credit', 't1', 'single',
   $j$"spray"$j$::jsonb, 10,
   $m$Password spraying tries a small number of common passwords against many accounts, so no single account sees enough failures to lock. Brute force hammers one account; that is not what the log shows.$m$,
   NULL::jsonb),
  ('eng-detection-spray-kaapstad-credit', 't2', 'rules',
   $j${"max_chars": 20000, "rules": [{"need": "event:\\s*signin_failed", "hint": "Look at failed sign-in events.", "points": 5, "flags": "i"}, {"need": "group_by:\\s*source_ip", "hint": "Count by source address. Spraying is one address across many accounts, so counting by user misses it.", "points": 25, "flags": "i"}, {"need": "distinct_users:\\s*[\"\\']?\\s*>=?\\s*([3-9]|[1-4][0-9])\\y", "hint": "Pick a number of accounts the attack really crosses, from 3 to 49.", "points": 20, "flags": "i"}, {"need": "window:\\s*(([1-9]|[1-5][0-9]|60)m|1h)\\y", "hint": "Use a window between 1 minute and 1 hour.", "points": 15, "flags": "i"}, {"need": "exclude:[\\s\\S]*10\\.20\\.0\\.5", "hint": "Exclude the head office gateway, 10.20.0.5, or it will fire every Monday.", "points": 15, "flags": "i"}]}$j$::jsonb, 80,
   $m$detect:
  event: signin_failed
  group_by: source_ip
  window: 10m
  where:
    distinct_users: ">= 5"
    count: ">= 15"
  exclude:
    source_ip: ["10.20.0.5"]$m$,
   NULL::jsonb),
  ('eng-detection-spray-kaapstad-credit', 't3', 'rubric',
   NULL::jsonb, 0,
   $m$Group by source address because spraying is one address across many accounts. Thresholds need to sit below what the attacker does (six accounts in under a minute) and above ordinary typos. The head office gateway is excluded because every employee appears to come from it. Remaining false alarms: other shared addresses, such as a branch or a VPN, which an allowlist would need to cover.$m$,
   $j$[{"criterion": "What changed", "levels": ["Vague or missing", "Names the changes but not where", "Names each change and what it did"]}, {"criterion": "Why it matters", "levels": ["No reason given", "Reasons are generic", "Ties each change to a real risk for this organisation"]}, {"criterion": "Priority", "levels": ["No priority", "A priority with no reason", "One change chosen first, with a clear reason"]}]$j$::jsonb),

  -- ---------------- Audit a Bucket in Your Own AWS Account ----------------
  ('eng-audit-aws-own-account', 't1', 'single',
   $j$"policy"$j$::jsonb, 10,
   $m$BlockPublicPolicy false means S3 will accept a bucket policy that makes the bucket public. The other three settings cover public ACLs; this one covers policies. All four need to be true.$m$,
   NULL::jsonb),
  ('eng-audit-aws-own-account', 't2', 'rules',
   $j${"max_chars": 20000, "rules": [{"need": "BlockPublicAcls\\W+true", "hint": "BlockPublicAcls is not true.", "points": 10, "flags": "i"}, {"need": "BlockPublicPolicy\\W+true", "hint": "BlockPublicPolicy is not true.", "points": 10, "flags": "i"}, {"need": "IgnorePublicAcls\\W+true", "hint": "IgnorePublicAcls is not true.", "points": 10, "flags": "i"}, {"need": "RestrictPublicBuckets\\W+true", "hint": "RestrictPublicBuckets is not true.", "points": 10, "flags": "i"}, {"forbid": ":\\s*false", "hint": "A setting in the output is still false.", "points": 5}, {"forbid": "\\y[0-9]{12}\\y", "hint": "Remove your 12-digit account ID before pasting.", "points": 5}]}$j$::jsonb, 50,
   $m${
    "PublicAccessBlockConfiguration": {
        "BlockPublicAcls": true,
        "IgnorePublicAcls": true,
        "BlockPublicPolicy": true,
        "RestrictPublicBuckets": true
    }
}$m$,
   NULL::jsonb),
  ('eng-audit-aws-own-account', 't3', 'rules',
   $j${"max_chars": 20000, "rules": [{"need": "SSEAlgorithm\\W+(AES256|aws:kms)", "hint": "The output does not show a default encryption algorithm.", "points": 20}, {"forbid": "\\y[0-9]{12}\\y", "hint": "Remove your 12-digit account ID before pasting.", "points": 5}]}$j$::jsonb, 25,
   $m${
    "ServerSideEncryptionConfiguration": {
        "Rules": [
            {
                "ApplyServerSideEncryptionByDefault": {
                    "SSEAlgorithm": "AES256"
                },
                "BucketKeyEnabled": true
            }
        ]
    }
}$m$,
   NULL::jsonb),
  ('eng-audit-aws-own-account', 't4', 'rubric',
   NULL::jsonb, 0,
   $m$A good answer names the settings that were off, the exact commands or console steps that fixed them, and a way to check at scale: an AWS Config rule or a security scanner that flags any bucket without all four block settings and default encryption.$m$,
   $j$[{"criterion": "What the audit found", "levels": ["Not described", "Described without the actual settings", "States what each setting was before the fix"]}, {"criterion": "What was changed", "levels": ["Not described", "Changes named but vague", "The exact settings changed, and the command used"]}, {"criterion": "Scaling it up", "levels": ["No idea", "Mentions a tool without how it helps", "A realistic way to check many accounts, such as a policy or scanner, and what it would flag"]}]$j$::jsonb),

  -- ---------------- Audit a Storage Account in Your Own Azure Account ----------------
  ('eng-audit-azure-own-account', 't1', 'single',
   $j$"anon"$j$::jsonb, 10,
   $m$publicAccess true means containers can be configured for anonymous read, so anyone with a blob's address can download it without signing in. It does not describe TLS, regions or SAS tokens.$m$,
   NULL::jsonb),
  ('eng-audit-azure-own-account', 't2', 'rules',
   $j${"max_chars": 20000, "rules": [{"need": "publicAccess\\W+false", "hint": "publicAccess is not false.", "points": 20, "flags": "i"}, {"need": "httpsOnly\\W+true", "hint": "httpsOnly is not true.", "points": 15, "flags": "i"}, {"need": "minTls\\W+TLS1_[23]", "hint": "minTls is below TLS 1.2.", "points": 10, "flags": "i"}, {"forbid": "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}", "hint": "Remove any subscription ID before pasting.", "points": 5}]}$j$::jsonb, 50,
   $m${
  "httpsOnly": true,
  "minTls": "TLS1_2",
  "publicAccess": false
}$m$,
   NULL::jsonb),
  ('eng-audit-azure-own-account', 't3', 'rules',
   $j${"max_chars": 20000, "rules": [{"need": "\\yDeny\\y", "hint": "The default network rule is not Deny.", "points": 20, "flags": "i"}, {"forbid": "\\yAllow\\y", "hint": "The output still shows Allow.", "points": 5, "flags": "i"}]}$j$::jsonb, 25,
   $m$"Deny"$m$,
   NULL::jsonb),
  ('eng-audit-azure-own-account', 't4', 'rubric',
   NULL::jsonb, 0,
   $m$A good answer names the settings that were off, the exact commands or portal steps that fixed them, and a way to check at scale: Azure Policy with built-in definitions for storage accounts, or a security scanner that flags any account allowing public blobs, HTTP or old TLS.$m$,
   $j$[{"criterion": "What the audit found", "levels": ["Not described", "Described without the actual settings", "States what each setting was before the fix"]}, {"criterion": "What was changed", "levels": ["Not described", "Changes named but vague", "The exact settings changed, and the command used"]}, {"criterion": "Scaling it up", "levels": ["No idea", "Mentions a tool without how it helps", "A realistic way to check many accounts, such as a policy or scanner, and what it would flag"]}]$j$::jsonb)
) AS v(slug, task_key, grading, answer, points, model_answer, rubric) ON v.slug = l.slug
ON CONFLICT (lab_id, task_key) DO UPDATE SET
  grading = EXCLUDED.grading,
  answer = EXCLUDED.answer,
  points = EXCLUDED.points,
  model_answer = EXCLUDED.model_answer,
  rubric = EXCLUDED.rubric;
