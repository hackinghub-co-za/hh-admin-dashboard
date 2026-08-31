-- Hacking Hub Admin Dashboard - Study Quiz System
-- Run this in the Supabase SQL Editor after 002-053 have already been
-- applied. Safe to re-run: every statement is idempotent (question seed
-- rows use a stable natural key so re-running doesn't duplicate them).
--
-- Exam Readiness (051_exam_readiness.sql) already tracks a per-cert prep
-- checklist plus a *self-reported* practice score - the member takes a
-- practice test somewhere else (ExamCompass, PocketPrep - see
-- SecurityPlusGuideModal.jsx) and types the result in by hand. This adds a
-- real, first-party quiz engine so that step becomes automatic instead of
-- an honor-system manual entry, without touching exam_readiness itself -
-- submit_quiz_attempt() below just calls the existing
-- log_my_practice_test_score() RPC internally.
--
-- Keyed by cert_name using the exact same free-text values as
-- EXAM_READINESS_CATALOGS (src/lib/memberOptions.js) - 'Security+',
-- 'CySA+', etc. - so a finished attempt maps straight onto the readiness
-- percentage already shown on the Cert Calendar tab, no separate mapping
-- table needed.
--
-- Questions are original content, written for this migration - not
-- reproduced from CompTIA's official material or scraped from the
-- third-party sites SecurityPlusGuideModal.jsx already links to. Seeded
-- with 30 Security+ (SY0-701) questions across the five real exam
-- objective domains, since Security+ is the one cert with full in-app
-- guide content today (same reasoning EXAM_READINESS_CATALOGS itself
-- documents for why Security+ got real milestones first). Other certs
-- get their own question banks the same way, once written.

-- =========================================================================
-- SCHEMA
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id BIGSERIAL PRIMARY KEY,
  cert_name TEXT NOT NULL,
  domain TEXT NOT NULL,                  -- the exam objective domain this question covers
  question TEXT NOT NULL,
  choices JSONB NOT NULL,                -- ["choice A", "choice B", "choice C", "choice D"]
  correct_index INTEGER NOT NULL CHECK (correct_index >= 0),
  explanation TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Published' CHECK (status IN ('Draft', 'Published')),
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  -- Natural key for idempotent seeding below - two questions for the same
  -- cert are never allowed to collide on their own question text.
  UNIQUE (cert_name, question)
);

CREATE INDEX IF NOT EXISTS idx_quiz_questions_cert_status ON public.quiz_questions(cert_name, status);

ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;

-- Members read only Published rows - same "Approved-only" shape as
-- community_events (019_events.sql). correct_index/explanation are
-- included in what members can read (unlike, say, an exam-integrity-
-- critical system) since Study Mode shows the explanation immediately
-- and this is practice content, not a proctored exam - the real gate is
-- Exam Mode's client-side "don't reveal until submitted" UX, not RLS.
DROP POLICY IF EXISTS "members read published quiz questions" ON public.quiz_questions;
CREATE POLICY "members read published quiz questions"
  ON public.quiz_questions FOR SELECT
  TO authenticated
  USING (
    status = 'Published'
    AND public.is_member_allowed(auth.jwt() ->> 'email')
  );

DROP POLICY IF EXISTS "admins manage quiz questions" ON public.quiz_questions;
CREATE POLICY "admins manage quiz questions"
  ON public.quiz_questions FOR ALL
  USING (public.is_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id BIGSERIAL PRIMARY KEY,
  member_email TEXT NOT NULL,
  cert_name TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('study', 'exam')),
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  question_count INTEGER NOT NULL,
  correct_count INTEGER NOT NULL,
  answers JSONB NOT NULL,                -- [{questionId, chosenIndex, correct}]
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_member ON public.quiz_attempts(member_email, completed_at);

ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Self-owned, same shape as exam_readiness itself - a member manages only
-- their own attempt history.
DROP POLICY IF EXISTS "members manage own quiz attempts" ON public.quiz_attempts;
CREATE POLICY "members manage own quiz attempts"
  ON public.quiz_attempts FOR ALL
  USING (member_email = lower(auth.jwt() ->> 'email'))
  WITH CHECK (member_email = lower(auth.jwt() ->> 'email'));

DROP POLICY IF EXISTS "admins manage quiz attempts" ON public.quiz_attempts;
CREATE POLICY "admins manage quiz attempts"
  ON public.quiz_attempts FOR ALL
  USING (public.is_admin(auth.uid()));

-- =========================================================================
-- RPCs
-- =========================================================================

-- Returns a random subset of Published questions for a cert, choices
-- pre-shuffled server-side (so the correct answer isn't always index 0 in
-- the seed data) with correct_index remapped to match. p_limit caps how
-- many the client asked for; fewer are returned if the bank is smaller.
-- SECURITY DEFINER only to run the shuffle in SQL - RLS above already
-- allows any approved member to read Published rows directly, so this
-- adds no new access, just convenience + the shuffle.
CREATE OR REPLACE FUNCTION public.get_quiz_questions(p_cert_name TEXT, p_limit INTEGER DEFAULT 20)
RETURNS TABLE (
  id BIGINT,
  domain TEXT,
  question TEXT,
  choices JSONB,
  correct_index INTEGER,
  explanation TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_member_allowed(auth.jwt() ->> 'email') THEN
    RAISE EXCEPTION 'Only members can do this.';
  END IF;

  RETURN QUERY
  WITH picked AS (
    SELECT qq.id, qq.domain, qq.question, qq.choices, qq.correct_index, qq.explanation
    FROM public.quiz_questions qq
    WHERE qq.cert_name = p_cert_name AND qq.status = 'Published'
    ORDER BY random()
    LIMIT p_limit
  ),
  -- ord.ord_num is 1-based (WITH ORDINALITY), so ord.ord_num - 1 is this
  -- choice's index in the *original* (unshuffled) choices array - compared
  -- directly against picked.correct_index below, which was stored 0-based.
  shuffled AS (
    SELECT
      picked.id,
      picked.domain,
      picked.question,
      picked.explanation,
      picked.correct_index AS orig_correct_index,
      ord.choice_text,
      (ord.ord_num - 1) AS orig_idx,
      row_number() OVER (PARTITION BY picked.id ORDER BY random()) - 1 AS new_idx
    FROM picked
    CROSS JOIN LATERAL jsonb_array_elements_text(picked.choices) WITH ORDINALITY AS ord(choice_text, ord_num)
  )
  SELECT
    s.id,
    s.domain,
    s.question,
    jsonb_agg(s.choice_text ORDER BY s.new_idx) AS choices,
    MIN(CASE WHEN s.orig_idx = s.orig_correct_index THEN s.new_idx END)::INTEGER AS correct_index,
    s.explanation
  FROM shuffled s
  GROUP BY s.id, s.domain, s.question, s.explanation;
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_quiz_questions(TEXT, INTEGER) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_quiz_questions(TEXT, INTEGER) FROM PUBLIC, anon;

-- Grades server-side (never trust a client-computed score - same
-- principle as grant_member_portal_access never trusting a client-sent
-- name), records the attempt, and - the actual point of this whole
-- migration - calls the existing log_my_practice_test_score() so
-- Exam Readiness's blended percentage updates automatically. p_answers
-- shape: [{"questionId": 1, "chosenIndex": 2}, ...].
CREATE OR REPLACE FUNCTION public.submit_quiz_attempt(
  p_cert_name TEXT,
  p_mode TEXT,
  p_started_at TIMESTAMP WITH TIME ZONE,
  p_answers JSONB
)
RETURNS TABLE (score INTEGER, correct_count INTEGER, question_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email TEXT := lower(auth.jwt() ->> 'email');
  v_graded JSONB;
  v_correct_count INTEGER;
  v_question_count INTEGER;
  v_score INTEGER;
BEGIN
  IF NOT public.is_member_allowed(v_email) THEN
    RAISE EXCEPTION 'Only members can do this.';
  END IF;
  IF p_mode NOT IN ('study', 'exam') THEN
    RAISE EXCEPTION 'Invalid quiz mode.';
  END IF;

  SELECT
    jsonb_agg(jsonb_build_object(
      'questionId', (a->>'questionId')::BIGINT,
      'chosenIndex', (a->>'chosenIndex')::INTEGER,
      'correct', qq.correct_index = (a->>'chosenIndex')::INTEGER
    )),
    COUNT(*) FILTER (WHERE qq.correct_index = (a->>'chosenIndex')::INTEGER),
    COUNT(*)
  INTO v_graded, v_correct_count, v_question_count
  FROM jsonb_array_elements(p_answers) a
  JOIN public.quiz_questions qq ON qq.id = (a->>'questionId')::BIGINT AND qq.status = 'Published';

  IF v_question_count IS NULL OR v_question_count = 0 THEN
    RAISE EXCEPTION 'No valid answers submitted.';
  END IF;

  v_score := ROUND((v_correct_count::NUMERIC / v_question_count) * 100);

  INSERT INTO public.quiz_attempts (member_email, cert_name, mode, score, question_count, correct_count, answers, started_at)
  VALUES (v_email, p_cert_name, p_mode, v_score, v_question_count, v_correct_count, v_graded, p_started_at);

  -- The integration point: a finished quiz IS a practice test, so it logs
  -- itself the same way a self-reported ExamCompass score would have.
  PERFORM public.log_my_practice_test_score(p_cert_name, v_score);

  RETURN QUERY SELECT v_score, v_correct_count, v_question_count;
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_quiz_attempt(TEXT, TEXT, TIMESTAMP WITH TIME ZONE, JSONB) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.submit_quiz_attempt(TEXT, TEXT, TIMESTAMP WITH TIME ZONE, JSONB) FROM PUBLIC, anon;

-- =========================================================================
-- SEED DATA - 30 original Security+ (SY0-701) questions across the five
-- real exam objective domains. ON CONFLICT on the (cert_name, question)
-- natural key makes this safe to re-run.
-- =========================================================================

INSERT INTO public.quiz_questions (cert_name, domain, question, choices, correct_index, explanation) VALUES

-- Domain 1: General Security Concepts
('Security+', 'General Security Concepts', 'Which three properties make up the CIA triad in information security?', '["Confidentiality, Integrity, Availability", "Confidentiality, Identity, Authorization", "Control, Integrity, Auditing", "Confidentiality, Investigation, Accountability"]', 0, 'The CIA triad - Confidentiality, Integrity, and Availability - is the foundational model for describing what security controls are meant to protect.'),
('Security+', 'General Security Concepts', 'In the AAA security framework, what does the second "A" (Authorization) determine?', '["Who a user claims to be", "What an authenticated user is allowed to do", "A record of what a user did", "How strong a user''s password is"]', 1, 'Authentication verifies identity, Authorization determines what that verified identity is permitted to access or do, and Accounting logs what actually happened.'),
('Security+', 'General Security Concepts', 'Which type of encryption uses the same key for both encryption and decryption?', '["Asymmetric encryption", "Symmetric encryption", "Hashing", "Digital signing"]', 1, 'Symmetric encryption (e.g. AES) uses one shared key for both operations, which makes it fast but requires securely distributing that key. Asymmetric encryption uses a public/private key pair instead.'),
('Security+', 'General Security Concepts', 'A security camera that is visible to deter someone from attempting a break-in is an example of which control type?', '["Detective control", "Corrective control", "Deterrent control", "Compensating control"]', 2, 'A deterrent control discourages an attack before it happens. A detective control (like the same camera''s recording) identifies an event after the fact; a corrective control fixes the impact afterward.'),
('Security+', 'General Security Concepts', 'What is the core principle behind a Zero Trust security model?', '["Trust every device once it is inside the corporate network", "Never trust, always verify - authenticate and authorize every request regardless of origin", "Trust is granted permanently after the first successful login", "Only external traffic needs to be verified"]', 1, 'Zero Trust assumes no implicit trust based on network location - every request is verified and authorized on its own merits, whether it originates inside or outside the perimeter.'),
('Security+', 'General Security Concepts', 'Why is a formal change management process important from a security perspective?', '["It speeds up deployments by skipping testing", "It ensures changes are reviewed, approved, and documented so unintended security impacts are caught before they cause harm", "It is only relevant to software licensing", "It replaces the need for a backup policy"]', 1, 'Uncontrolled changes are a common cause of outages and security gaps. A change management process adds review and approval steps so risks are assessed before a change goes live.'),

-- Domain 2: Threats, Vulnerabilities, and Mitigations
('Security+', 'Threats, Vulnerabilities, and Mitigations', 'What distinguishes spear phishing from generic phishing?', '["Spear phishing only happens over SMS", "Spear phishing is a broad, untargeted attack sent to thousands of random addresses", "Spear phishing is a targeted attack, personalized using research on a specific individual or organization", "Spear phishing never uses email"]', 2, 'Spear phishing is targeted - the attacker researches the victim (name, role, colleagues) to make the message far more convincing than a generic phishing blast.'),
('Security+', 'Threats, Vulnerabilities, and Mitigations', 'A SQL injection attack primarily exploits what kind of weakness?', '["Weak Wi-Fi encryption", "Improperly sanitized user input passed into a database query", "An expired TLS certificate", "A misconfigured DNS record"]', 1, 'SQL injection occurs when user-supplied input is inserted into a database query without proper validation or parameterization, letting an attacker alter the query''s logic.'),
('Security+', 'Threats, Vulnerabilities, and Mitigations', 'What is a key characteristic that distinguishes a DDoS attack from a standard DoS attack?', '["A DDoS attack always targets a database directly", "A DDoS attack originates from multiple distributed sources at once, rather than a single source", "A DDoS attack is always encrypted", "A DDoS attack requires physical access to the target"]', 1, '"Distributed" is the key word - a DDoS attack uses many compromised systems (often a botnet) simultaneously, making it harder to block by simply filtering one source IP.'),
('Security+', 'Threats, Vulnerabilities, and Mitigations', 'In a man-in-the-middle (MITM) attack, what does the attacker do?', '["Overwhelms a server with traffic until it becomes unavailable", "Secretly intercepts and potentially alters communication between two parties who believe they are communicating directly", "Guesses a password using every possible combination", "Physically damages network hardware"]', 1, 'A MITM attacker positions themselves between two communicating parties, able to eavesdrop on or manipulate the traffic without either party realizing it.'),
('Security+', 'Threats, Vulnerabilities, and Mitigations', 'What defines a zero-day vulnerability?', '["A vulnerability that has been publicly known for zero days because it was patched immediately", "A flaw that is exploited before the vendor has released a patch or, in many cases, before they are even aware of it", "Any vulnerability found in software older than zero years", "A vulnerability that only affects zero-trust networks"]', 1, 'A zero-day is a vulnerability being actively exploited (or exploitable) before the vendor has had zero days to produce and distribute a fix - defenders have no patch available yet.'),
('Security+', 'Threats, Vulnerabilities, and Mitigations', 'An attacker calls an employee pretending to be from IT support, inventing a plausible story to get them to reveal their password. This social engineering technique is called:', '["Tailgating", "Pretexting", "Dumpster diving", "Typosquatting"]', 1, 'Pretexting is the use of a fabricated scenario (a "pretext") to manipulate a victim into divulging information or performing an action they normally wouldn''t.'),

-- Domain 3: Security Architecture
('Security+', 'Security Architecture', 'What is the primary security benefit of network segmentation?', '["It increases available bandwidth for all users", "It limits how far an attacker can move laterally if one segment is compromised", "It eliminates the need for firewalls", "It automatically encrypts all traffic on the network"]', 1, 'Segmentation divides a network into isolated zones, so a breach in one segment (e.g. guest Wi-Fi) doesn''t automatically grant access to more sensitive segments (e.g. finance servers).'),
('Security+', 'Security Architecture', 'What is the main purpose of a DMZ (demilitarized zone) in network architecture?', '["To store encryption keys", "To host publicly accessible services in an isolated zone, shielding the internal network if one of those services is compromised", "To provide a backup power source", "To physically separate employees by department"]', 1, 'A DMZ sits between the internal network and the internet, hosting public-facing services (like a web server) so that if one is compromised, the attacker still isn''t directly on the internal network.'),
('Security+', 'Security Architecture', 'What does a VPN (Virtual Private Network) primarily provide?', '["Faster internet speeds", "An encrypted tunnel for traffic across an untrusted network, protecting confidentiality and often masking the origin", "Automatic malware removal", "Unlimited cloud storage"]', 1, 'A VPN encrypts traffic between the client and a VPN endpoint, protecting data in transit across networks (like public Wi-Fi) that can''t otherwise be trusted.'),
('Security+', 'Security Architecture', 'What is the key difference between a stateful and a stateless firewall?', '["A stateful firewall tracks the context of active connections; a stateless firewall evaluates each packet in isolation against static rules", "A stateless firewall is always faster and more secure", "A stateful firewall cannot filter by port number", "There is no meaningful difference"]', 0, 'A stateful firewall keeps track of ongoing connections and can make decisions based on that context (e.g. only allowing return traffic for a connection it initiated), while a stateless firewall just checks each packet against fixed rules.'),
('Security+', 'Security Architecture', 'Under the cloud shared responsibility model for an IaaS (Infrastructure as a Service) deployment, who is typically responsible for securing the guest operating system and applications running on it?', '["Exclusively the cloud provider", "Exclusively a third-party auditor", "The customer - the provider secures the underlying physical infrastructure, while the customer secures what they build on top of it", "No one - IaaS platforms are self-securing"]', 2, 'In IaaS, the provider secures the physical infrastructure, hypervisor, and network, while the customer is responsible for the guest OS, patching, applications, and data they put on top of it.'),
('Security+', 'Security Architecture', 'What does microsegmentation add on top of traditional network segmentation in a Zero Trust architecture?', '["It merges all network segments into one flat network for simplicity", "It applies granular, often workload- or application-level access controls within a segment, not just between segments", "It removes the need for authentication between segments", "It only applies to wireless networks"]', 1, 'Microsegmentation pushes segmentation down to a much finer granularity - individual workloads or applications - so that even systems within the same broad segment must still authenticate and be authorized to talk to each other.'),

-- Domain 4: Security Operations
('Security+', 'Security Operations', 'What is the correct general order of the incident response process?', '["Containment, Preparation, Eradication, Identification, Recovery, Lessons Learned", "Preparation, Identification, Containment, Eradication, Recovery, Lessons Learned", "Identification, Recovery, Preparation, Containment, Eradication, Lessons Learned", "Lessons Learned, Preparation, Identification, Containment, Eradication, Recovery"]', 1, 'The standard order is Preparation (before an incident occurs), Identification, Containment, Eradication, Recovery, then Lessons Learned - each phase builds on the last.'),
('Security+', 'Security Operations', 'What is the main purpose of a SIEM (Security Information and Event Management) system?', '["To physically secure server rooms", "To aggregate, correlate, and analyze log data from across an environment to detect and alert on security events", "To manage employee payroll", "To replace the need for antivirus software"]', 1, 'A SIEM centralizes logs from many sources (firewalls, servers, endpoints) and correlates them, making it possible to spot patterns and generate alerts that would be invisible looking at any single log alone.'),
('Security+', 'Security Operations', 'Why is a consistent patch management process critical to security operations?', '["It guarantees zero downtime forever", "Unpatched software is one of the most common ways attackers exploit known, already-fixed vulnerabilities", "It is only required for mobile devices", "It eliminates the need for a firewall"]', 1, 'Many breaches exploit vulnerabilities that already have an available patch - timely, consistent patching closes that window of exposure.'),
('Security+', 'Security Operations', 'What is the key difference between a vulnerability scan and a penetration test?', '["A vulnerability scan actively exploits weaknesses to prove impact, while a penetration test only lists them", "A vulnerability scan identifies and lists potential weaknesses, while a penetration test actively attempts to exploit them to demonstrate real-world impact", "They are two names for the exact same activity", "A penetration test can only be run by automated software with no human involvement"]', 1, 'A vulnerability scan is largely automated and produces a list of potential issues; a penetration test goes further, actively trying to exploit those (and other) weaknesses to show what a real attacker could actually achieve.'),
('Security+', 'Security Operations', 'What does the principle of least privilege mean?', '["Every user should have administrator access by default for convenience", "A user or process should only be granted the minimum access necessary to perform its function, and nothing more", "Only the IT department needs any access controls", "Privileges should never be reviewed once granted"]', 1, 'Least privilege limits the potential damage from a compromised account or process by ensuring it never has more access than it strictly needs to do its job.'),
('Security+', 'Security Operations', 'Multi-factor authentication (MFA) commonly combines factors from which categories?', '["Something you know, something you have, something you are", "Something you own, something you rent, something you borrow", "Your name, your address, your phone number", "Two passwords used together"]', 0, 'MFA strengthens authentication by requiring at least two independent factor categories: knowledge (a password), possession (a phone/token), and inherence (a fingerprint or other biometric).'),

-- Domain 5: Security Program Management and Oversight
('Security+', 'Security Program Management and Oversight', 'In risk management, what does "risk transference" mean?', '["Ignoring the risk entirely", "Shifting the financial impact of a risk to a third party, such as through a cyber insurance policy", "Eliminating the activity that creates the risk", "Reducing the risk''s likelihood through technical controls"]', 1, 'Risk transference shifts the financial or operational burden of a risk elsewhere - most commonly through insurance or outsourcing - without necessarily reducing the risk''s likelihood or impact itself.'),
('Security+', 'Security Program Management and Oversight', 'Why does an organization classify its data (e.g. Public, Internal, Confidential, Restricted)?', '["To make files easier to search alphabetically", "So that appropriate handling and protection controls can be applied based on how sensitive the data actually is", "Data classification is only a legal formality with no security purpose", "To determine which employees get paid more"]', 1, 'Not all data warrants the same level of protection - classification lets an organization apply proportionate controls (encryption, access restrictions, retention rules) based on actual sensitivity.'),
('Security+', 'Security Program Management and Oversight', 'What is the key difference between a Business Continuity Plan (BCP) and a Disaster Recovery Plan (DRP)?', '["They are identical documents with different names", "A BCP focuses on keeping critical business operations running during a disruption, while a DRP focuses specifically on restoring IT systems and data afterward", "A DRP is only for natural disasters, never cyberattacks", "A BCP only applies to the finance department"]', 1, 'A BCP is the broader plan for keeping the business operating through a disruption of any kind; a DRP is the narrower, IT-focused plan for restoring systems, applications, and data after an incident.'),
('Security+', 'Security Program Management and Oversight', 'What is the primary goal of ongoing security awareness training for employees?', '["To satisfy a one-time legal requirement and never be revisited", "To reduce human error - phishing susceptibility, weak passwords, mishandled data - since people are frequently the weakest link in a security program", "To replace the need for technical controls entirely", "To train only the IT and security teams"]', 1, 'Technical controls alone can''t stop every attack - a well-crafted phishing email or a careless mistake can bypass them. Ongoing training reduces the human-error risk that technology alone can''t close.'),
('Security+', 'Security Program Management and Oversight', 'What does Recovery Time Objective (RTO) measure, as distinct from Recovery Point Objective (RPO)?', '["RTO measures how much data loss is acceptable; RPO measures how long recovery is allowed to take", "RTO measures the maximum acceptable time to restore a system after a disruption; RPO measures the maximum acceptable amount of data loss, measured in time since the last backup", "RTO and RPO measure the exact same thing", "Neither RTO nor RPO relates to disaster recovery"]', 1, 'RTO is about downtime tolerance - how long can the system be unavailable? RPO is about data-loss tolerance - how much time''s worth of data can be lost, based on backup frequency?'),
('Security+', 'Security Program Management and Oversight', 'What is the general purpose of a data protection regulation such as South Africa''s POPIA or the EU''s GDPR?', '["To ban all collection of personal data outright", "To set legal requirements for how organizations must collect, process, protect, and handle individuals'' personal information", "To regulate only government agencies, never private companies", "To replace the need for any internal security controls"]', 1, 'Regulations like POPIA and GDPR establish legal obligations for how personal data is collected, used, secured, and disclosed - with real penalties for organizations that mishandle it, not just a best-practice suggestion.')

ON CONFLICT (cert_name, question) DO NOTHING;
