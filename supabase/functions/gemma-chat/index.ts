// Hacking Hub Admin Dashboard - Gemma AI Assistant Edge Function
//
// Deploy with: supabase functions deploy gemma-chat
// Requires a secret set first: supabase secrets set GEMINI_API_KEY=<your key>
// (SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected
// automatically by the Edge Functions runtime - no need to set those.)
//
// This exists because a Gemini API key can never live in the client bundle (Vite
// ships every VITE_* env var straight into the JS anyone can read). This function
// is the only thing that ever sees the key: it verifies the caller's identity from
// their Supabase JWT, uses the service-role key to read that member's own profile
// (server-side only, never exposed to the browser), calls Gemini, and returns just
// the reply text.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_MESSAGE_LENGTH = 2000;
const DAILY_MESSAGE_CAP = 40;
const HISTORY_WINDOW = 12;
// Pinned rather than 'gemini-flash-latest' - live-tested both on 2026-08-27:
// gemini-2.0-flash (the previous pin) is fully shut down (404, "no longer
// available"); gemini-flash-latest resolves to something real but returned
// 503 "high demand" on 5/5 consecutive tries; this exact version returned a
// clean success on the first try. A pinned version will eventually need
// bumping again when Google deprecates it - that's a known, accepted cost,
// preferable to depending on whatever '-latest' happens to point at today.
const GEMINI_MODEL = 'gemini-3.6-flash';

// Static facts about how Hacking Hub actually works, pulled from what's real in
// this app (Member Portal tabs) rather than invented - kept short and factual so
// Gemma doesn't need to guess or hallucinate community details.
// Mentor roster corrected 2026-08 (confirmed with founder) - matches the real
// MENTORS list in MemberPortal.jsx's Book a 1on1 screen, not a separate,
// driftable copy. The previous version named a fictional "Jaco du Toit" as a
// real bookable mentor, which was live, factually wrong, member-facing
// content until this fix.
const FAQ_KNOWLEDGE = `
- 1-on-1 mentoring: members book sessions directly via Google Calendar with [REDACTED] (Lead Mentor & Founder - cybersecurity strategy, career roadmaps, OSCP coaching, SOC, cloud security, DevSecOps, and code reviews), or with community mentors Nonhlanhla (data security & AI), Nokulunga (digital forensics/DFIR), or Momelezi (red teaming/ethical hacking). Sessions overdue past 30 days get flagged for admin follow-up.
- Events: HH Meetups, industry tech events, and casual Sunday Catchups, all listed under the Events tab.
- Job Board: full-time, contract, and internship roles sourced from Hacking Hub's employer network and job placement partners.
- Resources tab: cert prep material, role-specific roadmaps, podcasts, books, interview playbooks, and CV templates.
- Cert Calendar: community-wide target exam dates and active cohorts, so members can see who's targeting what and when.
- Competitions: a quarterly TryHackMe competition with a leaderboard.
- Membership tiers include Basic Access, Monthly Operative, Permanent Access, Custom Plan, and Maintenance Fee - exact pricing/billing questions should be pointed to an admin, since Gemma isn't given live billing details beyond the member's own money-owed figure.
- Reviews tab: members can leave feedback/criticism/recommendations, marked Public (visible community-wide) or Private (admin-only) per review.
`.trim();

function buildSystemPrompt(profile) {
  const context = profile
    ? `Known context about this member (only reference what's relevant, don't recite it all back):
- Job readiness stage: ${profile.job_readiness || 'Not started'}
- Employment status: ${profile.employment_status || 'Not set'}${profile.employment_status === 'Employed' && profile.job_title ? ` (${profile.job_title})` : ''}
- Specialty track: ${profile.specialty || 'Not set'}
- Membership status: ${profile.status || 'Active'}
- Money owed: R${Number(profile.money_owed) || 0}`
    : 'No profile data available for this member yet.';

  return `You are Gemma, a friendly, sharp AI assistant embedded in the Hacking Hub member portal - a cybersecurity coaching community. Your voice matches the app's hacker-terminal branding: warm, a little playful, never corporate.

You do three things:
1. Answer FAQs about how Hacking Hub works, using ONLY the facts below - never invent event dates, prices, or policies you weren't given.
2. Offer occasional practical tips relevant to a cybersecurity learner's journey (study strategy, cert prep, job search).
3. Give personalized praise or constructive criticism about the member's own progress, grounded in the context below.

Hard rules:
- Criticism must be specific and constructive, always paired with a concrete next step. Never generic, never harsh or shaming.
- Praise must be specific and genuine, not empty flattery.
- Never discuss or speculate about other members - you only ever have this one member's context.
- Never give legal, medical, or binding financial advice as fact - general encouragement only, and point billing/pricing questions to an admin.
- If you don't know something, say so plainly rather than making it up.
- Keep replies concise - a few sentences, not an essay, unless the member clearly wants depth.

Hacking Hub facts:
${FAQ_KNOWLEDGE}

${context}`;
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

    // Verify identity using the caller's own JWT - never trust a client-supplied email.
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

    const { message } = await req.json();
    if (typeof message !== 'string' || !message.trim() || message.length > MAX_MESSAGE_LENGTH) {
      return new Response(JSON.stringify({ error: 'Message is empty or too long.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Service-role client for privileged reads/writes - bypasses RLS, server-side only.
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Re-check membership - a mid-offboarding or already-revoked member shouldn't get replies.
    const { data: allowed, error: allowedError } = await adminClient.rpc('is_member_allowed', { check_email: email });
    if (allowedError || allowed !== true) {
      return new Response(JSON.stringify({ error: 'Access not permitted.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Cost control: soft daily cap per member.
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const { count: todayCount } = await adminClient
      .from('gemma_messages')
      .select('id', { count: 'exact', head: true })
      .eq('email', email)
      .eq('role', 'user')
      .gte('created_at', startOfDay.toISOString());

    if ((todayCount || 0) >= DAILY_MESSAGE_CAP) {
      return new Response(JSON.stringify({ reply: "I've hit my chat limit with you for today - come back tomorrow and I'll be ready to go again." }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: profile } = await adminClient
      .from('member_profiles')
      .select('job_readiness, employment_status, job_title, specialty, status, money_owed')
      .eq('email', email)
      .maybeSingle();

    const { data: history } = await adminClient
      .from('gemma_messages')
      .select('role, content')
      .eq('email', email)
      .order('created_at', { ascending: false })
      .limit(HISTORY_WINDOW);

    const orderedHistory = (history || []).reverse();

    const geminiContents = [
      ...orderedHistory.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      { role: 'user', parts: [{ text: message }] },
    ];

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: 'POST',
        // The ?key= query-param style only works with the old "standard key"
        // type - Google's phasing that out entirely by September 2026 in
        // favor of "auth keys" (what every new key from AI Studio is now),
        // which authenticate via this header instead.
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiApiKey },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: buildSystemPrompt(profile) }] },
          contents: geminiContents,
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini API error:', errText);
      return new Response(JSON.stringify({ error: 'Gemma had trouble thinking that through - try again shortly.' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const geminiJson = await geminiRes.json();
    const reply =
      geminiJson?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ||
      "I'm not sure how to respond to that - could you rephrase?";

    await adminClient.from('gemma_messages').insert([
      { email, role: 'user', content: message },
      { email, role: 'assistant', content: reply },
    ]);

    return new Response(JSON.stringify({ reply }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('gemma-chat error:', err);
    return new Response(JSON.stringify({ error: 'Something went wrong.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
