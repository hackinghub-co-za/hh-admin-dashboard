-- Hacking Hub Admin Dashboard - Quiz Duel (Phase 1 of the head-to-head
-- competitions roadmap - see the "Duel Protocol" planning artifact)
-- Run in the Supabase SQL Editor after 002-061 have already been applied.
-- Safe to re-run: every statement is idempotent (question seed rows use a
-- stable natural key so re-running doesn't duplicate them).
--
-- Two members answer the same fixed set of questions independently, at
-- their own pace, inside a 48-hour window - most correct answers wins,
-- total time to finish breaks a tie. Fully async, no live synchronization,
-- so this needs no new infrastructure class (unlike live buzzer trivia).
--
-- duel_questions is a NEW, separate table from quiz_questions
-- (054_quiz_system.sql) rather than reusing it - two real reasons:
-- (1) quiz_questions.correct_index is directly SELECT-able by any member
-- today (that file's own comment confirms the "don't reveal the answer"
-- protection there is a client-side UX convention, not RLS - fine for
-- solo self-study, where cheating only hurts yourself, but not fine for a
-- competitive duel against a named opponent). Members here get questions
-- ONLY via get_duel_questions() below, which never returns correct_index -
-- answers are graded server-side inside submit_duel_answer(), and there is
-- no member-facing SELECT policy on duel_questions at all. (2) these
-- questions are track-agnostic general cyber knowledge, not tied to one
-- cert's exam objectives the way quiz_questions is - mixing the two would
-- clutter cert-readiness matching for no benefit.

-- =========================================================================
-- SCHEMA
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.duel_questions (
  id BIGSERIAL PRIMARY KEY,
  domain TEXT NOT NULL,        -- SOC, Offensive Security, Cloud Security, DevSecOps, IAM, AI Security, GRC
  question TEXT NOT NULL,
  choices JSONB NOT NULL,      -- ["choice A", "choice B", "choice C", "choice D"]
  correct_index INTEGER NOT NULL CHECK (correct_index >= 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.duel_questions ENABLE ROW LEVEL SECURITY;

-- No member-facing SELECT policy at all, deliberately - see header comment.
-- Members only ever see questions through get_duel_questions() below.
DROP POLICY IF EXISTS "admins manage duel questions" ON public.duel_questions;
CREATE POLICY "admins manage duel questions"
  ON public.duel_questions FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.quiz_duels (
  id BIGSERIAL PRIMARY KEY,
  member_a_email TEXT NOT NULL,
  member_a_name TEXT,
  member_b_email TEXT NOT NULL,
  member_b_name TEXT,
  question_ids JSONB NOT NULL,   -- fixed array of duel_questions.id, same set for both players
  status TEXT NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Completed', 'Void')),
  winner_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  resolved_at TIMESTAMP WITH TIME ZONE,
  win_announced_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.quiz_duels ADD COLUMN IF NOT EXISTS win_announced_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE public.quiz_duels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read own duels" ON public.quiz_duels;
CREATE POLICY "members read own duels"
  ON public.quiz_duels FOR SELECT
  TO authenticated
  USING (
    lower(auth.jwt() ->> 'email') IN (member_a_email, member_b_email)
    AND public.is_member_allowed(auth.jwt() ->> 'email')
  );

-- No member-facing INSERT/UPDATE - creation goes through challenge_to_duel(),
-- resolution through submit_duel_answer()/resolve_expired_duels(), all
-- SECURITY DEFINER.
DROP POLICY IF EXISTS "admins manage duels" ON public.quiz_duels;
CREATE POLICY "admins manage duels"
  ON public.quiz_duels FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.quiz_duel_answers (
  id BIGSERIAL PRIMARY KEY,
  duel_id BIGINT NOT NULL REFERENCES public.quiz_duels(id) ON DELETE CASCADE,
  member_email TEXT NOT NULL,
  question_id BIGINT NOT NULL REFERENCES public.duel_questions(id),
  chosen_index INTEGER NOT NULL,
  is_correct BOOLEAN NOT NULL,
  answered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (duel_id, member_email, question_id)
);

ALTER TABLE public.quiz_duel_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "members read own duel answers" ON public.quiz_duel_answers;
CREATE POLICY "members read own duel answers"
  ON public.quiz_duel_answers FOR SELECT
  TO authenticated
  USING (member_email = lower(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "admins manage duel answers" ON public.quiz_duel_answers;
CREATE POLICY "admins manage duel answers"
  ON public.quiz_duel_answers FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_quiz_duels_participants ON public.quiz_duels(member_a_email, member_b_email);
CREATE INDEX IF NOT EXISTS idx_quiz_duel_answers_duel ON public.quiz_duel_answers(duel_id);

-- =========================================================================
-- SEED - 21 general cyber questions, 3 per domain, original content
-- written for this migration (same "not reproduced from a vendor's
-- official material" standard as 054_quiz_system.sql). Deliberately broad,
-- widely-known concepts rather than domain-expert trivia, so a duel is
-- fair regardless of which track either player is actually on.
-- =========================================================================

INSERT INTO public.duel_questions (domain, question, choices, correct_index)
SELECT * FROM (VALUES
  ('SOC', 'What does "SIEM" stand for?', '["Security Information and Event Management", "Secure Internet Encryption Method", "System Integrity and Event Monitor", "Security Incident and Escalation Model"]'::jsonb, 0),
  ('SOC', 'In a SOC, what is a "false positive"?', '["An alert that correctly identifies a real threat", "An alert that incorrectly flags benign activity as malicious", "A missed detection of a real attack", "A type of malware that hides its true behavior"]'::jsonb, 1),
  ('SOC', 'Which log source most directly helps detect a brute-force login attempt?', '["DNS query logs", "Authentication/login logs", "Print spooler logs", "DHCP lease logs"]'::jsonb, 1),
  ('Offensive Security', 'What is the primary purpose of reconnaissance in a penetration test?', '["To exploit a vulnerability immediately", "To gather information about the target before attacking", "To write the final report", "To patch discovered vulnerabilities"]'::jsonb, 1),
  ('Offensive Security', 'What does "privilege escalation" refer to?', '["Gaining higher-level access than originally granted", "Encrypting files for ransom", "Scanning a network for open ports", "Removing user accounts from a system"]'::jsonb, 0),
  ('Offensive Security', 'Which tool is most commonly associated with network port scanning?', '["Wireshark", "Nmap", "Metasploit", "Burp Suite"]'::jsonb, 1),
  ('Cloud Security', 'What is the "shared responsibility model" in cloud security?', '["The cloud provider secures everything", "The customer secures everything", "Security responsibilities are divided between provider and customer", "Only third-party auditors are responsible"]'::jsonb, 2),
  ('Cloud Security', 'Which of these is a common cause of real-world cloud data breaches?', '["A misconfigured, publicly-accessible storage bucket", "A quantum computing attack", "A physical break-in at the data center", "A satellite signal jam"]'::jsonb, 0),
  ('Cloud Security', 'What does "least privilege" mean in an IAM policy?', '["Giving every user administrator access by default", "Granting only the permissions needed for a specific task", "Removing all access after 24 hours", "Sharing one account across a whole team"]'::jsonb, 1),
  ('DevSecOps', 'What does "shift-left" mean in a DevSecOps context?', '["Moving security testing earlier in the development lifecycle", "Moving the server to a different data center", "Delaying security reviews until after deployment", "Switching from Linux to Windows servers"]'::jsonb, 0),
  ('DevSecOps', 'What is the purpose of SAST (Static Application Security Testing)?', '["Testing a running application from the outside", "Analyzing source code for vulnerabilities without executing it", "Load-testing an application''s performance", "Monitoring network traffic in real time"]'::jsonb, 1),
  ('DevSecOps', 'Why is a Software Bill of Materials (SBOM) useful for security?', '["It lists every dependency, helping track known vulnerabilities", "It replaces the need for a firewall", "It encrypts source code automatically", "It''s a type of penetration test report"]'::jsonb, 0),
  ('IAM', 'What does MFA stand for?', '["Multiple File Access", "Multi-Factor Authentication", "Managed File Auditing", "Mandatory Firewall Activation"]'::jsonb, 1),
  ('IAM', 'What is "Zero Trust" primarily built around?', '["Trusting all traffic inside the corporate network by default", "Never verifying user identity once logged in", "Never automatically trusting any user or device, verifying every request", "Removing all authentication requirements"]'::jsonb, 2),
  ('IAM', 'What is a common risk of not promptly deprovisioning a former employee''s accounts?', '["Faster onboarding for new hires", "The former employee (or an attacker using their credentials) keeps access", "Reduced licensing costs", "Improved system performance"]'::jsonb, 1),
  ('AI Security', 'What is a "prompt injection" attack?', '["Physically damaging a server running an AI model", "Crafting input that manipulates an AI model into ignoring its instructions", "A type of SQL injection targeting AI databases only", "Overloading a GPU with too many requests"]'::jsonb, 1),
  ('AI Security', 'What does "model poisoning" refer to?', '["Deliberately corrupting a model''s training data to manipulate its behavior", "Running a model on outdated hardware", "Compressing a model to make it smaller", "Encrypting a model''s weights for storage"]'::jsonb, 0),
  ('AI Security', 'Why is data leakage a specific concern when using third-party AI tools with sensitive data?', '["It makes the AI respond slower", "Sensitive prompts could be stored, logged, or used to train future models", "It voids the AI provider''s uptime guarantee", "It''s not actually a real concern"]'::jsonb, 1),
  ('GRC', 'What does the "C" in the CIA triad stand for?', '["Compliance", "Confidentiality", "Certification", "Control"]'::jsonb, 1),
  ('GRC', 'What is the main purpose of a risk register in GRC?', '["Tracking identified risks with likelihood, impact, and mitigation plans", "Listing every employee''s salary", "Storing customer payment card numbers", "Scheduling server maintenance windows"]'::jsonb, 0),
  ('GRC', 'Which of these best describes the purpose of ISO 27001?', '["A programming language for secure coding", "An international standard for information security management systems", "A firewall configuration tool", "A type of encryption algorithm"]'::jsonb, 1)
) AS v(domain, question, choices, correct_index)
WHERE NOT EXISTS (
  SELECT 1 FROM public.duel_questions dq WHERE dq.question = v.question
);

-- =========================================================================
-- FUNCTIONS
-- =========================================================================

-- A duel win is announced publicly in the Dashboard's Recent Wins feed
-- (community_wins, 044_community_content.sql) - confirmed with the founder
-- over the quieter alternatives. win_announced_at makes this idempotent:
-- every resolution path below calls it, but a duel is only ever announced
-- once. A Void duel (nobody finished) has no winner and is never announced.
CREATE OR REPLACE FUNCTION public.announce_duel_win(p_duel_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_duel public.quiz_duels%ROWTYPE;
  v_winner_name TEXT;
  v_loser_name TEXT;
BEGIN
  SELECT * INTO v_duel FROM public.quiz_duels WHERE id = p_duel_id;
  IF v_duel.id IS NULL OR v_duel.status != 'Completed' OR v_duel.winner_email IS NULL OR v_duel.win_announced_at IS NOT NULL THEN
    RETURN;
  END IF;

  IF v_duel.winner_email = v_duel.member_a_email THEN
    v_winner_name := COALESCE(v_duel.member_a_name, v_duel.member_a_email);
    v_loser_name := COALESCE(v_duel.member_b_name, v_duel.member_b_email);
  ELSE
    v_winner_name := COALESCE(v_duel.member_b_name, v_duel.member_b_email);
    v_loser_name := COALESCE(v_duel.member_a_name, v_duel.member_a_email);
  END IF;

  INSERT INTO public.community_wins (member_name, achievement, achieved_date, created_by)
  VALUES (v_winner_name, 'Won a head-to-head Quiz Duel against ' || v_loser_name, CURRENT_DATE, 'Quiz Duel');

  UPDATE public.quiz_duels SET win_announced_at = timezone('utc'::text, now()) WHERE id = p_duel_id;
END;
$$;

-- Starts a duel immediately - no accept/decline step, matching "you pick
-- your rival, no admin needed" from the roadmap. Picks 10 random questions
-- (or fewer if the bank is smaller), same fixed set for both players.
CREATE OR REPLACE FUNCTION public.challenge_to_duel(p_opponent_email TEXT, p_opponent_name TEXT)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_opponent TEXT := lower(p_opponent_email);
  v_name TEXT;
  v_question_ids JSONB;
  v_id BIGINT;
BEGIN
  IF v_opponent = v_email THEN
    RAISE EXCEPTION 'You can''t challenge yourself.';
  END IF;
  IF NOT public.is_member_allowed(v_opponent) THEN
    RAISE EXCEPTION 'That member can''t be challenged right now.';
  END IF;

  SELECT full_name INTO v_name FROM public.member_profiles WHERE email = v_email;

  SELECT jsonb_agg(id) INTO v_question_ids FROM (
    SELECT id FROM public.duel_questions ORDER BY random() LIMIT 10
  ) q;

  IF v_question_ids IS NULL OR jsonb_array_length(v_question_ids) = 0 THEN
    RAISE EXCEPTION 'No duel questions are set up yet.';
  END IF;

  INSERT INTO public.quiz_duels (member_a_email, member_a_name, member_b_email, member_b_name, question_ids, expires_at)
  VALUES (v_email, v_name, v_opponent, p_opponent_name, v_question_ids, timezone('utc'::text, now()) + interval '48 hours')
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.challenge_to_duel(TEXT, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.challenge_to_duel(TEXT, TEXT) FROM PUBLIC, anon;

-- The caller's own duels, with per-player progress - resolves any of the
-- caller's own expired duels inline first (lazy resolution instead of a
-- separate polling mechanism - whoever next opens the portal triggers it).
CREATE OR REPLACE FUNCTION public.get_my_duels()
RETURNS TABLE (
  id BIGINT,
  opponent_email TEXT,
  opponent_name TEXT,
  is_member_a BOOLEAN,
  status TEXT,
  winner_email TEXT,
  my_correct_count INTEGER,
  opponent_correct_count INTEGER,
  total_questions INTEGER,
  my_answered_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
BEGIN
  -- Lazy resolution so a member never sees a stale "Active" duel that
  -- expired since the last hourly cron run. Deliberately delegates to the
  -- same sweep the cron calls rather than repeating the forfeit rule here -
  -- two copies of that logic would drift. It's a global sweep, but it only
  -- ever touches Active rows already past their deadline, and it's
  -- idempotent, so running it on a portal open costs effectively nothing.
  PERFORM public.resolve_expired_duels();

  RETURN QUERY
  SELECT
    d.id,
    CASE WHEN d.member_a_email = v_email THEN d.member_b_email ELSE d.member_a_email END,
    CASE WHEN d.member_a_email = v_email THEN d.member_b_name ELSE d.member_a_name END,
    d.member_a_email = v_email,
    d.status,
    d.winner_email,
    (SELECT COUNT(*)::INTEGER FROM public.quiz_duel_answers WHERE duel_id = d.id AND member_email = v_email AND is_correct),
    (SELECT COUNT(*)::INTEGER FROM public.quiz_duel_answers WHERE duel_id = d.id AND member_email = (CASE WHEN d.member_a_email = v_email THEN d.member_b_email ELSE d.member_a_email END) AND is_correct),
    jsonb_array_length(d.question_ids),
    (SELECT COUNT(*)::INTEGER FROM public.quiz_duel_answers WHERE duel_id = d.id AND member_email = v_email),
    d.created_at,
    d.expires_at
  FROM public.quiz_duels d
  WHERE d.member_a_email = v_email OR d.member_b_email = v_email
  ORDER BY d.created_at DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_my_duels() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_duels() FROM PUBLIC, anon;

-- Questions for one of the caller's own active duels - never includes
-- correct_index. Ownership-checked, same pattern as every other narrow
-- "my own row" function in this schema.
CREATE OR REPLACE FUNCTION public.get_duel_questions(p_duel_id BIGINT)
RETURNS TABLE (id BIGINT, domain TEXT, question TEXT, choices JSONB)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_question_ids JSONB;
BEGIN
  SELECT question_ids INTO v_question_ids
  FROM public.quiz_duels
  WHERE id = p_duel_id AND (member_a_email = v_email OR member_b_email = v_email);

  IF v_question_ids IS NULL THEN
    RAISE EXCEPTION 'Duel not found.';
  END IF;

  RETURN QUERY
  SELECT dq.id, dq.domain, dq.question, dq.choices
  FROM public.duel_questions dq
  WHERE dq.id IN (SELECT jsonb_array_elements_text(v_question_ids)::BIGINT)
  ORDER BY array_position(
    (SELECT array_agg(x::BIGINT) FROM jsonb_array_elements_text(v_question_ids) x),
    dq.id
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_duel_questions(BIGINT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_duel_questions(BIGINT) FROM PUBLIC, anon;

-- Grades one answer server-side (never trusting a client-computed
-- "is_correct") and records it. Rejects a question that isn't part of
-- this duel, a duel the caller isn't part of, an already-answered
-- question (UNIQUE constraint), or a duel that's no longer Active.
CREATE OR REPLACE FUNCTION public.submit_duel_answer(p_duel_id BIGINT, p_question_id BIGINT, p_chosen_index INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_question_ids JSONB;
  v_status TEXT;
  v_correct_index INTEGER;
  v_is_correct BOOLEAN;
BEGIN
  SELECT question_ids, status INTO v_question_ids, v_status
  FROM public.quiz_duels
  WHERE id = p_duel_id AND (member_a_email = v_email OR member_b_email = v_email);

  IF v_question_ids IS NULL THEN
    RAISE EXCEPTION 'Duel not found.';
  END IF;
  IF v_status != 'Active' THEN
    RAISE EXCEPTION 'This duel is no longer active.';
  END IF;
  IF NOT (v_question_ids @> to_jsonb(p_question_id)) THEN
    RAISE EXCEPTION 'That question isn''t part of this duel.';
  END IF;

  SELECT correct_index INTO v_correct_index FROM public.duel_questions WHERE id = p_question_id;
  v_is_correct := (v_correct_index = p_chosen_index);

  INSERT INTO public.quiz_duel_answers (duel_id, member_email, question_id, chosen_index, is_correct)
  VALUES (p_duel_id, v_email, p_question_id, p_chosen_index, v_is_correct);

  -- Resolve the duel the instant both players have answered every question.
  PERFORM 1
  FROM public.quiz_duels d
  WHERE d.id = p_duel_id
    AND (SELECT COUNT(*) FROM public.quiz_duel_answers WHERE duel_id = d.id AND member_email = d.member_a_email) = jsonb_array_length(d.question_ids)
    AND (SELECT COUNT(*) FROM public.quiz_duel_answers WHERE duel_id = d.id AND member_email = d.member_b_email) = jsonb_array_length(d.question_ids);

  IF FOUND THEN
    UPDATE public.quiz_duels d
    SET status = 'Completed',
        resolved_at = timezone('utc'::text, now()),
        winner_email = (
          SELECT CASE
            WHEN a_count > b_count THEN d.member_a_email
            WHEN b_count > a_count THEN d.member_b_email
            ELSE NULL
          END
          FROM (
            SELECT
              (SELECT COUNT(*) FROM public.quiz_duel_answers WHERE duel_id = d.id AND member_email = d.member_a_email AND is_correct) AS a_count,
              (SELECT COUNT(*) FROM public.quiz_duel_answers WHERE duel_id = d.id AND member_email = d.member_b_email AND is_correct) AS b_count
          ) counts
        )
    WHERE d.id = p_duel_id;

    PERFORM public.announce_duel_win(p_duel_id);
  END IF;

  RETURN v_is_correct;
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_duel_answer(BIGINT, BIGINT, INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.submit_duel_answer(BIGINT, BIGINT, INTEGER) FROM PUBLIC, anon;

-- Background sweep for duels nobody finished in time - "forfeit, the
-- finisher wins" (confirmed with the founder): whoever answered MORE
-- questions by the deadline wins; if both answered the same number
-- (including zero - neither showed up), the duel is Void, no winner.
-- Pure SQL, called directly by pg_cron below - no edge function needed.
CREATE OR REPLACE FUNCTION public.resolve_expired_duels()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.quiz_duels d
  SET status = CASE WHEN a_count = b_count THEN 'Void' ELSE 'Completed' END,
      resolved_at = timezone('utc'::text, now()),
      winner_email = CASE
        WHEN a_count > b_count THEN d.member_a_email
        WHEN b_count > a_count THEN d.member_b_email
        ELSE NULL
      END
  FROM (
    SELECT
      qd.id AS duel_id,
      (SELECT COUNT(*) FROM public.quiz_duel_answers WHERE duel_id = qd.id AND member_email = qd.member_a_email) AS a_count,
      (SELECT COUNT(*) FROM public.quiz_duel_answers WHERE duel_id = qd.id AND member_email = qd.member_b_email) AS b_count
    FROM public.quiz_duels qd
    WHERE qd.status = 'Active' AND qd.expires_at < timezone('utc'::text, now())
  ) counts
  WHERE d.id = counts.duel_id;

  PERFORM public.announce_duel_win(d.id)
  FROM public.quiz_duels d
  WHERE d.status = 'Completed' AND d.winner_email IS NOT NULL AND d.win_announced_at IS NULL;
END;
$$;

-- Pure SQL cron - no HTTP round-trip needed since this never leaves the
-- database, unlike the Resend-based email crons elsewhere in this project.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'resolve-expired-duels-hourly') THEN
    PERFORM cron.unschedule('resolve-expired-duels-hourly');
  END IF;
END $$;

SELECT cron.schedule(
  'resolve-expired-duels-hourly',
  '0 * * * *',
  $$ SELECT public.resolve_expired_duels(); $$
);
