-- Hacking Hub Admin Dashboard - Gemma upgrade
-- Run this in the Supabase SQL Editor after 002-099 have already been
-- applied. Safe to re-run: every statement is idempotent.
--
-- Everything Gemma (gemma-chat / gemma-tools edge functions) needs beyond
-- the single message table from 009_gemma_assistant.sql:
--   * conversations, so members can start a new chat
--   * per-reply feedback (thumbs) + the topic/actions/sources Gemma tags
--     each reply with
--   * an admin-editable knowledge base, replacing the FAQ text that was
--     hard-coded inside the edge function
--   * a server-side progress snapshot, so "how am I doing?" is answered
--     from real data instead of five profile fields
--   * weekly notes, lab hints/explanations, quiz results
--   * "talk to a person" hand-offs, which land on the Accountability
--     Check-ins list for community managers
--
-- Privacy model (founder decision, 2026-10-03): chats stay admin-readable
-- in the database for safety, but no screen browses them. The admin Gemma
-- tab only shows aggregate counts/topics, replies a member rated down, and
-- conversations a member explicitly sent to a person.

-- =========================================================================
-- CONVERSATIONS + MESSAGE METADATA
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.gemma_conversations (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT 'New chat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_gemma_conversations_email ON public.gemma_conversations(email, updated_at DESC);

ALTER TABLE public.gemma_messages ADD COLUMN IF NOT EXISTS conversation_id BIGINT REFERENCES public.gemma_conversations(id) ON DELETE CASCADE;
ALTER TABLE public.gemma_messages ADD COLUMN IF NOT EXISTS feedback SMALLINT CHECK (feedback IN (-1, 1));
ALTER TABLE public.gemma_messages ADD COLUMN IF NOT EXISTS feedback_note TEXT;
ALTER TABLE public.gemma_messages ADD COLUMN IF NOT EXISTS feedback_at TIMESTAMPTZ;
ALTER TABLE public.gemma_messages ADD COLUMN IF NOT EXISTS topic TEXT;
ALTER TABLE public.gemma_messages ADD COLUMN IF NOT EXISTS actions JSONB;
ALTER TABLE public.gemma_messages ADD COLUMN IF NOT EXISTS sources JSONB;
ALTER TABLE public.gemma_messages ADD COLUMN IF NOT EXISTS wellbeing BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_gemma_messages_conversation ON public.gemma_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_gemma_messages_feedback ON public.gemma_messages(feedback) WHERE feedback IS NOT NULL;

-- Backfill: every member's existing history becomes one "Earlier chats"
-- conversation. Only touches messages with no conversation yet, so re-runs
-- are no-ops.
INSERT INTO public.gemma_conversations (email, title, created_at, updated_at)
SELECT gm.email, 'Earlier chats', min(gm.created_at), max(gm.created_at)
FROM public.gemma_messages gm
WHERE gm.conversation_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.gemma_conversations gc WHERE gc.email = gm.email AND gc.title = 'Earlier chats')
GROUP BY gm.email;

UPDATE public.gemma_messages gm
SET conversation_id = gc.id
FROM public.gemma_conversations gc
WHERE gm.conversation_id IS NULL AND gc.email = gm.email AND gc.title = 'Earlier chats';

ALTER TABLE public.gemma_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "members read own gemma conversations" ON public.gemma_conversations;
CREATE POLICY "members read own gemma conversations" ON public.gemma_conversations
  FOR SELECT TO authenticated
  USING (email = lower(auth.jwt() ->> 'email') AND archived_at IS NULL);
DROP POLICY IF EXISTS "admins read gemma conversations" ON public.gemma_conversations;
CREATE POLICY "admins read gemma conversations" ON public.gemma_conversations
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- Members archive (hide) their own conversations. Messages stay for the
-- safety model above.
CREATE OR REPLACE FUNCTION public.archive_my_gemma_conversation(p_conversation_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.gemma_conversations gc SET archived_at = now()
  WHERE gc.id = p_conversation_id AND gc.email = lower(auth.jwt() ->> 'email');
END;
$$;
GRANT EXECUTE ON FUNCTION public.archive_my_gemma_conversation(BIGINT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.archive_my_gemma_conversation(BIGINT) FROM PUBLIC, anon;

-- Thumbs up/down on one of Gemma's own replies to the caller. p_value 0
-- clears it.
CREATE OR REPLACE FUNCTION public.set_my_gemma_feedback(p_message_id BIGINT, p_value INTEGER, p_note TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_value NOT IN (-1, 0, 1) THEN
    RAISE EXCEPTION 'Feedback must be -1, 0 or 1.';
  END IF;
  UPDATE public.gemma_messages gm SET
    feedback = NULLIF(p_value, 0)::smallint,
    feedback_note = CASE WHEN p_value = -1 THEN left(NULLIF(trim(COALESCE(p_note, '')), ''), 1000) ELSE NULL END,
    feedback_at = CASE WHEN p_value = 0 THEN NULL ELSE now() END
  WHERE gm.id = p_message_id
    AND gm.role = 'assistant'
    AND gm.email = lower(auth.jwt() ->> 'email');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That message could not be rated.';
  END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.set_my_gemma_feedback(BIGINT, INTEGER, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.set_my_gemma_feedback(BIGINT, INTEGER, TEXT) FROM PUBLIC, anon;

-- =========================================================================
-- KNOWLEDGE BASE (admin-editable; read by the edge functions only)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.gemma_knowledge (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  body TEXT NOT NULL CHECK (length(body) <= 2000),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gemma_knowledge ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admins manage gemma knowledge" ON public.gemma_knowledge;
CREATE POLICY "admins manage gemma knowledge" ON public.gemma_knowledge
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- Seeded once; ON CONFLICT DO NOTHING so admin edits are never overwritten
-- by a re-run.
INSERT INTO public.gemma_knowledge (slug, title, body, sort_order, updated_by) VALUES
  ('mentoring', '1-on-1 mentoring', 'Members book sessions through the 1on1 Meetings tab. Mentors: Siya (Lead Mentor and Founder: cybersecurity strategy, career roadmaps, OSCP coaching, SOC, cloud security, DevSecOps, code reviews), Nonhlanhla (data security and AI), Nokulunga (digital forensics and DFIR), and Momelezi (red teaming and ethical hacking). Sessions overdue past 30 days get flagged for follow-up. The 1on1 Meetings tab also has CV review and interview prep requests.', 10, 'migration'),
  ('roadmap', 'My Roadmap', 'Each member has a coach-assigned track (SOC, Offensive Security, Cloud Security, DevSecOps, IAM, AI Security, GRC, Network Security) with four phases: Core Foundations, Specialization, Projects and Advanced. Specialization unlocks after enough Core Foundations items are done. Members tick items off and submit proof for projects; the coach owns the plan.', 20, 'migration'),
  ('hub-score', 'Hub Score', 'One number on the Dashboard that adds up certs passed, roadmap items, approved TryHackMe rooms, best login streak, tenure, study sessions, events attended and landing a job. It never resets. Tiers: Contributor (100), Regular (500), Veteran (2000), Legend (4000), each with a reward to claim: a cool drink and a high five, a Hacking Hub mousepad, a Hacking Hub top or hoodie, and a free cert up to R6000. Members can request a review if their score looks wrong. Labs do not count towards Hub Score.', 30, 'migration'),
  ('labs', 'Labs', 'The Labs tab has Hub Labs (scenario labs that run in the portal: a brief, an evidence pack and tasks; objective tasks are marked on submit and model answers unlock; written work gets a rubric review from the team) and curated labs (external labs; members submit a proof link). The first Hub Labs are GRC: Build a Risk Register, Breach or Not? (POPIA section 22) and a POPIA Gap Analysis. Gemma can give up to three hints per lab and explain marked answers after submission. She never has the answers.', 40, 'migration'),
  ('take-a-break', 'Take a Break', 'A Dashboard button that pauses check-in nudges, roadmap reminders, the login streak and the competition pace check for 3, 7 or 14 days. It resumes on its own; there is no early end.', 50, 'migration'),
  ('events', 'Events', 'HH Meetups, industry tech events and casual Sunday Catchups are listed in the Events tab. Members can also submit community events for approval.', 60, 'migration'),
  ('jobs', 'Job Board', 'Full-time, contract and internship roles from Hacking Hub''s employer network and placement partners, plus an application tracker.', 70, 'migration'),
  ('resources', 'Resources', 'Cert prep material, role roadmaps, podcasts, books, interview playbooks, CV templates and LinkedIn strategy. The AI CV and LinkedIn review (three a week) also lives here.', 80, 'migration'),
  ('certs', 'Cert Calendar', 'Community-wide target exam dates and cohorts, so members can see who is writing what and when. Members add their own exam dates.', 90, 'migration'),
  ('competitions', 'Competitions and study hours', 'A quarterly TryHackMe competition: members log up to 3 rooms a day (2 on weekends) with proof, and staff approve them. There is a weekly pace check. Study sessions can be logged with a timer and count towards a study leaderboard.', 100, 'migration'),
  ('billing', 'Membership and billing', 'Tiers include Basic Access, Monthly Operative, Permanent Access, Custom Plan and Maintenance Fee. Gemma does not quote prices or balances: billing questions go to an admin, and members can see their own subscription in My Subscription.', 110, 'migration'),
  ('reviews', 'Reviews', 'Members can leave feedback, criticism or recommendations, marked Public (visible community-wide) or Private (admin-only).', 120, 'migration')
ON CONFLICT (slug) DO NOTHING;

-- =========================================================================
-- PROGRESS SNAPSHOT (service role only, called by the edge functions)
-- =========================================================================

CREATE OR REPLACE FUNCTION public._gemma_member_snapshot(p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE
AS $$
DECLARE
  v_email TEXT := lower(p_email);
  v_today DATE := (now() AT TIME ZONE 'Africa/Johannesburg')::date;
  v_week_start DATE := date_trunc('week', (now() AT TIME ZONE 'Africa/Johannesburg'))::date;
  v_profile JSONB;
  v_roadmap JSONB;
  v_hub JSONB;
  v_certs JSONB;
  v_labs JSONB;
  v_study JSONB;
  v_rooms JSONB;
  v_quiz JSONB;
BEGIN
  SELECT jsonb_build_object(
    'first_name', split_part(COALESCE(NULLIF(trim(mp.full_name), ''), ''), ' ', 1),
    'track', mp.roadmap_track,
    'specialty', mp.specialty,
    'job_readiness', mp.job_readiness,
    'employment_status', mp.employment_status,
    'job_title', CASE WHEN mp.employment_status = 'Employed' THEN mp.job_title END,
    'membership_status', mp.status,
    'login_streak', COALESCE(mp.login_streak, 0),
    'longest_login_streak', COALESCE(mp.longest_login_streak, 0),
    'on_break_until', CASE WHEN mp.break_until >= v_today THEN mp.break_until END,
    'has_outstanding_balance', COALESCE(mp.money_owed, 0) > 0,
    'member_since', COALESCE(mp.manual_start_date, mp.onboarded_at::date)
  ) INTO v_profile
  FROM public.member_profiles mp WHERE mp.email = v_email;

  SELECT jsonb_build_object(
    'phases', COALESCE((
      SELECT jsonb_object_agg(p.phase, jsonb_build_object('done', p.done, 'total', p.total))
      FROM (SELECT ri.phase, count(*) FILTER (WHERE ri.completed) AS done, count(*) AS total
            FROM public.roadmap_items ri WHERE ri.member_email = v_email GROUP BY ri.phase) p
    ), '{}'::jsonb),
    'last_completed', (
      SELECT jsonb_build_object('title', ri.title, 'on', COALESCE(ri.completed_at, ri.updated_at)::date)
      FROM public.roadmap_items ri WHERE ri.member_email = v_email AND ri.completed
      ORDER BY COALESCE(ri.completed_at, ri.updated_at) DESC LIMIT 1
    ),
    'next_items', COALESCE((
      SELECT jsonb_agg(x.title) FROM (
        SELECT ri.title FROM public.roadmap_items ri
        WHERE ri.member_email = v_email AND NOT ri.completed
        ORDER BY CASE ri.phase WHEN 'Core Foundations' THEN 1 WHEN 'Specialization' THEN 2 WHEN 'Projects' THEN 3 ELSE 4 END, ri.sort_order, ri.id
        LIMIT 3) x
    ), '[]'::jsonb),
    'completed_last_7_days', (
      SELECT count(*) FROM public.roadmap_items ri
      WHERE ri.member_email = v_email AND ri.completed AND COALESCE(ri.completed_at, ri.updated_at) >= now() - interval '7 days'
    ),
    'days_since_last_touch', (
      SELECT (v_today - max(ri.updated_at)::date) FROM public.roadmap_items ri WHERE ri.member_email = v_email
    )
  ) INTO v_roadmap;

  SELECT jsonb_build_object(
    'total', b.total_points,
    'tier', public._hub_score_tier_name(b.total_points),
    'certs_passed', b.cert_count,
    'roadmap_items', b.roadmap_count,
    'rooms', b.room_count,
    'study_sessions', b.study_session_count,
    'events', b.event_count
  ) INTO v_hub
  FROM public._hub_score_breakdown(v_email) b
  LIMIT 1;

  SELECT jsonb_build_object(
    'next_exam', (
      SELECT jsonb_build_object('cert', cc.cert_name, 'date', cc.date, 'days_away', cc.date - v_today)
      FROM public.cert_calendar cc
      WHERE lower(cc.member_email) = v_email AND cc.result = 'Pending' AND cc.date >= v_today
      ORDER BY cc.date LIMIT 1
    ),
    'recent_results', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('cert', r.cert_name, 'result', r.result, 'date', r.date)) FROM (
        SELECT cc.cert_name, cc.result, cc.date FROM public.cert_calendar cc
        WHERE lower(cc.member_email) = v_email AND cc.result <> 'Pending'
        ORDER BY cc.date DESC LIMIT 3) r
    ), '[]'::jsonb)
  ) INTO v_certs;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('lab', l.title, 'status', la.status) ORDER BY la.updated_at DESC), '[]'::jsonb)
  INTO v_labs
  FROM public.lab_attempts la JOIN public.labs l ON l.id = la.lab_id
  WHERE la.member_email = v_email;

  SELECT jsonb_build_object(
    'minutes_this_week', COALESCE(sum(ss.planned_minutes) FILTER (WHERE (ss.logged_at AT TIME ZONE 'Africa/Johannesburg')::date >= v_week_start), 0),
    'sessions_this_week', count(*) FILTER (WHERE (ss.logged_at AT TIME ZONE 'Africa/Johannesburg')::date >= v_week_start),
    'last_session', max(ss.logged_at)::date
  ) INTO v_study
  FROM public.study_sessions ss WHERE ss.member_email = v_email;

  SELECT jsonb_build_object(
    'approved_rooms_last_7_days', COALESCE(sum(drl.room_count) FILTER (WHERE drl.status = 'Approved' AND drl.log_date >= v_today - 7), 0),
    'last_logged', max(drl.log_date)
  ) INTO v_rooms
  FROM public.daily_room_logs drl WHERE drl.member_email = v_email;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('topic', q.topic, 'score', q.score, 'total', q.total, 'on', q.created_at::date)), '[]'::jsonb)
  INTO v_quiz
  FROM (SELECT gq.topic, gq.score, gq.total, gq.created_at FROM public.gemma_quiz_results gq
        WHERE gq.email = v_email ORDER BY gq.created_at DESC LIMIT 3) q;

  RETURN jsonb_build_object(
    'today', v_today,
    'profile', v_profile,
    'roadmap', v_roadmap,
    'hub_score', v_hub,
    'certs', v_certs,
    'labs', v_labs,
    'study', v_study,
    'tryhackme', v_rooms,
    'recent_quizzes', v_quiz
  );
END;
$$;

-- =========================================================================
-- WEEKLY NOTES, LAB HELP, QUIZZES
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.gemma_weekly_notes (
  email TEXT NOT NULL,
  week_start DATE NOT NULL,
  headline TEXT NOT NULL,
  body TEXT NOT NULL,
  action TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  dismissed_at TIMESTAMPTZ,
  PRIMARY KEY (email, week_start)
);
ALTER TABLE public.gemma_weekly_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "members read own gemma notes" ON public.gemma_weekly_notes;
CREATE POLICY "members read own gemma notes" ON public.gemma_weekly_notes
  FOR SELECT TO authenticated USING (email = lower(auth.jwt() ->> 'email'));

CREATE OR REPLACE FUNCTION public.dismiss_my_gemma_note(p_week_start DATE)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.gemma_weekly_notes SET dismissed_at = now()
  WHERE email = lower(auth.jwt() ->> 'email') AND week_start = p_week_start;
$$;
GRANT EXECUTE ON FUNCTION public.dismiss_my_gemma_note(DATE) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.dismiss_my_gemma_note(DATE) FROM PUBLIC, anon;

CREATE TABLE IF NOT EXISTS public.gemma_lab_help (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  lab_slug TEXT NOT NULL,
  task_key TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('hint', 'explain')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gemma_lab_help_member ON public.gemma_lab_help(email, lab_slug);
ALTER TABLE public.gemma_lab_help ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "members read own gemma lab help" ON public.gemma_lab_help;
CREATE POLICY "members read own gemma lab help" ON public.gemma_lab_help
  FOR SELECT TO authenticated USING (email = lower(auth.jwt() ->> 'email'));
DROP POLICY IF EXISTS "admins read gemma lab help" ON public.gemma_lab_help;
CREATE POLICY "admins read gemma lab help" ON public.gemma_lab_help
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.gemma_quiz_results (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  topic TEXT NOT NULL,
  score INTEGER NOT NULL,
  total INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (total BETWEEN 1 AND 20 AND score BETWEEN 0 AND total)
);
CREATE INDEX IF NOT EXISTS idx_gemma_quiz_results_member ON public.gemma_quiz_results(email, created_at DESC);
ALTER TABLE public.gemma_quiz_results ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "members read own gemma quizzes" ON public.gemma_quiz_results;
CREATE POLICY "members read own gemma quizzes" ON public.gemma_quiz_results
  FOR SELECT TO authenticated USING (email = lower(auth.jwt() ->> 'email'));

-- Self-practice only: nothing reads these scores for points or rankings,
-- so a self-reported score is fine.
CREATE OR REPLACE FUNCTION public.record_my_gemma_quiz(p_topic TEXT, p_score INTEGER, p_total INTEGER)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
BEGIN
  IF v_email IS NULL THEN RAISE EXCEPTION 'Sign in first.'; END IF;
  INSERT INTO public.gemma_quiz_results (email, topic, score, total)
  VALUES (v_email, left(COALESCE(NULLIF(trim(p_topic), ''), 'General'), 120), p_score, p_total);
END;
$$;
GRANT EXECUTE ON FUNCTION public.record_my_gemma_quiz(TEXT, INTEGER, INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.record_my_gemma_quiz(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon;

-- =========================================================================
-- HAND-OFFS ("talk to a person")
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.gemma_handoffs (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  conversation_id BIGINT REFERENCES public.gemma_conversations(id) ON DELETE SET NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Handled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  handled_by TEXT,
  handled_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_gemma_handoffs_status ON public.gemma_handoffs(status, created_at DESC);
ALTER TABLE public.gemma_handoffs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "members read own gemma handoffs" ON public.gemma_handoffs;
CREATE POLICY "members read own gemma handoffs" ON public.gemma_handoffs
  FOR SELECT TO authenticated USING (email = lower(auth.jwt() ->> 'email'));
DROP POLICY IF EXISTS "staff read gemma handoffs" ON public.gemma_handoffs;
CREATE POLICY "staff read gemma handoffs" ON public.gemma_handoffs
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()) OR public.is_community_manager(auth.uid()));

-- Member asks for a person: records the hand-off and puts them on the
-- Accountability Check-ins list (as a manual entry, so the new-joiner sync
-- never removes it). Deliberately does NOT write an accountability check-in
-- row - that would mark them as recently checked on and hide them from "due".
CREATE OR REPLACE FUNCTION public.request_gemma_handoff(p_conversation_id BIGINT, p_note TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
BEGIN
  IF v_email IS NULL THEN RAISE EXCEPTION 'Sign in first.'; END IF;
  IF p_conversation_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.gemma_conversations gc WHERE gc.id = p_conversation_id AND gc.email = v_email
  ) THEN
    RAISE EXCEPTION 'That conversation was not found.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.gemma_handoffs gh WHERE gh.email = v_email AND gh.status = 'Open') THEN
    RAISE EXCEPTION 'You already asked for a person. Someone from the team will be in touch soon.';
  END IF;

  INSERT INTO public.gemma_handoffs (email, conversation_id, note)
  VALUES (v_email, p_conversation_id, left(NULLIF(trim(COALESCE(p_note, '')), ''), 1000));

  INSERT INTO public.accountability_list (member_email, added_by, source)
  VALUES (v_email, 'Gemma: member asked for a person', 'manual')
  ON CONFLICT (member_email) DO UPDATE SET
    source = 'manual',
    added_by = CASE WHEN public.accountability_list.source = 'new_joiner'
                    THEN 'Gemma: member asked for a person' ELSE public.accountability_list.added_by END;
END;
$$;
GRANT EXECUTE ON FUNCTION public.request_gemma_handoff(BIGINT, TEXT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.request_gemma_handoff(BIGINT, TEXT) FROM PUBLIC, anon;

CREATE OR REPLACE FUNCTION public.mark_gemma_handoff_handled(p_handoff_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_community_manager(auth.uid())) THEN
    RAISE EXCEPTION 'Only admins and community managers can do this.';
  END IF;
  UPDATE public.gemma_handoffs SET status = 'Handled', handled_by = lower(auth.jwt() ->> 'email'), handled_at = now()
  WHERE id = p_handoff_id AND status = 'Open';
END;
$$;
GRANT EXECUTE ON FUNCTION public.mark_gemma_handoff_handled(BIGINT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_gemma_handoff_handled(BIGINT) FROM PUBLIC, anon;

-- Open hand-offs with member names, for admins and community managers
-- (community managers can't read member_profiles directly).
CREATE OR REPLACE FUNCTION public.get_open_gemma_handoffs()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE
AS $$
BEGIN
  IF NOT (public.is_admin(auth.uid()) OR public.is_community_manager(auth.uid())) THEN
    RAISE EXCEPTION 'Only admins and community managers can view this.';
  END IF;
  RETURN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', gh.id, 'email', gh.email, 'full_name', mp.full_name, 'note', gh.note, 'created_at', gh.created_at
    ) ORDER BY gh.created_at), '[]'::jsonb)
    FROM public.gemma_handoffs gh
    LEFT JOIN public.member_profiles mp ON mp.email = gh.email
    WHERE gh.status = 'Open'
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_open_gemma_handoffs() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_open_gemma_handoffs() FROM PUBLIC, anon;

-- =========================================================================
-- ADMIN: stats + review queue (aggregates and member-flagged items only)
-- =========================================================================

CREATE OR REPLACE FUNCTION public.get_gemma_admin_overview(p_days INTEGER DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE
AS $$
DECLARE
  v_since TIMESTAMPTZ := now() - make_interval(days => GREATEST(1, LEAST(p_days, 365)));
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can view this.';
  END IF;
  RETURN jsonb_build_object(
    'messages', (SELECT count(*) FROM public.gemma_messages WHERE role = 'user' AND created_at >= v_since),
    'members', (SELECT count(DISTINCT email) FROM public.gemma_messages WHERE role = 'user' AND created_at >= v_since),
    'thumbs_up', (SELECT count(*) FROM public.gemma_messages WHERE feedback = 1 AND created_at >= v_since),
    'thumbs_down', (SELECT count(*) FROM public.gemma_messages WHERE feedback = -1 AND created_at >= v_since),
    'hints', (SELECT count(*) FROM public.gemma_lab_help WHERE kind = 'hint' AND created_at >= v_since),
    'explains', (SELECT count(*) FROM public.gemma_lab_help WHERE kind = 'explain' AND created_at >= v_since),
    'quizzes', (SELECT count(*) FROM public.gemma_quiz_results WHERE created_at >= v_since),
    'weekly_notes', (SELECT count(*) FROM public.gemma_weekly_notes WHERE created_at >= v_since),
    'open_handoffs', (SELECT count(*) FROM public.gemma_handoffs WHERE status = 'Open'),
    'per_day', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('day', d.day, 'count', d.n) ORDER BY d.day) FROM (
        SELECT (created_at AT TIME ZONE 'Africa/Johannesburg')::date AS day, count(*) AS n
        FROM public.gemma_messages WHERE role = 'user' AND created_at >= v_since GROUP BY 1) d
    ), '[]'::jsonb),
    'topics', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('topic', t.topic, 'count', t.n) ORDER BY t.n DESC) FROM (
        SELECT topic, count(*) AS n FROM public.gemma_messages
        WHERE role = 'assistant' AND topic IS NOT NULL AND created_at >= v_since GROUP BY topic) t
    ), '[]'::jsonb)
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_gemma_admin_overview(INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_gemma_admin_overview(INTEGER) FROM PUBLIC, anon;

-- Rated-down replies only, each with the member message it answered.
CREATE OR REPLACE FUNCTION public.get_gemma_rated_down(p_limit INTEGER DEFAULT 50)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can view this.';
  END IF;
  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(x)::jsonb ORDER BY x.feedback_at DESC), '[]'::jsonb) FROM (
      SELECT a.id, a.email, mp.full_name, a.content AS reply, a.feedback_note, a.feedback_at, a.topic,
        (SELECT u.content FROM public.gemma_messages u
         WHERE u.conversation_id = a.conversation_id AND u.role = 'user' AND u.created_at <= a.created_at
         ORDER BY u.created_at DESC, u.id DESC LIMIT 1) AS question
      FROM public.gemma_messages a
      LEFT JOIN public.member_profiles mp ON mp.email = a.email
      WHERE a.feedback = -1
      ORDER BY a.feedback_at DESC
      LIMIT GREATEST(1, LEAST(p_limit, 200))
    ) x
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_gemma_rated_down(INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_gemma_rated_down(INTEGER) FROM PUBLIC, anon;

-- The conversation a member sent to a person - only readable through an
-- open or handled hand-off that names it.
CREATE OR REPLACE FUNCTION public.get_gemma_handoff_conversation(p_handoff_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE
AS $$
DECLARE
  v_conversation_id BIGINT;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Only admins can view this.';
  END IF;
  SELECT gh.conversation_id INTO v_conversation_id FROM public.gemma_handoffs gh WHERE gh.id = p_handoff_id;
  IF v_conversation_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;
  RETURN (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('role', m.role, 'content', m.content, 'created_at', m.created_at) ORDER BY m.created_at, m.id), '[]'::jsonb)
    FROM (SELECT * FROM public.gemma_messages WHERE conversation_id = v_conversation_id ORDER BY created_at DESC, id DESC LIMIT 30) m
  );
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_gemma_handoff_conversation(BIGINT) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_gemma_handoff_conversation(BIGINT) FROM PUBLIC, anon;

-- Snapshot is for the edge functions' service-role client only.
REVOKE EXECUTE ON FUNCTION public._gemma_member_snapshot(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._gemma_member_snapshot(TEXT) TO service_role;
