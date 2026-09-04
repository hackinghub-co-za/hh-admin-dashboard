// Hacking Hub Admin Dashboard - Gemma AI Interview Prep Edge Function
//
// Deploy with: supabase functions deploy gemma-interview-prep
// Reuses the same GEMINI_API_KEY secret gemma-chat/gemma-review already
// require - no separate secret needed.
//
// Same server-side-only reasoning as gemma-chat/gemma-review: the Gemini
// API key can never live in the client bundle. The member's CV text is
// read into memory just long enough to build the prompt, then discarded -
// only the generated questions (plus the job description, which is public
// posting text, not personal data) are written to the DB. See
// 056_interview_prep.sql for the full reasoning on what is/isn't stored.
//
// Optionally takes `domain` (the specialty the member is interviewing FOR
// - member_interviews.interview_domain, supabase/058_member_interviews.sql)
// so generated questions lean toward that domain rather than just the
// member's own profile specialty, which might not match what they're
// actually interviewing for right now. Falls back to profile specialty (or
// pure JD/CV inference) if omitted or not one of VALID_DOMAINS below.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_INPUT_LENGTH = 8000; // same headroom as gemma-review, per field
const WEEKLY_SESSION_CAP = 3; // own budget, separate from gemma-review's cv_reviews cap
const GEMINI_MODEL = 'gemini-3.6-flash'; // same pin as gemma-chat/gemma-review

// Same 7 domains as ROADMAP_TRACKS (memberOptions.js, minus 'Not
// Assigned') and DOMAIN_CONTENT (linkedInPlaybookData.js) - whitelisted
// here since `domain` comes straight from the client and gets embedded
// into the system prompt below; never trust free-form client text into a
// prompt without validating it against a known set first.
const VALID_DOMAINS = ['SOC', 'Offensive Security', 'Cloud Security', 'DevSecOps', 'IAM', 'AI Security', 'GRC'];

const QUESTIONS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    questions: {
      type: 'ARRAY',
      minItems: 6,
      maxItems: 10,
      items: {
        type: 'OBJECT',
        properties: {
          question: { type: 'STRING', description: 'The interview question itself.' },
          category: { type: 'STRING', description: 'One of: Technical, Behavioral, Scenario-Based.' },
          tip: { type: 'STRING', description: 'One concrete, actionable tip for answering this specific question well.' },
        },
        required: ['question', 'category', 'tip'],
      },
    },
  },
  required: ['questions'],
};

function buildSystemPrompt(profile, domain) {
  // The domain picked for THIS interview (member_interviews.interview_domain)
  // wins over the member's static profile specialty when both are present -
  // someone can be interviewing for a role outside their own track, and
  // that's the domain the questions should actually lean toward.
  const trackLabel = domain || profile?.specialty;
  const context = trackLabel
    ? `This member is interviewing for a ${trackLabel} role - lean technical questions toward what that domain actually covers day to day.`
    : 'No specialty track is set for this member yet - infer the right technical angle from the job description and CV instead.';

  return `You are Gemma, the AI assistant embedded in the Hacking Hub member portal - a cybersecurity coaching community. Your voice matches the app's hacker-terminal branding: warm, a little playful, never corporate, but the substance here must be genuinely useful interview prep, not generic filler questions.

Generate a set of interview questions tailored to the specific job description and the member's own CV provided below - cross-reference both. Ask things this specific interviewer would plausibly ask this specific candidate: technical questions rooted in what the job description actually requires, behavioral questions that probe experience claimed on the CV, and at least one realistic scenario-based question relevant to the role.

${context}

Hard rules:
- Every question must be grounded in the actual job description and/or CV text provided - never invent a technology or requirement that isn't there.
- Mix categories: include Technical, Behavioral, and Scenario-Based questions, not all of one kind.
- Each tip must be a concrete, actionable pointer for answering that specific question well - not generic advice like "be confident."
- Never discuss or speculate about other members - you only ever work from this one submission.
- Respond only with the structured JSON described by the response schema - no extra commentary outside it.`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');

    if (!geminiApiKey) {
      return new Response(JSON.stringify({ error: 'Gemma is not configured yet - missing GEMINI_API_KEY secret.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: authError } = await callerClient.auth.getUser();
    if (authError || !userData?.user?.email) {
      return new Response(JSON.stringify({ error: 'Not authenticated.' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const email = userData.user.email.toLowerCase();

    const { jobDescription, cvText, domain } = await req.json();
    const jd = typeof jobDescription === 'string' ? jobDescription.trim() : '';
    const cv = typeof cvText === 'string' ? cvText.trim() : '';
    const chosenDomain = VALID_DOMAINS.includes(domain) ? domain : null;

    if (!jd || !cv) {
      return new Response(JSON.stringify({ error: 'Paste both the job description and your CV text.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (jd.length > MAX_INPUT_LENGTH || cv.length > MAX_INPUT_LENGTH) {
      return new Response(JSON.stringify({ error: `Each field is limited to ${MAX_INPUT_LENGTH} characters.` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: allowed, error: allowedError } = await adminClient.rpc('is_member_allowed', { check_email: email });
    if (allowedError || allowed !== true) {
      return new Response(JSON.stringify({ error: 'Access not permitted.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const weekAgo = new Date();
    weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);
    const { count: recentCount } = await adminClient
      .from('interview_prep_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('member_email', email)
      .gte('created_at', weekAgo.toISOString());

    if ((recentCount || 0) >= WEEKLY_SESSION_CAP) {
      return new Response(JSON.stringify({ error: `You've used all ${WEEKLY_SESSION_CAP} of your interview prep sessions for this week - come back soon.` }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile } = await adminClient
      .from('member_profiles')
      .select('specialty')
      .eq('email', email)
      .maybeSingle();

    const userContent = `--- JOB DESCRIPTION ---\n${jd}\n\n--- CANDIDATE CV TEXT ---\n${cv}`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiApiKey },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: buildSystemPrompt(profile, chosenDomain) }] },
          contents: [{ role: 'user', parts: [{ text: userContent }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: QUESTIONS_SCHEMA,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini API error:', errText);
      return new Response(JSON.stringify({ error: 'Gemma had trouble with that - try again shortly.' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const geminiJson = await geminiRes.json();
    const rawText = geminiJson?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (parseErr) {
      console.error('Could not parse Gemini structured response:', rawText);
      return new Response(JSON.stringify({ error: "Gemma's questions didn't come back in a readable format - try again." }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const questions = Array.isArray(parsed.questions) ? parsed.questions : [];

    const { error: insertError } = await adminClient.from('interview_prep_sessions').insert({
      member_email: email,
      job_description: jd,
      questions,
    });
    if (insertError) {
      console.error('Could not save interview_prep_session:', insertError);
      // Still return the questions even if persisting failed - the
      // generation itself succeeded, no reason to make them redo it.
    }

    return new Response(JSON.stringify({ questions }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('gemma-interview-prep error:', err);
    return new Response(JSON.stringify({ error: 'Something went wrong.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
