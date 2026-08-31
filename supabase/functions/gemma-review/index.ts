// Hacking Hub Admin Dashboard - Gemma CV & LinkedIn Review Edge Function
//
// Deploy with: supabase functions deploy gemma-review
// Reuses the same GEMINI_API_KEY secret gemma-chat already requires - no
// separate secret needed.
//
// Same reason this exists as a server-side function as gemma-chat: the
// Gemini API key can never live in the client bundle. This one additionally
// never persists the member's raw CV/LinkedIn text (see 055_cv_reviews.sql)
// - it's read into memory just long enough to build the prompt and call
// Gemini, then discarded; only the review output is written to the DB.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_INPUT_LENGTH = 8000; // generous headroom over a typical 1-2 page CV or LinkedIn About+experience section
const WEEKLY_REVIEW_CAP = 3; // CV/LinkedIn text is far longer input than a chat turn - lower cap than gemma-chat's 40/day
// Same pin as gemma-chat (see that function's own comment for why this
// exact version, not '-latest') - reuse it here too rather than
// introducing a second model to separately monitor/update.
const GEMINI_MODEL = 'gemini-3.6-flash';

const REVIEW_SCHEMA = {
  type: 'OBJECT',
  properties: {
    overallScore: { type: 'INTEGER', description: 'Overall quality score from 0 to 100.' },
    categories: {
      type: 'ARRAY',
      minItems: 3,
      maxItems: 5,
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING', description: 'Short category name, e.g. "Impact & Quantified Results".' },
          feedback: { type: 'STRING', description: 'Specific, concrete feedback for this category - 1-3 sentences.' },
          suggestion: { type: 'STRING', description: 'One concrete, actionable next step for this category.' },
        },
        required: ['name', 'feedback', 'suggestion'],
      },
    },
  },
  required: ['overallScore', 'categories'],
};

function buildSystemPrompt(profile, reviewType) {
  const context = profile?.specialty
    ? `This member is on the ${profile.specialty} track - weigh keyword relevance and impact statements against what a hiring manager for that specific track would look for.`
    : 'No specialty track is set for this member yet - review generally for a cybersecurity role.';

  const subject = reviewType === 'both' ? 'CV and LinkedIn profile together' : reviewType === 'linkedin' ? 'LinkedIn profile' : 'CV';

  return `You are Gemma, the AI assistant embedded in the Hacking Hub member portal - a cybersecurity coaching community. Your voice matches the app's hacker-terminal branding: warm, a little playful, never corporate, but the substance here must be genuinely rigorous, not empty encouragement.

Review the member's ${subject} exactly as if you were a hiring manager screening candidates for cybersecurity roles (SOC Analyst, Penetration Tester, Cloud Security, DevSecOps, and similar).

${context}

Hard rules:
- Feedback must be specific and grounded in what's actually in the text provided - never invent details that aren't there.
- Every category needs a concrete, actionable suggestion, not vague encouragement like "make it better."
- Criticism must be constructive, not harsh - but don't inflate the score to be nice. A weak submission should score low.
- Categories should fit what was actually submitted (e.g. ATS/formatting concerns apply to a CV, not much to a LinkedIn "About" section - don't force an irrelevant category just to hit a count).
- Never discuss or speculate about other members - you only ever review this one submission.
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

    const { cvText, linkedinText } = await req.json();
    const cv = typeof cvText === 'string' ? cvText.trim() : '';
    const linkedin = typeof linkedinText === 'string' ? linkedinText.trim() : '';

    if (!cv && !linkedin) {
      return new Response(JSON.stringify({ error: 'Paste your CV text, your LinkedIn profile text, or both.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (cv.length > MAX_INPUT_LENGTH || linkedin.length > MAX_INPUT_LENGTH) {
      return new Response(JSON.stringify({ error: `Each field is limited to ${MAX_INPUT_LENGTH} characters.` }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const reviewType = cv && linkedin ? 'both' : cv ? 'cv' : 'linkedin';

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: allowed, error: allowedError } = await adminClient.rpc('is_member_allowed', { check_email: email });
    if (allowedError || allowed !== true) {
      return new Response(JSON.stringify({ error: 'Access not permitted.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Cost control: this is far more expensive per call than a chat
    // message (much longer input), so a weekly cap rather than gemma-chat's
    // daily one.
    const weekAgo = new Date();
    weekAgo.setUTCDate(weekAgo.getUTCDate() - 7);
    const { count: recentCount } = await adminClient
      .from('cv_reviews')
      .select('id', { count: 'exact', head: true })
      .eq('member_email', email)
      .gte('created_at', weekAgo.toISOString());

    if ((recentCount || 0) >= WEEKLY_REVIEW_CAP) {
      return new Response(JSON.stringify({ error: `You've used all ${WEEKLY_REVIEW_CAP} of your reviews for this week - come back soon.` }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile } = await adminClient
      .from('member_profiles')
      .select('specialty')
      .eq('email', email)
      .maybeSingle();

    const userContentParts = [];
    if (cv) userContentParts.push(`--- CV TEXT ---\n${cv}`);
    if (linkedin) userContentParts.push(`--- LINKEDIN PROFILE TEXT ---\n${linkedin}`);

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiApiKey },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: buildSystemPrompt(profile, reviewType) }] },
          contents: [{ role: 'user', parts: [{ text: userContentParts.join('\n\n') }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: REVIEW_SCHEMA,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini API error:', errText);
      return new Response(JSON.stringify({ error: 'Gemma had trouble reviewing that - try again shortly.' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const geminiJson = await geminiRes.json();
    const rawText = geminiJson?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';

    let review;
    try {
      review = JSON.parse(rawText);
    } catch (parseErr) {
      console.error('Could not parse Gemini structured response:', rawText);
      return new Response(JSON.stringify({ error: "Gemma's review didn't come back in a readable format - try again." }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const overallScore = Math.max(0, Math.min(100, Math.round(Number(review.overallScore) || 0)));
    const categories = Array.isArray(review.categories) ? review.categories : [];

    // service-role insert - no client-facing INSERT policy exists (same
    // reasoning as gemma_messages), this is the only write path.
    const { error: insertError } = await adminClient.from('cv_reviews').insert({
      member_email: email,
      review_type: reviewType,
      overall_score: overallScore,
      categories,
    });
    if (insertError) {
      console.error('Could not save cv_review:', insertError);
      // Still return the review to the member even if persisting failed -
      // the review itself succeeded, no reason to make them redo it.
    }

    return new Response(JSON.stringify({ overallScore, categories, reviewType }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('gemma-review error:', err);
    return new Response(JSON.stringify({ error: 'Something went wrong.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
